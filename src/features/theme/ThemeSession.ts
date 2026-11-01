import type { SettingsSession } from "../settings/SettingsSession";
import type { Theme } from "./Theme";
import type { ThemeCatalog, ThemeChoice } from "./ThemeCatalog";

/** The last window's choice, kept on this machine so the next first frame is right. */
export type ThemeCache = {
  read: () => string | null;
  write: (choice: ThemeChoice) => void;
};

export type SystemAppearance = {
  isDark: () => boolean;
  /** Calls `listener` whenever the system switches between light and dark; returns the stop. */
  watch: (listener: () => void) => () => void;
};

export type ThemeEnvironment = {
  catalog: ThemeCatalog;
  cache: ThemeCache;
  system: SystemAppearance;
  root: HTMLElement;
};

export type ThemeMenu = {
  choice: ThemeChoice;
  themes: readonly Theme[];
  choose: (choice: ThemeChoice) => void;
};

/** Paints the cached choice; call before the first render so the first frame is never another theme. */
export function paintCachedTheme({ catalog, cache, system, root }: ThemeEnvironment): ThemeChoice {
  const choice = catalog.choiceFor(cache.read());
  catalog.resolve(choice, system.isDark())?.applyTo(root);
  return choice;
}

/**
 * The theme in use. It starts from the cache and follows the settings only
 * once their file is read, so the cache only ever remembers the file's
 * choice. Following the system repaints with its light or dark. The screen
 * changes first; the settings write comes after.
 */
export class ThemeSession {
  readonly #settings: SettingsSession;
  readonly #environment: ThemeEnvironment;
  readonly #listeners = new Set<() => void>();
  readonly #stops: (() => void)[];
  #menu: ThemeMenu;

  constructor(settings: SettingsSession, environment: ThemeEnvironment) {
    this.#settings = settings;
    this.#environment = environment;
    this.#menu = this.#menuFor(paintCachedTheme(environment));
    this.#stops = [
      settings.subscribe(() => {
        if (settings.wasRead) {
          this.#show(environment.catalog.choiceFor(settings.settings.theme), { remember: true });
        }
      }),
      environment.system.watch(() => this.#paint()),
    ];
  }

  get menu(): ThemeMenu {
    return this.#menu;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  dispose(): void {
    this.#stops.forEach((stop) => stop());
  }

  #show(choice: ThemeChoice, { remember }: { remember: boolean }): void {
    if (choice !== this.#menu.choice) {
      this.#menu = this.#menuFor(choice);
      this.#paint();
      if (remember) {
        this.#environment.cache.write(choice);
      }
      this.#listeners.forEach((listener) => listener());
    }
  }

  #paint(): void {
    const { catalog, system, root } = this.#environment;
    catalog.resolve(this.#menu.choice, system.isDark())?.applyTo(root);
  }

  #menuFor(choice: ThemeChoice): ThemeMenu {
    return {
      choice,
      themes: this.#environment.catalog.themes,
      choose: (chosen) => {
        if (chosen !== this.#menu.choice) {
          if (!this.#settings.wasRead) {
            this.#show(chosen, { remember: false });
          }
          this.#settings.change((settings) => ({ ...settings, theme: chosen }));
        }
      },
    };
  }
}
