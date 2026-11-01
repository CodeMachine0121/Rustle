import DOMPurify from "dompurify";

import { ALLOWED_ATTRIBUTES, ALLOWED_ELEMENTS, allowsAttribute } from "./PreviewHtmlPolicy";

const purifier = DOMPurify(window);

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
    // Scheme rules per attribute live in the policy; this only stops the
    // sanitizer from dropping the vault's own image scheme first.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|rustle):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
