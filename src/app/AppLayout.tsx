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

/** What the header of the region carrying the controls shows on its left and right. */
export type WritingControls = {
  zenButton: ReactNode;
  viewModeButtons: ReactNode;
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
  controls: WritingControls;
  sidebarFooter?: ReactNode;
  sidebarFold?: SidebarFoldSlot;
};

/**
 * The four columns, left to right: the sidebar (its sections carry their
 * own titles) with the settings entry at its foot, the articles, the editor and
 * the preview. The view mode decides which of the editor and the preview
 * share the writing area; Zen Mode hides the first two columns, and a folded
 * sidebar hides only the first, without Zen Mode ever changing the fold. Hidden
 * columns stay mounted, so the editor keeps its text, cursor, undo history
 * and composition through every change.
 */
export function AppLayout({
  sidebar,
  articles,
  editor,
  preview,
  writing,
  controls,
  sidebarFooter,
  sidebarFold,
}: AppLayoutProps) {
  const messages = useMessages();
  const { viewMode, isZen, controlsLiveIn } = writing;
  const controlsFor = (region: WritingLayoutSnapshot["controlsLiveIn"]) =>
    region === controlsLiveIn ? controls : undefined;
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
        title={messages.articlesTitle}
        label={messages.articlesRegion}
        className="articles-region"
        hidden={isZen}
        leadingControl={sidebarFold?.button}
      >
        {articles}
      </LayoutRegion>
      <div className="writing-area">
        <LayoutRegion
          title={messages.editorTitle}
          label={messages.editorRegion}
          className="editor-region"
          hidden={viewMode === "previewOnly"}
          controls={controlsFor("editor")}
          fontSizeSurface="editor"
        >
          {editor}
        </LayoutRegion>
        {viewMode === "sideBySide" && (
          <PaneDivider width={preview.width} onResize={preview.onResize} onResizeEnd={preview.onResizeEnd} />
        )}
        {viewMode !== "editorOnly" && (
          <LayoutRegion
            title={messages.previewTitle}
            label={messages.previewRegion}
            className="preview-region"
            flexBasis={viewMode === "sideBySide" ? `${preview.width.ratio * 100}%` : "100%"}
            controls={controlsFor("preview")}
            fontSizeSurface="preview"
          >
            {preview.content}
          </LayoutRegion>
        )}
      </div>
    </main>
  );
}

type LayoutRegionProps = {
  title: string;
  label: string;
  className: string;
  hidden?: boolean;
  controls?: WritingControls;
  leadingControl?: ReactNode;
  flexBasis?: string;
  fontSizeSurface?: FontSizeSurface;
  children: ReactNode;
};

function LayoutRegion({
  title,
  label,
  className,
  hidden = false,
  controls,
  leadingControl,
  flexBasis,
  fontSizeSurface,
  children,
}: LayoutRegionProps) {
  return (
    <section
      {...{ [FONT_SIZE_SURFACE_ATTRIBUTE]: fontSizeSurface }}
      className={`layout-region ${className}`}
      aria-label={label}
      hidden={hidden}
      style={flexBasis === undefined ? undefined : { flexBasis }}
    >
      <div className="region-header">
        {leadingControl}
        {controls?.zenButton}
        <h2 className="region-title">{title}</h2>
        {controls?.viewModeButtons}
      </div>
      <div className="region-body">{children}</div>
    </section>
  );
}
