import DOMPurify from "dompurify";

import {
  ALLOWED_ATTRIBUTES,
  ALLOWED_ELEMENTS,
  ALLOWED_URL_SCHEMES,
  allowsAttribute,
} from "./PreviewHtmlPolicy";

const purifier = DOMPurify(window);

// Scheme rules per attribute live in the policy; this only keeps the
// sanitizer from dropping a scheme the policy allows, such as the vault's.
const ALLOWED_URI = new RegExp(
  `^(?:(?:${ALLOWED_URL_SCHEMES.join("|")}):|[^a-z]|[a-z+.-]+(?:[^a-z+.\\-:]|$))`,
  "i",
);

purifier.addHook("uponSanitizeAttribute", (_element, data) => {
  if (!allowsAttribute(data.attrName, data.attrValue)) {
    data.keepAttr = false;
  }
});

/** The first net: a mature sanitizer held to the preview's allowlist. */
export function sanitizePreviewHtml(html: string): string {
  return purifier.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_ELEMENTS],
    ALLOWED_ATTR: [...ALLOWED_ATTRIBUTES],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORCE_BODY: true,
    ALLOWED_URI_REGEXP: ALLOWED_URI,
  });
}
