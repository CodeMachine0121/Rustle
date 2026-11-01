import type { ReactNode } from "react";

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

type AppLayoutProps = {
  sidebar: ReactNode;
  articles: ReactNode;
  editor: ReactNode;
  preview: PreviewSlot;
  writing: WritingLayoutSnapshot;
  controls: WritingControls;
  sidebarFooter?: ReactNode;
};

/**
 * The four columns, left to right: the sidebar (its sections carry their
 * own titles) with the settings entry at its foot, the articles, the editor and
 * the preview. The view mode decides which of the editor and the preview
 * share the writing area; Zen Mode hides the first two columns. Hidden
 * columns stay mounted, so the editor keeps its text, cursor, undo history
 * and composition through every change.
 */
export function AppLayout({ sidebar, articles, editor, preview, writing, controls, sidebarFooter }: AppLayoutProps) {
  const messages = useMessages();
  const { viewMode, isZen, controlsLiveIn } = writing;
  const controlsFor = (region: WritingLayoutSnapshot["controlsLiveIn"]) =>
    region === controlsLiveIn ? controls : undefined;
  return (
    <main className="app-layout">
      <nav className="layout-region sidebar-region" aria-label={messages.sidebar} hidden={isZen}>
        <div className="region-body">{sidebar}</div>
        {sidebarFooter !== undefined && <div className="region-footer">{sidebarFooter}</div>}
      </nav>
      <LayoutRegion title={messages.articlesTitle} label={messages.articlesRegion} className="articles-region" hidden={isZen}>
        {articles}
      </LayoutRegion>
      <div className="writing-area">
        <LayoutRegion
          title={messages.editorTitle}
          label={messages.editorRegion}
          className="editor-region"
          hidden={viewMode === "previewOnly"}
          controls={controlsFor("editor")}
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
  flexBasis?: string;
  children: ReactNode;
};

function LayoutRegion({ title, label, className, hidden = false, controls, flexBasis, children }: LayoutRegionProps) {
  return (
    <section
      className={`layout-region ${className}`}
      aria-label={label}
      hidden={hidden}
      style={flexBasis === undefined ? undefined : { flexBasis }}
    >
      <div className="region-header">
        {controls?.zenButton}
        <h2 className="region-title">{title}</h2>
        {controls?.viewModeButtons}
      </div>
      <div className="region-body">{children}</div>
    </section>
  );
}
