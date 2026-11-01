import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { NoArticleState } from "../vault/NoArticleState";
import type { PreviewedBody } from "./PreviewedBody";
import { PreviewScrollPane } from "./PreviewScrollPane";
import { renderPreviewHtml } from "./renderPreviewHtml";
import type { ScrollSynchronizer } from "./ScrollSynchronizer";

type PreviewPanelProps = {
  previewedBody: PreviewedBody;
  scrollSynchronizer?: ScrollSynchronizer;
};

/** The rendered body; while one is shown it is the preview side of the scroll sync. */
export function PreviewPanel({ previewedBody, scrollSynchronizer }: PreviewPanelProps) {
  const body = useSyncExternalStore(previewedBody.subscribe, () => previewedBody.body);
  if (body === null) {
    return <NoArticleState />;
  }
  return <PreviewContent body={body} scrollSynchronizer={scrollSynchronizer} />;
}

type PreviewContentProps = {
  body: string;
  scrollSynchronizer?: ScrollSynchronizer;
};

function PreviewContent({ body, scrollSynchronizer }: PreviewContentProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderPreviewHtml(body), [body]);
  const lineCount = useMemo(() => body.split("\n").length, [body]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null || scrollSynchronizer === undefined) {
      return;
    }
    const attached = scrollSynchronizer.attach("preview", new PreviewScrollPane(scroller, lineCount));
    scroller.addEventListener("scroll", attached.scrolled, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", attached.scrolled);
      attached.detach();
    };
  }, [scrollSynchronizer, lineCount]);

  return (
    <div className="preview-scroller" ref={scrollerRef}>
      <article
        className="preview-content"
        aria-label="預覽內容"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
