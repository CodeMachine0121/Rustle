import type { SettingsSession } from "../settings/SettingsSession";
import type { ArticleHolder } from "../vault/VaultSession";

export type ViewMode = "editorOnly" | "sideBySide" | "previewOnly";

export const VIEW_MODES: readonly ViewMode[] = ["editorOnly", "sideBySide", "previewOnly"];

/** The region whose header carries the Zen button and the view mode buttons. */
export type ControlsRegion = "editor" | "preview";

export type WritingLayoutSnapshot = {
  viewMode: ViewMode;
  isZen: boolean;
  controlsLiveIn: ControlsRegion;
};

/**
 * How the writing area is arranged: one of three view modes, and Zen Mode
 * on or off, independently. Whether the preview is on screen is remembered
 * in the settings; "preview only" is remembered as "preview open", so the
 * app starts side by side, and Zen Mode is never remembered.
 */
export class WritingLayout {
  readonly #settings: SettingsSession;
  readonly #listeners = new Set<() => void>();
  #showsOnlyPreview = false;
  #isZen = false;
  #controlsFocusPending = false;
  #snapshot: WritingLayoutSnapshot | null = null;

  constructor(settings: SettingsSession) {
    this.#settings = settings;
    settings.subscribe(() => {
      if (!settings.settings.previewPanel.isOpen) {
        this.#showsOnlyPreview = false;
      }
    });
  }

  get snapshot(): WritingLayoutSnapshot {
    const viewMode = this.#viewMode();
    const current = this.#snapshot;
    if (current !== null && current.viewMode === viewMode && current.isZen === this.#isZen) {
      return current;
    }
    this.#snapshot = {
      viewMode,
      isZen: this.#isZen,
      controlsLiveIn: viewMode === "previewOnly" ? "preview" : "editor",
    };
    return this.#snapshot;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    const stopListeningToSettings = this.#settings.subscribe(listener);
    return () => {
      this.#listeners.delete(listener);
      stopListeningToSettings();
    };
  };

  /** A choice from the view mode buttons; when they move to the other header, the chosen one takes the keyboard there. */
  choose(viewMode: ViewMode): void {
    const controlsWereIn = this.snapshot.controlsLiveIn;
    this.#arrange(viewMode);
    this.#controlsFocusPending = this.snapshot.controlsLiveIn !== controlsWereIn;
    this.#publish();
  }

  /** The preview shortcut moves between side by side and editor only; from preview only it brings the editor back. */
  togglePreviewFromShortcut(): void {
    this.#arrange(this.#viewMode() === "sideBySide" ? "editorOnly" : "sideBySide");
    this.#publish();
  }

  toggleZen(): void {
    this.#isZen = !this.#isZen;
    this.#publish();
  }

  /** Brings the editor back from preview only; the settings already say the preview is open. */
  revealEditor(): void {
    if (this.#showsOnlyPreview) {
      this.#showsOnlyPreview = false;
      this.#publish();
    }
  }

  /**
   * `holder`, except that it also brings the editor back when preview only
   * would hide what the writer needs: the warning or failure that explains
   * a refusal to let the open article go, or the editor an opened article
   * or a placed cursor hands the keyboard to.
   */
  revealEditorWhenNeeded(holder: ArticleHolder): ArticleHolder {
    const revealUnless = async (leaving: ReturnType<ArticleHolder["closeArticle"]>, keepsHidden: boolean) => {
      const outcome = await leaving;
      if (outcome !== "switched" || !keepsHidden) {
        this.revealEditor();
      }
      return outcome;
    };
    return {
      openArticle: (article) => revealUnless(holder.openArticle(article), article.focusEditor !== true),
      closeArticle: () => revealUnless(holder.closeArticle(), true),
      placeCursor: (line) => {
        this.revealEditor();
        holder.placeCursor(line);
      },
    };
  }

  /** `true` once after a view mode choice moved the buttons to the other header. */
  takeControlsFocus(): boolean {
    const pending = this.#controlsFocusPending;
    this.#controlsFocusPending = false;
    return pending;
  }

  #viewMode(): ViewMode {
    if (!this.#settings.settings.previewPanel.isOpen) {
      return "editorOnly";
    }
    return this.#showsOnlyPreview ? "previewOnly" : "sideBySide";
  }

  #arrange(viewMode: ViewMode): void {
    this.#showsOnlyPreview = viewMode === "previewOnly";
    const isOpen = viewMode !== "editorOnly";
    if (this.#settings.settings.previewPanel.isOpen !== isOpen) {
      this.#settings.change((settings) => ({
        ...settings,
        previewPanel: { ...settings.previewPanel, isOpen },
      }));
    }
  }

  #publish(): void {
    this.#listeners.forEach((listener) => listener());
  }
}
