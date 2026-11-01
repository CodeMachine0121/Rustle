import type { Channels } from "../../ipc/channels";
import type { Settings } from "../../ipc/settings";

export type SettingsChannels = Pick<Channels, "readSettings" | "writeSettings">;

export const DEFAULT_SETTINGS: Settings = {
  indentation: { style: "spaces", width: 2 },
  previewPanel: { isOpen: true, widthRatio: 0.5 },
  lastOpened: { workspace: null, article: null },
};

/**
 * The webview's one copy of the settings. Every feature changes them here,
 * so no feature writes back a stale copy over another's change. Settings
 * that could not be read still change on screen but are never written:
 * that would replace the user's file with defaults.
 */
export class SettingsSession {
  readonly #channels: SettingsChannels;
  readonly #listeners = new Set<() => void>();
  #settings = DEFAULT_SETTINGS;
  #wasRead = false;

  constructor(channels: SettingsChannels) {
    this.#channels = channels;
  }

  get settings(): Settings {
    return this.#settings;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  async load(): Promise<void> {
    const result = await this.#channels.readSettings();
    if (result.ok) {
      this.#wasRead = true;
      this.#replace(result.payload);
    }
  }

  change(update: (settings: Settings) => Settings): void {
    this.#replace(update(this.#settings));
    if (this.#wasRead) {
      // Settings are a convenience, not the user's writing: a file that
      // cannot be written must not get in the way.
      void this.#channels.writeSettings(this.#settings);
    }
  }

  #replace(settings: Settings): void {
    this.#settings = settings;
    this.#listeners.forEach((listener) => listener());
  }
}
