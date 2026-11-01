import type { ReactNode } from "react";

import { useMessages } from "../features/interfaceLanguage/InterfaceLanguageContext";
import { PaneDivider } from "../features/preview/PaneDivider";
import type { PreviewWidth } from "../features/preview/PreviewWidth";

export type PreviewSlot = {
  isOpen: boolean;
  content: ReactNode;
  onOpen: () => void;
  onClose: () => void;
  width: PreviewWidth;
  onResize: (width: PreviewWidth) => void;
  onResizeEnd: (width: PreviewWidth) => void;
};

type AppLayoutProps = {
  sidebar: ReactNode;
  articles: ReactNode;
  editor: ReactNode;
  preview?: PreviewSlot;
  sidebarFooter?: ReactNode;
};

/**
 * The four columns, left to right: the sidebar (its sections carry their
 * own titles) with the settings entry at its foot, the articles, the editor and
 * the preview. The editor and an open preview share the
 * writing area, split by a draggable divider; a folded preview leaves only a
 * handle at the edge, and the editor takes its width.
 */
export function AppLayout({ sidebar, articles, editor, preview, sidebarFooter }: AppLayoutProps) {
  const messages = useMessages();
  return (
    <main className="app-layout">
      <nav className="layout-region sidebar-region" aria-label={messages.sidebar}>
        <div className="region-body">{sidebar}</div>
        {sidebarFooter !== undefined && <div className="region-footer">{sidebarFooter}</div>}
      </nav>
      <LayoutRegion title={messages.articlesTitle} label={messages.articlesRegion} className="articles-region">
        {articles}
      </LayoutRegion>
      <div className="writing-area">
        <LayoutRegion title={messages.editorTitle} label={messages.editorRegion} className="editor-region">
          {editor}
        </LayoutRegion>
        {preview !== undefined && <PreviewColumn preview={preview} />}
      </div>
    </main>
  );
}

function PreviewColumn({ preview }: { preview: PreviewSlot }) {
  const messages = useMessages();
  if (!preview.isOpen) {
    return (
      <button type="button" className="preview-handle" aria-label={messages.openPreview} onClick={preview.onOpen}>
        {messages.openPreviewHandle}
      </button>
    );
  }
  return (
    <>
      <PaneDivider
        width={preview.width}
        onResize={preview.onResize}
        onResizeEnd={preview.onResizeEnd}
      />
      <LayoutRegion
        title={messages.previewTitle}
        label={messages.previewRegion}
        className="preview-region"
        flexBasis={`${preview.width.ratio * 100}%`}
        action={
          <button
            type="button"
            className="region-action"
            aria-label={messages.closePreview}
            onClick={preview.onClose}
          >
            ✕
          </button>
        }
      >
        {preview.content}
      </LayoutRegion>
    </>
  );
}

type LayoutRegionProps = {
  title: string;
  label: string;
  className: string;
  action?: ReactNode;
  flexBasis?: string;
  children: ReactNode;
};

function LayoutRegion({ title, label, className, action, flexBasis, children }: LayoutRegionProps) {
  return (
    <section
      className={`layout-region ${className}`}
      aria-label={label}
      style={flexBasis === undefined ? undefined : { flexBasis }}
    >
      <div className="region-header">
        <h2 className="region-title">{title}</h2>
        {action}
      </div>
      <div className="region-body">{children}</div>
    </section>
  );
}
