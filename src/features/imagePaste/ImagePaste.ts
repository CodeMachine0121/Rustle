import { isolateHistory } from "@codemirror/commands";
import { type Extension, Transaction } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

import type { ChannelResult } from "../../ipc/channelResult";
import type { SavedClipboardImages } from "../../ipc/savedClipboardImages";
import type { CompositionState } from "../../shared/composition/CompositionState";
import type { AutosaveSession } from "../autosave/AutosaveSession";

export const PASTABLE_IMAGE_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/webp",
  "image/svg+xml",
];

export type ImagePasteStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "failed"; message: string };

export type ImagePasteBackend = {
  saveClipboardImage: (workspace: string) => Promise<ChannelResult<SavedClipboardImages>>;
};

export type ImagePasteSource = Pick<AutosaveSession, "subscribe" | "workspace">;

type PendingInsertion = { from: number; to: number };

type PasteTarget = {
  readonly view: EditorView;
  readonly pending: Set<PendingInsertion>;
  readonly isDestroyed: boolean;
};

const IDLE: ImagePasteStatus = { kind: "idle" };
const SAVING: ImagePasteStatus = { kind: "saving" };

/**
 * Turns a paste that carries an image into image files in the open
 * article's workspace and one `![](images/…)` line per image, inserted
 * where the paste happened as one undo step. A paste while composing, with
 * no article open, or without a recognised image stays the editor's own.
 */
export class ImagePaste {
  readonly #composition: CompositionState;
  readonly #backend: ImagePasteBackend;
  readonly #source: ImagePasteSource;
  readonly #listeners = new Set<() => void>();
  readonly #stopFollowing: () => void;
  #workspace: string | null;
  #savesInFlight = 0;
  #failureMessage: string | null = null;
  #status: ImagePasteStatus = IDLE;

  constructor(composition: CompositionState, backend: ImagePasteBackend, source: ImagePasteSource) {
    this.#composition = composition;
    this.#backend = backend;
    this.#source = source;
    this.#workspace = source.workspace;
    this.#stopFollowing = source.subscribe(() => this.#followWorkspace());
  }

  get status(): ImagePasteStatus {
    return this.#status;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  dispose(): void {
    this.#stopFollowing();
    this.#listeners.clear();
  }

  /** The editor extension; each editor state gets its own pending pastes. */
  extension(): Extension {
    const take = (event: ClipboardEvent, target: PasteTarget) => this.#take(event, target);
    return ViewPlugin.fromClass(
      class implements PasteTarget {
        readonly pending = new Set<PendingInsertion>();
        isDestroyed = false;

        constructor(readonly view: EditorView) {}

        update(update: ViewUpdate) {
          if (!update.docChanged) {
            return;
          }
          this.pending.forEach((insertion) => {
            insertion.from = update.changes.mapPos(insertion.from, -1);
            insertion.to = Math.max(insertion.from, update.changes.mapPos(insertion.to, -1));
          });
        }

        destroy() {
          this.isDestroyed = true;
        }
      },
      {
        eventHandlers: {
          paste(event) {
            return take(event, this);
          },
        },
      },
    );
  }

  #take(event: ClipboardEvent, target: PasteTarget): boolean {
    const workspace = this.#source.workspace;
    const data = event.clipboardData;
    if (
      this.#composition.isComposing ||
      workspace === null ||
      data === null ||
      !this.#holdsPastableImage(data)
    ) {
      return false;
    }
    event.preventDefault();
    const { from, to } = target.view.state.selection.main;
    const insertion = { from, to };
    target.pending.add(insertion);
    void this.#save(workspace, data.getData("text/plain"), target, insertion);
    return true;
  }

  #holdsPastableImage(data: DataTransfer): boolean {
    const types = [
      ...Array.from(data.items ?? [], (item) => (item.kind === "file" ? item.type : "")),
      ...Array.from(data.files ?? [], (file) => file.type),
    ];
    return types.some((type) => PASTABLE_IMAGE_TYPES.includes(type));
  }

  async #save(
    workspace: string,
    text: string,
    target: PasteTarget,
    insertion: PendingInsertion,
  ): Promise<void> {
    this.#savesInFlight += 1;
    this.#publish();
    const result = await this.#backend.saveClipboardImage(workspace);
    this.#savesInFlight -= 1;
    this.#failureMessage = result.ok ? null : result.message;
    this.#publish();
    if (!result.ok) {
      target.pending.delete(insertion);
      return;
    }
    const lines = result.payload.images.map(({ relativePath }) => `![](${relativePath})`);
    this.#whenNotComposing(() => {
      target.pending.delete(insertion);
      if (!target.isDestroyed) {
        this.#insert(target.view, insertion, lines, text);
      }
    });
  }

  #insert(view: EditorView, { from, to }: PendingInsertion, lines: string[], text: string): void {
    const lastLine = lines.at(-1);
    const insert = lastLine === undefined ? text : lines.join("\n");
    if (insert === "") {
      return;
    }
    const lastAltText = lastLine === undefined ? insert.length : insert.length - lastLine.length + 2;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + lastAltText },
      annotations: [isolateHistory.of("full"), Transaction.userEvent.of("input.paste")],
      scrollIntoView: true,
    });
  }

  #whenNotComposing(action: () => void): void {
    if (!this.#composition.isComposing) {
      action();
      return;
    }
    const unsubscribe = this.#composition.subscribe((isComposing) => {
      if (!isComposing) {
        unsubscribe();
        action();
      }
    });
  }

  #followWorkspace(): void {
    const workspace = this.#source.workspace;
    if (workspace === this.#workspace) {
      return;
    }
    this.#workspace = workspace;
    this.#failureMessage = null;
    this.#publish();
  }

  #publish(): void {
    const status: ImagePasteStatus =
      this.#savesInFlight > 0
        ? SAVING
        : this.#failureMessage === null
          ? IDLE
          : { kind: "failed", message: this.#failureMessage };
    const unchanged =
      status.kind === this.#status.kind &&
      (status.kind !== "failed" ||
        (this.#status.kind === "failed" && status.message === this.#status.message));
    if (unchanged) {
      return;
    }
    this.#status = status;
    this.#listeners.forEach((listener) => listener());
  }
}
