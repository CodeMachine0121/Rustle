/** The attribute that carries a block's zero-based line in the body. Scroll sync reads it. */
export const SOURCE_LINE_ATTRIBUTE = "data-source-line";

export const ALLOWED_ELEMENTS: readonly string[] = [
  "a", "abbr", "b", "blockquote", "br", "caption", "code", "dd", "del", "details", "div", "dl",
  "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins",
  "kbd", "li", "mark", "ol", "p", "pre", "q", "s", "samp", "small", "span", "strong", "sub",
  "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "var",
];

export const ALLOWED_ATTRIBUTES: readonly string[] = [
  "href", "src", "alt", "title", "class", "start", "colspan", "rowspan", "role", "aria-checked",
  "aria-disabled", SOURCE_LINE_ATTRIBUTE,
];

const ALLOWED_SCHEMES: Readonly<Record<string, readonly string[]>> = {
  href: ["http", "https", "mailto"],
  src: ["rustle"],
};

/** Every scheme some attribute allows, for a sanitizer that checks all URL attributes alike. */
export const ALLOWED_URL_SCHEMES: readonly string[] = Object.values(ALLOWED_SCHEMES).flat();

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const NETWORK_PATH = /^[/\\]{2}/;
const DELETE_CHARACTER = "\u007f";

export function allowsElement(name: string): boolean {
  return ALLOWED_ELEMENTS.includes(name.toLowerCase());
}

/** Relative URLs are always allowed; an absolute one only with a scheme listed for its attribute. */
export function allowsAttribute(name: string, value: string): boolean {
  const attribute = name.toLowerCase();
  if (!ALLOWED_ATTRIBUTES.includes(attribute)) {
    return false;
  }
  const schemes = ALLOWED_SCHEMES[attribute];
  if (schemes === undefined) {
    return true;
  }
  // Browsers skip control characters and spaces, so "java\tscript:" is still "javascript:".
  const url = Array.from(value)
    .filter((character) => character > " " && character !== DELETE_CHARACTER)
    .join("");
  if (NETWORK_PATH.test(url)) {
    return false;
  }
  const scheme = SCHEME.exec(url)?.[1]?.toLowerCase();
  return scheme === undefined || schemes.includes(scheme);
}
