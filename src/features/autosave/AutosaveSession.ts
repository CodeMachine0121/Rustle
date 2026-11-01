import type { ArticleBody } from "../../ipc/articleBody";
import type { ChannelResult } from "../../ipc/channelResult";
import type { SaveBodyRequest, SavedBody } from "../../ipc/savedBody";
import { CompositionAwareDebouncer } from "../../shared/composition/CompositionAwareDebouncer";
import type { CompositionState } from "../../shared/composition/CompositionState";

export const AUTOSAVE_DELAY_MILLISECONDS = 1000;

export type AutosaveSwitchOutcome =
  "switched" | "blockedByUnansweredWarning" | "blockedByFailedSave";

export type WindowCloseDecision = "close" | "stay";

/** `focusEditor` hands the keyboard to the editor once the article is shown. */
export type OpenedArticle = { article: ArticleBody; title: string; focusEditor?: boolean };

export type AutosaveStatus =
  | { kind: "noArticle" }
  | {
      kind: "article";
      title: string;
      hasUnsavedChanges: boolean;
      modifiedElsewhere: boolean;
      failureMessage: string | null;
    };

/**
 * The body the editor should show; `version` changes whenever it is
 * replaced, and `takesFocus` says whether showing it moves the keyboard there.
 */
export type EditorDocument = { version: number; body: string | null; takesFocus: boolean };

export type AutosaveBackend = {
  saveBody: (request: SaveBodyRequest) => Promise<ChannelResult<SavedBody>>;
  readBody: (workspace: string, fileName: string) => Promise<ChannelResult<ArticleBody>>;
};

export type AutosaveOptions = {
  delayMilliseconds?: number;
  releaseFocus?: () => void;
};

type CurrentArticle = {
  workspace: string;
  fileName: string;
  title: string;
  lastKnownModifiedAt: string;
};

type SaveMode = "refuseOutsideChanges" | "overwriteOutsideChanges";

/**
 * The only owner of when and how the open article is saved: one second
 * after typing stops, never while composing, one save at a time, and
 * always before the article is left or the window closes.
 */
export class AutosaveSession {
  readonly #composition: CompositionState;
  readonly #backend: AutosaveBackend;
  readonly #debouncer: CompositionAwareDebouncer;
  readonly #releaseFocus: () => void;
  readonly #listeners = new Set<() => void>();
  #article: CurrentArticle | null = null;
  #body = "";
  #revision = 0;
  #savedRevision = 0;
  #modifiedElsewhere = false;
  #failureMessage: string | null = null;
  #leavingRefusedAfterFailure = false;
  #closingRefused = false;
  #queue: Promise<unknown> = Promise.resolve();
  #status: AutosaveStatus = { kind: "noArticle" };
  #document: EditorDocument = { version: 0, body: null, takesFocus: false };

  constructor(
    composition: CompositionState,
    backend: AutosaveBackend,
    {
      delayMilliseconds = AUTOSAVE_DELAY_MILLISECONDS,
      releaseFocus = () => undefined,
    }: AutosaveOptions = {},
  ) {
    this.#composition = composition;
    this.#backend = backend;
    this.#debouncer = new CompositionAwareDebouncer(composition, delayMilliseconds);
    this.#releaseFocus = releaseFocus;
  }

  get status(): AutosaveStatus {
    return this.#status;
  }

  get document(): EditorDocument {
    return this.#document;
  }

  /** The body as the editor last reported it; `null` while no article is open. */
  get body(): string | null {
    return this.#article === null ? null : this.#body;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  changeBody(body: string): void {
    if (this.#article === null) {
      return;
    }
    this.#body = body;
    this.#revision += 1;
    this.#scheduleSave();
    this.#publish();
  }

  async openArticle({
    article,
    title,
    focusEditor = false,
  }: OpenedArticle): Promise<AutosaveSwitchOutcome> {
    const outcome = await this.#leave();
    if (outcome === "switched") {
      this.#show(
        {
          workspace: article.workspace,
          fileName: article.fileName,
          title,
          lastKnownModifiedAt: article.lastKnownModifiedAt,
        },
        article.body,
        focusEditor,
      );
    }
    return outcome;
  }

  async closeArticle(): Promise<AutosaveSwitchOutcome> {
    const outcome = await this.#leave();
    if (outcome === "switched") {
      this.#show(null, null);
    }
    return outcome;
  }

  overwrite(): Promise<void> {
    this.#debouncer.cancel();
    return this.#enqueueSave("overwriteOutsideChanges");
  }

  reload(): Promise<void> {
    this.#debouncer.cancel();
    return this.#enqueue(async () => {
      await this.#compositionEnded();
      const article = this.#article;
      if (article === null) {
        return;
      }
      const result = await this.#backend.readBody(article.workspace, article.fileName);
      if (this.#article !== article) {
        return;
      }
      if (!result.ok) {
        this.#failureMessage = result.message;
        this.#publish();
        return;
      }
      article.lastKnownModifiedAt = result.payload.lastKnownModifiedAt;
      this.#show(article, result.payload.body);
    });
  }

  async prepareToCloseWindow(): Promise<WindowCloseDecision> {
    if (!this.#hasUnsavedChanges() || this.#closingRefused) {
      return "close";
    }
    this.#releaseFocus();
    await this.#saveEverything();
    if (!this.#hasUnsavedChanges()) {
      return "close";
    }
    this.#closingRefused = true;
    return "stay";
  }

  dispose(): void {
    this.#debouncer.dispose();
    this.#listeners.clear();
  }

  async #leave(): Promise<AutosaveSwitchOutcome> {
    if (!this.#hasUnsavedChanges() || this.#leavingRefusedAfterFailure) {
      return "switched";
    }
    await this.#saveEverything();
    if (this.#modifiedElsewhere) {
      return "blockedByUnansweredWarning";
    }
    if (!this.#hasUnsavedChanges()) {
      return "switched";
    }
    this.#leavingRefusedAfterFailure = true;
    return "blockedByFailedSave";
  }

  async #saveEverything(): Promise<void> {
    while (this.#hasUnsavedChanges() && !this.#modifiedElsewhere) {
      this.#debouncer.cancel();
      await this.#enqueueSave("refuseOutsideChanges");
      if (this.#failureMessage !== null) {
        return;
      }
    }
  }

  #scheduleSave(): void {
    this.#debouncer.schedule(() => {
      void this.#enqueueSave("refuseOutsideChanges");
    });
  }

  #enqueueSave(mode: SaveMode): Promise<void> {
    return this.#enqueue(() => this.#save(mode));
  }

  async #save(mode: SaveMode): Promise<void> {
    await this.#compositionEnded();
    const article = this.#article;
    if (article === null) {
      return;
    }
    if (
      mode === "refuseOutsideChanges" &&
      (this.#modifiedElsewhere || !this.#hasUnsavedChanges())
    ) {
      return;
    }
    const revision = this.#revision;
    const result = await this.#backend.saveBody({
      workspace: article.workspace,
      fileName: article.fileName,
      body: this.#body,
      lastKnownModifiedAt: article.lastKnownModifiedAt,
      overwrite: mode === "overwriteOutsideChanges",
    });
    if (this.#article !== article) {
      return;
    }
    this.#leavingRefusedAfterFailure = false;
    this.#closingRefused = false;
    if (!result.ok) {
      this.#failureMessage = result.message;
    } else if (result.payload.outcome === "modifiedElsewhere") {
      this.#modifiedElsewhere = true;
      this.#failureMessage = null;
      this.#debouncer.cancel();
    } else {
      article.lastKnownModifiedAt = result.payload.lastKnownModifiedAt;
      this.#savedRevision = revision;
      this.#modifiedElsewhere = false;
      this.#failureMessage = null;
      if (this.#hasUnsavedChanges()) {
        this.#scheduleSave();
      }
    }
    this.#publish();
  }

  #show(article: CurrentArticle | null, body: string | null, takesFocus = false): void {
    this.#debouncer.cancel();
    this.#article = article;
    this.#body = body ?? "";
    this.#savedRevision = this.#revision;
    this.#modifiedElsewhere = false;
    this.#failureMessage = null;
    this.#leavingRefusedAfterFailure = false;
    this.#closingRefused = false;
    this.#document = { version: this.#document.version + 1, body, takesFocus };
    this.#publish();
  }

  #enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.#queue.then(task);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  #compositionEnded(): Promise<void> {
    if (!this.#composition.isComposing) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const unsubscribe = this.#composition.subscribe((isComposing) => {
        if (!isComposing) {
          unsubscribe();
          resolve();
        }
      });
    });
  }

  #hasUnsavedChanges(): boolean {
    return this.#article !== null && this.#revision !== this.#savedRevision;
  }

  #publish(): void {
    this.#status =
      this.#article === null
        ? { kind: "noArticle" }
        : {
            kind: "article",
            title: this.#article.title,
            hasUnsavedChanges: this.#hasUnsavedChanges(),
            modifiedElsewhere: this.#modifiedElsewhere,
            failureMessage: this.#failureMessage,
          };
    this.#listeners.forEach((listener) => listener());
  }
}
