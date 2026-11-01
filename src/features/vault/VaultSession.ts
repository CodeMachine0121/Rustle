import type { ArticleSummary } from "../../ipc/articleSummary";
import type { Channels } from "../../ipc/channels";
import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import type { Settings } from "../../ipc/settings";
import type { WorkspaceContents } from "../../ipc/workspaceContents";
import type { WorkspaceSummary } from "../../ipc/workspaceSummary";
import type { AutosaveSession } from "../autosave/AutosaveSession";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import {
  LEAVING_REFUSAL_MESSAGES,
  MODIFIED_ELSEWHERE_MESSAGE,
  type Operation,
  type OperationFailure,
} from "./operationFailure";

export type VaultChannels = Pick<
  Channels,
  | "listWorkspaces"
  | "listArticles"
  | "createWorkspace"
  | "createArticle"
  | "readBody"
  | "readSettings"
  | "writeSettings"
  | "updateMetadata"
  | "deleteArticle"
  | "renameWorkspace"
  | "countWorkspaceContents"
  | "deleteWorkspace"
>;

/** What the user typed into the create article dialog or the metadata form. */
export type ArticleDraft = { title: string; category: string[]; tags: string[] };

export type ArticleCreation = { outcome: "created" } | { outcome: "failed"; message: string };

export type MetadataEdit = { outcome: "updated" } | { outcome: "failed"; message: string };

export type RenameRejection = { workspace: string; reason: WorkspaceNameRejection };

/** Holds the open article and may refuse to let it go, for example while it cannot be saved. */
export type ArticleHolder = Pick<AutosaveSession, "openArticle" | "closeArticle">;

const LETS_EVERY_ARTICLE_GO: ArticleHolder = {
  openArticle: () => Promise.resolve("switched"),
  closeArticle: () => Promise.resolve("switched"),
};

export type VaultSnapshot = {
  workspaces: WorkspaceSummary[];
  selectedWorkspace: string | null;
  articles: ArticleSummary[];
  selectedArticle: string | null;
  body: string | null;
  openedDocument: string | null;
  indentation: Settings["indentation"];
  workspaceListFailure: string | null;
  articleListFailure: string | null;
  bodyFailure: string | null;
  creationRejection: WorkspaceNameRejection | null;
  creationFailure: string | null;
  renameRejection: RenameRejection | null;
  operationFailure: OperationFailure | null;
};

/** What the session shows before it has read anything. */
export const INITIAL_VAULT_SNAPSHOT: VaultSnapshot = {
  workspaces: [],
  selectedWorkspace: null,
  articles: [],
  selectedArticle: null,
  body: null,
  openedDocument: null,
  indentation: DEFAULT_SETTINGS.indentation,
  workspaceListFailure: null,
  articleListFailure: null,
  bodyFailure: null,
  creationRejection: null,
  creationFailure: null,
  renameRejection: null,
  operationFailure: null,
};

/**
 * The one owner of what is selected in the vault. Every click goes through
 * here; an answer that arrives after a newer click is dropped, and each
 * selection is remembered in the settings for the next start. The open
 * article changes only when its holder lets the previous one go.
 */
export class VaultSession {
  readonly #channels: VaultChannels;
  readonly #articleHolder: ArticleHolder;
  readonly #listeners = new Set<() => void>();
  #snapshot = INITIAL_VAULT_SNAPSHOT;
  readonly #settings: SettingsSession;
  #latestSelection = 0;

  constructor(
    channels: VaultChannels,
    articleHolder: ArticleHolder = LETS_EVERY_ARTICLE_GO,
    settings: SettingsSession = new SettingsSession(channels),
  ) {
    this.#channels = channels;
    this.#articleHolder = articleHolder;
    this.#settings = settings;
  }

  get snapshot(): VaultSnapshot {
    return this.#snapshot;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  async start(): Promise<void> {
    await this.#settings.load();
    this.#update({ indentation: this.#settings.settings.indentation });
    if (!(await this.#loadWorkspaces())) {
      return;
    }
    const { workspace, article } = this.#settings.settings.lastOpened;
    if (workspace === null || !this.#snapshot.workspaces.some(({ name }) => name === workspace)) {
      return;
    }
    const selection = this.#beginSelection();
    if (!(await this.#openWorkspace(workspace, selection))) {
      return;
    }
    if (article !== null && this.#snapshot.articles.some(({ fileName }) => fileName === article)) {
      await this.#openArticle(workspace, article, selection);
    }
  }

  async selectWorkspace(workspace: string): Promise<void> {
    if ((await this.#articleHolder.closeArticle()) !== "switched") {
      return;
    }
    const selection = this.#beginSelection();
    if (await this.#openWorkspace(workspace, selection)) {
      this.#remember(workspace, null);
    }
  }

  async selectArticle(fileName: string): Promise<void> {
    const workspace = this.#snapshot.selectedWorkspace;
    if (workspace === null || this.#snapshot.openedDocument === `${workspace}/${fileName}`) {
      return;
    }
    const selection = this.#beginSelection();
    if (await this.#openArticle(workspace, fileName, selection)) {
      this.#remember(workspace, fileName);
    }
  }

  /** Resolves to whether the workspace was created. */
  async createWorkspace(typedName: string): Promise<boolean> {
    this.#update({ creationRejection: null, creationFailure: null });
    const result = await this.#channels.createWorkspace(typedName);
    if (!result.ok) {
      this.#update({ creationFailure: result.message });
      return false;
    }
    if (result.payload.outcome === "rejected") {
      this.#update({ creationRejection: result.payload.reason });
      return false;
    }
    await this.#loadWorkspaces();
    await this.selectWorkspace(result.payload.workspace.name);
    return true;
  }

  /**
   * Creates an article in the selected workspace, refreshes both lists and
   * opens it with the cursor in the editor. The article counts as created
   * even when the open article may not be left yet.
   */
  async createArticle(draft: ArticleDraft): Promise<ArticleCreation> {
    const workspace = this.#snapshot.selectedWorkspace;
    if (workspace === null) {
      return { outcome: "failed", message: "沒有選取 workspace" };
    }
    const selection = this.#beginSelection();
    const result = await this.#channels.createArticle({ workspace, ...draft });
    if (!result.ok) {
      this.#fail("createArticle", result.message);
      return { outcome: "failed", message: result.message };
    }
    this.dismissOperationFailure();
    await this.#loadWorkspaces();
    const articles = await this.#channels.listArticles(workspace);
    if (selection !== this.#latestSelection) {
      return { outcome: "created" };
    }
    if (articles.ok) {
      this.#update({ articles: articles.payload, articleListFailure: null });
    }
    const { fileName } = result.payload;
    if (await this.#openArticle(workspace, fileName, selection, { focusEditor: true })) {
      this.#remember(workspace, fileName);
    }
    return { outcome: "created" };
  }

  /**
   * Writes the title, categories and tags. The open article is saved and
   * let go first, and opened again afterwards with its new modification
   * time, so our own write is never taken for an outside change.
   */
  async updateMetadata(fileName: string, draft: ArticleDraft): Promise<MetadataEdit> {
    const workspace = this.#snapshot.selectedWorkspace;
    if (workspace === null) {
      return { outcome: "failed", message: "沒有選取 workspace" };
    }
    const wasOpen = this.#snapshot.openedDocument === `${workspace}/${fileName}`;
    const selection = this.#beginSelection();
    if (wasOpen && !(await this.#letGoOfOpenArticle("updateMetadata"))) {
      return this.#failedEdit();
    }
    const result = await this.#channels.updateMetadata({ workspace, fileName, ...draft });
    await this.#reloadArticles(workspace, selection);
    if (wasOpen && selection === this.#latestSelection) {
      await this.#openArticle(workspace, fileName, selection);
    }
    if (!result.ok) {
      this.#fail("updateMetadata", result.message);
      return this.#failedEdit();
    }
    if (result.payload.outcome === "modifiedElsewhere") {
      this.#fail("updateMetadata", MODIFIED_ELSEWHERE_MESSAGE);
      return this.#failedEdit();
    }
    this.dismissOperationFailure();
    return { outcome: "updated" };
  }

  /** Moves the article to the system trash; the open one is saved first and nothing is left selected. */
  async deleteArticle(fileName: string): Promise<void> {
    const workspace = this.#snapshot.selectedWorkspace;
    if (workspace === null) {
      return;
    }
    const wasSelected = this.#snapshot.selectedArticle === fileName;
    const selection = this.#beginSelection();
    if (wasSelected && !(await this.#letGoOfOpenArticle("deleteArticle"))) {
      return;
    }
    const result = await this.#channels.deleteArticle(workspace, fileName);
    if (!result.ok) {
      this.#fail("deleteArticle", result.message);
      if (wasSelected && selection === this.#latestSelection) {
        await this.#openArticle(workspace, fileName, selection);
      }
      return;
    }
    this.dismissOperationFailure();
    if (wasSelected) {
      this.#update({ selectedArticle: null });
      this.#remember(workspace, null);
    }
    await this.#loadWorkspaces();
    await this.#reloadArticles(workspace, selection);
  }

  /** Resolves to whether the workspace was renamed; a selected one stays selected under its new name. */
  async renameWorkspace(workspace: string, typedName: string): Promise<boolean> {
    this.#update({ renameRejection: null });
    const wasSelected = this.#snapshot.selectedWorkspace === workspace;
    const openArticle = wasSelected ? this.#snapshot.selectedArticle : null;
    const selection = this.#beginSelection();
    if (wasSelected && !(await this.#letGoOfOpenArticle("renameWorkspace"))) {
      return false;
    }
    const result = await this.#channels.renameWorkspace(workspace, typedName);
    const reopenLeftArticle = async () => {
      if (openArticle !== null && selection === this.#latestSelection) {
        await this.#openArticle(workspace, openArticle, selection);
      }
    };
    if (!result.ok) {
      this.#fail("renameWorkspace", result.message);
      await reopenLeftArticle();
      return false;
    }
    if (result.payload.outcome === "rejected") {
      this.#update({ renameRejection: { workspace, reason: result.payload.reason } });
      await reopenLeftArticle();
      return false;
    }
    this.dismissOperationFailure();
    const renamed = result.payload.workspace;
    await this.#loadWorkspaces();
    if (wasSelected && selection === this.#latestSelection) {
      if (await this.#openWorkspace(renamed, selection)) {
        this.#remember(renamed, null);
      }
    }
    return true;
  }

  /** What deleting the workspace would take, counted now; `null` (and a notice) when it cannot be counted. */
  async countWorkspaceContents(workspace: string): Promise<WorkspaceContents | null> {
    const result = await this.#channels.countWorkspaceContents(workspace);
    if (!result.ok) {
      this.#fail("deleteWorkspace", result.message);
      return null;
    }
    return result.payload;
  }

  /** Moves the whole workspace folder to the system trash; a selected one leaves nothing selected. */
  async deleteWorkspace(workspace: string): Promise<void> {
    const wasSelected = this.#snapshot.selectedWorkspace === workspace;
    const openArticle = wasSelected ? this.#snapshot.selectedArticle : null;
    const selection = this.#beginSelection();
    if (wasSelected && !(await this.#letGoOfOpenArticle("deleteWorkspace"))) {
      return;
    }
    const result = await this.#channels.deleteWorkspace(workspace);
    if (!result.ok) {
      this.#fail("deleteWorkspace", result.message);
      if (openArticle !== null && selection === this.#latestSelection) {
        await this.#openArticle(workspace, openArticle, selection);
      }
      return;
    }
    this.dismissOperationFailure();
    if (wasSelected) {
      this.#update({
        selectedWorkspace: null,
        articles: [],
        selectedArticle: null,
        articleListFailure: null,
        bodyFailure: null,
      });
      this.#remember(null, null);
    }
    await this.#loadWorkspaces();
  }

  dismissOperationFailure(): void {
    if (this.#snapshot.operationFailure !== null) {
      this.#update({ operationFailure: null });
    }
  }

  async #letGoOfOpenArticle(operation: Operation): Promise<boolean> {
    const outcome = await this.#articleHolder.closeArticle();
    if (outcome !== "switched") {
      this.#fail(operation, LEAVING_REFUSAL_MESSAGES[outcome]);
      return false;
    }
    this.#update({ body: null, openedDocument: null, bodyFailure: null });
    return true;
  }

  async #reloadArticles(workspace: string, selection: number): Promise<void> {
    const articles = await this.#channels.listArticles(workspace);
    if (selection !== this.#latestSelection || this.#snapshot.selectedWorkspace !== workspace) {
      return;
    }
    this.#update(
      articles.ok
        ? { articles: articles.payload, articleListFailure: null }
        : { articleListFailure: articles.message },
    );
  }

  #failedEdit(): MetadataEdit {
    return { outcome: "failed", message: this.#snapshot.operationFailure?.message ?? "" };
  }

  #fail(operation: Operation, message: string): void {
    this.#update({ operationFailure: { operation, message } });
  }

  async #loadWorkspaces(): Promise<boolean> {
    const result = await this.#channels.listWorkspaces();
    if (!result.ok) {
      this.#update({ workspaceListFailure: result.message });
      return false;
    }
    this.#update({ workspaces: result.payload, workspaceListFailure: null });
    return true;
  }

  async #openWorkspace(workspace: string, selection: number): Promise<boolean> {
    this.#update({
      selectedWorkspace: workspace,
      articles: [],
      selectedArticle: null,
      body: null,
      openedDocument: null,
      articleListFailure: null,
      bodyFailure: null,
    });
    const result = await this.#channels.listArticles(workspace);
    if (selection !== this.#latestSelection) {
      return false;
    }
    if (!result.ok) {
      this.#update({ articleListFailure: result.message });
      return false;
    }
    this.#update({ articles: result.payload });
    return true;
  }

  async #openArticle(
    workspace: string,
    fileName: string,
    selection: number,
    { focusEditor = false } = {},
  ): Promise<boolean> {
    const previousArticle = this.#snapshot.selectedArticle;
    this.#update({ selectedArticle: fileName, bodyFailure: null });
    const result = await this.#channels.readBody(workspace, fileName);
    if (selection !== this.#latestSelection) {
      return false;
    }
    const title =
      this.#snapshot.articles.find((summary) => summary.fileName === fileName)?.title ?? fileName;
    const outcome = result.ok
      ? await this.#articleHolder.openArticle({ article: result.payload, title, focusEditor })
      : await this.#articleHolder.closeArticle();
    if (selection !== this.#latestSelection) {
      return false;
    }
    if (outcome !== "switched") {
      this.#update({ selectedArticle: previousArticle });
      return false;
    }
    if (!result.ok) {
      this.#update({ body: null, openedDocument: null, bodyFailure: result.message });
      return false;
    }
    this.#update({ body: result.payload.body, openedDocument: `${workspace}/${fileName}` });
    return true;
  }

  #beginSelection(): number {
    this.#latestSelection += 1;
    return this.#latestSelection;
  }

  #remember(workspace: string | null, article: string | null): void {
    this.#settings.change((settings) => ({ ...settings, lastOpened: { workspace, article } }));
  }

  #update(change: Partial<VaultSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...change };
    this.#listeners.forEach((listener) => listener());
  }
}
