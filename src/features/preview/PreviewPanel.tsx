import { useMemo, useSyncExternalStore } from "react";

import { NoArticleState } from "../vault/NoArticleState";
import type { PreviewedBody } from "./PreviewedBody";
import { renderPreviewHtml } from "./renderPreviewHtml";

type PreviewPanelProps = {
  previewedBody: PreviewedBody;
};

export function PreviewPanel({ previewedBody }: PreviewPanelProps) {
  const body = useSyncExternalStore(previewedBody.subscribe, () => previewedBody.body);
  if (body === null) {
    return <NoArticleState />;
  }
  return <PreviewContent body={body} />;
}

function PreviewContent({ body }: { body: string }) {
  const html = useMemo(() => renderPreviewHtml(body), [body]);
  return (
    <article
      className="preview-content"
      aria-label="預覽內容"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
