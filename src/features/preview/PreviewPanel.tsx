import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { NoArticleState } from "../vault/NoArticleState";
import type { PreviewedBody } from "./PreviewedBody";
import { PreviewScrollPane } from "./PreviewScrollPane";
import { renderPreviewHtml } from "./renderPreviewHtml";
import type { ScrollSynchronizer } from "./ScrollSynchronizer";

type PreviewPanelProps = {
  previewedBody: PreviewedBody;
  scrollSynchronizer?: ScrollSynchronizer;
  fontSizePixels?: number;
};

/**
 * The rendered body; while one is shown it is the preview side of the scroll
 * sync. Everything in the article is sized relative to `fontSizePixels`.
 */
export function PreviewPanel({ previewedBody, scrollSynchronizer, fontSizePixels }: PreviewPanelProps) {
  const body = useSyncExternalStore(previewedBody.subscribe, () => previewedBody.body);
  const workspace = useSyncExternalStore(previewedBody.subscribe, () => previewedBody.workspace);
  if (body === null) {
    return <NoArticleState />;
  }
  return (
    <PreviewContent
      body={body}
      workspace={workspace}
      scrollSynchronizer={scrollSynchronizer}
      fontSizePixels={fontSizePixels}
    />
  );
}

type PreviewContentProps = {
  body: string;
  workspace: string | null;
  scrollSynchronizer?: ScrollSynchronizer;
  fontSizePixels?: number;
};

function PreviewContent({ body, workspace, scrollSynchronizer, fontSizePixels }: PreviewContentProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const messages = useMessages();
  const html = useMemo(() => renderPreviewHtml(body, workspace), [body, workspace]);
  const lineCount = useMemo(() => body.split("\n").length, [body]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null || scrollSynchronizer === undefined) {
      return;
    }
    return scrollSynchronizer.attach("preview", new PreviewScrollPane(scroller, lineCount));
  }, [scrollSynchronizer, lineCount]);

  return (
    <div className="preview-scroller" ref={scrollerRef}>
      <article
        className="preview-content"
        aria-label={messages.previewContent}
        style={fontSizePixels === undefined ? undefined : { fontSize: `${fontSizePixels}px` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
