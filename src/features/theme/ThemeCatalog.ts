import { Theme } from "./Theme";

export const FOLLOW_SYSTEM = "followSystem";

/** `FOLLOW_SYSTEM`, or the id of a theme in the catalog. */
export type ThemeChoice = string;

/**
 * The themes the menu offers, in the order of their file names. A file that
 * is not a usable theme is left out, as is a second theme with a taken id.
 */
export class ThemeCatalog {
  readonly themes: readonly Theme[];

  constructor(files: Readonly<Record<string, unknown>>) {
    const themes: Theme[] = [];
    Object.keys(files)
      .sort()
      .forEach((fileName) => {
        const theme = Theme.parse(files[fileName]);
        if (theme !== null && theme.id !== FOLLOW_SYSTEM && !themes.some((taken) => taken.id === theme.id)) {
          themes.push(theme);
        }
      });
    this.themes = themes;
  }

  /** Every theme file shipped in `themes/`; a new theme is one more file there. */
  static shipped(): ThemeCatalog {
    return new ThemeCatalog(import.meta.glob("./themes/*.json", { eager: true, import: "default" }));
  }

  /** What a remembered name means today: a theme in the catalog, or following the system. */
  choiceFor(remembered: string | null | undefined): ThemeChoice {
    return this.themes.some((theme) => theme.id === remembered) ? (remembered as string) : FOLLOW_SYSTEM;
  }

  /** The theme to paint; following the system is the light or the dark theme. */
  resolve(choice: ThemeChoice, systemIsDark: boolean): Theme | null {
    const systemTheme = systemIsDark ? "dark" : "light";
    const id = this.choiceFor(choice) === FOLLOW_SYSTEM ? systemTheme : choice;
    return this.themes.find((theme) => theme.id === id) ?? null;
  }
}
