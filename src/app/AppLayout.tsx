import type { ReactNode } from "react";

type AppLayoutProps = {
  workspaces: ReactNode;
  articles: ReactNode;
  editor: ReactNode;
  preview?: ReactNode;
};

/** The four columns, left to right. Without a preview the editor takes its width. */
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
      {preview !== undefined && (
        <LayoutRegion title="PREVIEW" className="preview-region">
          {preview}
        </LayoutRegion>
      )}
    </main>
  );
}

type LayoutRegionProps = {
  title: string;
  className: string;
  children: ReactNode;
};

function LayoutRegion({ title, className, children }: LayoutRegionProps) {
  return (
    <section className={`layout-region ${className}`} aria-label={title}>
      <h2 className="region-title">{title}</h2>
      <div className="region-body">{children}</div>
    </section>
  );
}
