import { recheckPreviewHtml } from "./recheckPreviewHtml";
import { renderMarkdown } from "./renderMarkdown";
import { sanitizePreviewHtml } from "./sanitizePreviewHtml";

/** The only way from a body to HTML the preview may show. */
export function renderPreviewHtml(body: string): string {
  return recheckPreviewHtml(sanitizePreviewHtml(renderMarkdown(body)));
}
