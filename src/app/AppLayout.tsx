import type { ReactNode } from "react";

export type PreviewSlot = {
  isOpen: boolean;
  content: ReactNode;
  onOpen: () => void;
  onClose: () => void;
};

type AppLayoutProps = {
  workspaces: ReactNode;
  articles: ReactNode;
  editor: ReactNode;
  preview?: PreviewSlot;
};

/**
 * The four columns, left to right. A folded preview leaves only a handle at
 * the edge, and the editor takes its width.
 */
export function AppLayout({ workspaces, articles, editor, preview }: AppLayoutProps) {
  return (
    <main className="app-layout">
      <LayoutRegion title="WORKSPACES" className="workspaces-region">
        {workspaces}
      </LayoutRegion>
      <LayoutRegion title="ARTICLES" className="articles-region">
        {articles}
      </LayoutRegion>
      <LayoutRegion title="EDITOR" className="editor-region">
        {editor}
      </LayoutRegion>
      {preview !== undefined &&
        (preview.isOpen ? (
          <LayoutRegion
            title="PREVIEW"
            className="preview-region"
            action={
              <button
                type="button"
                className="region-action"
                aria-label="關閉預覽"
                onClick={preview.onClose}
              >
                ✕
              </button>
            }
          >
            {preview.content}
          </LayoutRegion>
        ) : (
          <button
            type="button"
            className="preview-handle"
            aria-label="開啟預覽"
            onClick={preview.onOpen}
          >
            ◀ 預覽
          </button>
        ))}
    </main>
  );
}

type LayoutRegionProps = {
  title: string;
  className: string;
  action?: ReactNode;
  children: ReactNode;
};

function LayoutRegion({ title, className, action, children }: LayoutRegionProps) {
  return (
    <section className={`layout-region ${className}`} aria-label={title}>
      <div className="region-header">
        <h2 className="region-title">{title}</h2>
        {action}
      </div>
      <div className="region-body">{children}</div>
    </section>
  );
}
