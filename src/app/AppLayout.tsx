import type { ReactNode } from "react";

import { FONT_SIZE_SURFACE_ATTRIBUTE, type FontSizeSurface } from "../features/fontSize/EditingSurfaceFontSizes";
import { useMessages } from "../features/interfaceLanguage/InterfaceLanguageContext";
import { PaneDivider } from "../features/preview/PaneDivider";
import type { PreviewWidth } from "../features/preview/PreviewWidth";
import type { WritingLayoutSnapshot } from "../features/writingLayout/WritingLayout";

export type PreviewSlot = {
  content: ReactNode;
  width: PreviewWidth;
  onResize: (width: PreviewWidth) => void;
  onResizeEnd: (width: PreviewWidth) => void;
};

/** Whether the sidebar is folded away, and the button that folds it, shown at the head of the articles. */
export type SidebarFoldSlot = {
  isFolded: boolean;
  button: ReactNode;
};

type AppLayoutProps = {
  sidebar: ReactNode;
  articles: ReactNode;
  editor: ReactNode;
  preview: PreviewSlot;
  writing: WritingLayoutSnapshot;
  /** Across the top of the writing sheet, whatever the view mode. */
  toolbar: ReactNode;
  /** Across the bottom of the writing sheet, whatever the view mode. */
  statusLine?: ReactNode;
  sidebarFooter?: ReactNode;
  sidebarFold?: SidebarFoldSlot;
};

/**
 * The four columns, left to right: the sidebar with the settings entry at
 * its foot, the articles, then the editor and the preview on one writing
 * sheet between its toolbar and its status line. The view mode decides which
 * of the editor and the preview share the sheet; Zen Mode hides the first two
 * columns, and a folded sidebar hides only the first, without Zen Mode ever
 * changing the fold. Hidden columns stay mounted, so the editor keeps its
 * text, cursor, undo history and composition through every change.
 */
export function AppLayout({
  sidebar,
  articles,
  editor,
  preview,
  writing,
  toolbar,
  statusLine,
  sidebarFooter,
  sidebarFold,
}: AppLayoutProps) {
  const messages = useMessages();
  const { viewMode, isZen } = writing;
  return (
    <main className="app-layout">
      <nav
        className="layout-region sidebar-region"
        aria-label={messages.sidebar}
        hidden={isZen || sidebarFold?.isFolded === true}
      >
        <div className="region-body">{sidebar}</div>
        {sidebarFooter !== undefined && <div className="region-footer">{sidebarFooter}</div>}
      </nav>
      <LayoutRegion
        label={messages.articlesRegion}
        className="articles-region"
        hidden={isZen}
        header={sidebarFold?.button}
      >
        {articles}
      </LayoutRegion>
      <div className="writing-area">
        <div className="writing-sheet">
          {toolbar}
          <div className="writing-panes">
            <LayoutRegion
              label={messages.editorRegion}
              className="editor-region"
              hidden={viewMode === "previewOnly"}
              fontSizeSurface="editor"
            >
              {editor}
            </LayoutRegion>
            {viewMode === "sideBySide" && (
              <PaneDivider width={preview.width} onResize={preview.onResize} onResizeEnd={preview.onResizeEnd} />
            )}
            {viewMode !== "editorOnly" && (
              <LayoutRegion
                label={messages.previewRegion}
                className="preview-region"
                flexBasis={viewMode === "sideBySide" ? `${preview.width.ratio * 100}%` : "100%"}
                fontSizeSurface="preview"
              >
                {preview.content}
              </LayoutRegion>
            )}
          </div>
          {statusLine}
        </div>
      </div>
    </main>
  );
}

type LayoutRegionProps = {
  label: string;
  className: string;
  hidden?: boolean;
  header?: ReactNode;
  flexBasis?: string;
  fontSizeSurface?: FontSizeSurface;
  children: ReactNode;
};

function LayoutRegion({ label, className, hidden = false, header, flexBasis, fontSizeSurface, children }: LayoutRegionProps) {
  return (
    <section
      {...{ [FONT_SIZE_SURFACE_ATTRIBUTE]: fontSizeSurface }}
      className={`layout-region ${className}`}
      aria-label={label}
      hidden={hidden}
      style={flexBasis === undefined ? undefined : { flexBasis }}
    >
      {header !== undefined && <div className="region-header">{header}</div>}
      <div className="region-body">{children}</div>
    </section>
  );
}
