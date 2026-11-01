import { recheckPreviewHtml } from "./recheckPreviewHtml";
import { renderMarkdown } from "./renderMarkdown";
import { sanitizePreviewHtml } from "./sanitizePreviewHtml";

/** The only way from a body to HTML the preview may show; `workspace` is the one the body belongs to. */
export function renderPreviewHtml(body: string, workspace: string | null = null): string {
  return recheckPreviewHtml(sanitizePreviewHtml(renderMarkdown(body, workspace)));
}
