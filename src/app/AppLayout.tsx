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
  workspaces: ReactNode;
  articles: ReactNode;
  editor: ReactNode;
  preview?: PreviewSlot;
  workspacesFooter?: ReactNode;
};

/**
 * The four columns, left to right. The editor and an open preview share the
 * writing area, split by a draggable divider; a folded preview leaves only a
 * handle at the edge, and the editor takes its width.
 */
export function AppLayout({ workspaces, articles, editor, preview, workspacesFooter }: AppLayoutProps) {
  const messages = useMessages();
  return (
    <main className="app-layout">
      <LayoutRegion
        title={messages.workspacesTitle}
        label={messages.sidebar}
        className="workspaces-region"
        footer={workspacesFooter}
      >
        {workspaces}
      </LayoutRegion>
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
  footer?: ReactNode;
  children: ReactNode;
};

function LayoutRegion({ title, label, className, action, flexBasis, footer, children }: LayoutRegionProps) {
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
      {footer !== undefined && <div className="region-footer">{footer}</div>}
    </section>
  );
}
