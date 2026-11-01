import type { SettingsSession } from "../settings/SettingsSession";

export type VimMode = "normal" | "insert" | "visual";

/**
 * Whether Vim mode is on (the vault's settings say so; off unless they say
 * `true`) and which mode the writing surface is in, as the editor reports
 * it. Turning Vim on starts in Normal mode.
 */
export class VimModeSession {
  readonly #settings: SettingsSession;
  readonly #listeners = new Set<() => void>();
  #mode: VimMode = "normal";

  constructor(settings: SettingsSession) {
    this.#settings = settings;
  }

  get isEnabled(): boolean {
    return this.#settings.settings.vimMode === true;
  }

  /** `null` while Vim mode is off. */
  get mode(): VimMode | null {
    return this.isEnabled ? this.#mode : null;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    const stopListeningToSettings = this.#settings.subscribe(listener);
    return () => {
      this.#listeners.delete(listener);
      stopListeningToSettings();
    };
  };

  setEnabled(isEnabled: boolean): void {
    if (isEnabled) {
      this.#mode = "normal";
    }
    this.#settings.change((settings) => ({ ...settings, vimMode: isEnabled }));
  }

  readonly report = (mode: VimMode): void => {
    if (this.#mode === mode) {
      return;
    }
    this.#mode = mode;
    this.#listeners.forEach((listener) => listener());
  };
}
