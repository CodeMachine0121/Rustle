import { useMemo, useSyncExternalStore } from "react";

import { NoArticleState } from "../vault/NoArticleState";
import type { PreviewedBody } from "./PreviewedBody";
import { renderPreviewHtml } from "./renderPreviewHtml";

type PreviewPanelProps = {
  previewedBody: PreviewedBody;
};

export function PreviewPanel({ previewedBody }: PreviewPanelProps) {
  const body = useSyncExternalStore(previewedBody.subscribe, () => previewedBody.body);
  const workspace = useSyncExternalStore(previewedBody.subscribe, () => previewedBody.workspace);
  if (body === null) {
    return <NoArticleState />;
  }
  return <PreviewContent body={body} workspace={workspace} />;
}

function PreviewContent({ body, workspace }: { body: string; workspace: string | null }) {
  const html = useMemo(() => renderPreviewHtml(body, workspace), [body, workspace]);
  return (
    <article
      className="preview-content"
      aria-label="預覽內容"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
