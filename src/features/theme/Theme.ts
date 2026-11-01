import type { InterfaceLanguage } from "../interfaceLanguage/interfaceLanguage";

export type Appearance = "light" | "dark";

const BASE_COLORS = [
  "editorBackground",
  "sidebarBackground",
  "articleListBackground",
  "panelBackground",
  "primaryText",
  "secondaryText",
  "divider",
  "accent",
  "red",
  "orange",
  "green",
  "blue",
  "purple",
] as const;

type BaseColor = (typeof BASE_COLORS)[number];

type Base = Record<BaseColor, string> & { appearance: Appearance };

const BLACK = "#000000";

function mix(color: string, percent: number, other: string): string {
  return `color-mix(in oklab, ${color} ${percent}%, ${other})`;
}

/**
 * The one set of rules that colours what a theme does not name. Every token
 * the stylesheet reads is a key here; a theme may override any of them.
 */
const DERIVATIONS = {
  background: (base: Base) => base.editorBackground,
  "editor-background": (base: Base) => base.editorBackground,
  sidebar: (base: Base) => base.sidebarBackground,
  "article-list": (base: Base) => base.articleListBackground,
  panel: (base: Base) => base.panelBackground,
  text: (base: Base) => base.primaryText,
  "editor-text": (base: Base) => base.primaryText,
  "muted-text": (base: Base) => base.secondaryText,
  border: (base: Base) => base.divider,
  link: (base: Base) => base.accent,
  selected: (base: Base) => mix(base.accent, base.appearance === "light" ? 14 : 28, base.articleListBackground),
  "cursor-line": (base: Base) => mix(base.accent, 6, base.editorBackground),
  warning: (base: Base) => base.orange,
  error: (base: Base) => base.red,
  success: (base: Base) => base.green,
  "code-background": (base: Base) => mix(base.panelBackground, 92, BLACK),
  "code-keyword": (base: Base) => base.purple,
  "code-string": (base: Base) => base.green,
  "code-number": (base: Base) => base.orange,
  "code-comment": (base: Base) => base.secondaryText,
  "code-title": (base: Base) => base.blue,
  "code-type": (base: Base) => base.orange,
  "editor-heading": (base: Base) => base.primaryText,
  "editor-link": (base: Base) => base.blue,
  "editor-code": (base: Base) => base.red,
  "editor-quote": (base: Base) => base.green,
  "editor-mark": (base: Base) => base.secondaryText,
  shade: () => BLACK,
} satisfies Record<string, (base: Base) => string>;

export type ThemeToken = keyof typeof DERIVATIONS;

export const THEME_TOKENS = Object.keys(DERIVATIONS) as ThemeToken[];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

type Fields = Record<string, unknown>;

function fieldsOf(value: unknown): Fields | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Fields) : null;
}

function isColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

function isName(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * One theme file, checked and turned into every colour the app paints. A
 * file that misses any base colour is not a theme; an unusable override is
 * ignored and its colour derived instead.
 */
export class Theme {
  readonly id: string;
  readonly appearance: Appearance;
  readonly tokens: Readonly<Record<ThemeToken, string>>;
  readonly #names: Record<InterfaceLanguage, string>;

  private constructor(
    id: string,
    names: Record<InterfaceLanguage, string>,
    appearance: Appearance,
    tokens: Record<ThemeToken, string>,
  ) {
    this.id = id;
    this.#names = names;
    this.appearance = appearance;
    this.tokens = tokens;
  }

  static parse(file: unknown): Theme | null {
    const fields = fieldsOf(file);
    const names = fieldsOf(fields?.name);
    const base = fieldsOf(fields?.base);
    if (fields === null || names === null || base === null) {
      return null;
    }
    const { id } = fields;
    const { zh, en } = names;
    const { appearance } = base;
    if (!isName(id) || !isName(zh) || !isName(en) || (appearance !== "light" && appearance !== "dark")) {
      return null;
    }
    if (!BASE_COLORS.every((color) => isColor(base[color]))) {
      return null;
    }
    const checkedBase = base as Base;
    const overrides = fieldsOf(fields.overrides) ?? {};
    const tokens = Object.fromEntries(
      THEME_TOKENS.map((token) => {
        const override = overrides[token];
        return [token, isColor(override) ? override : DERIVATIONS[token](checkedBase)];
      }),
    ) as Record<ThemeToken, string>;
    return new Theme(id, { zh, en }, appearance, tokens);
  }

  nameIn(language: InterfaceLanguage): string {
    return this.#names[language];
  }

  /** Repaints everything under `element`; nothing is re-rendered. */
  applyTo(element: HTMLElement): void {
    THEME_TOKENS.forEach((token) => element.style.setProperty(`--color-${token}`, this.tokens[token]));
    element.style.colorScheme = this.appearance;
  }
}
