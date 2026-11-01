import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";

import type { CompositionState } from "../../shared/composition/CompositionState";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import type { ScrollSynchronizer } from "../preview/ScrollSynchronizer";
import { EditorScrollPane } from "./EditorScrollPane";
import { IndentUnit, type IndentationSettings } from "./IndentUnit";
import { TabIndentation } from "./TabIndentation";

type BodyChangeListener = (body: string) => void;

type MarkdownEditorProps = {
  documentKey: string;
  body: string;
  indentation?: IndentationSettings;
  focusOnShow?: boolean;
  onBodyChange?: BodyChangeListener;
  scrollSynchronizer?: ScrollSynchronizer;
};

/**
 * One editor for the app's lifetime. Another document key replaces the
 * document (with its own undo history) without rebuilding the editable
 * element, and never while an input method is composing: it waits for the
 * composition to end. The key, not the body, decides: two articles with the
 * same text are still two documents. Only typing is reported as a change,
 * not a document being shown. With `focusOnShow` the editor takes the
 * keyboard when the document appears, cursor at its start; otherwise focus
 * stays where it is, so opening an article from the list keeps the list.
 * With a `scrollSynchronizer` the editor is its editor side while mounted.
 */
export function MarkdownEditor({
  documentKey,
  body,
  indentation,
  focusOnShow = false,
  onBodyChange,
  scrollSynchronizer,
}: MarkdownEditorProps) {
  const composition = useCompositionState();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const shownDocumentRef = useRef<string | null>(null);
  const onBodyChangeRef = useRef(onBodyChange);
  const [indentationCompartment] = useState(() => new Compartment());

  useEffect(() => {
    onBodyChangeRef.current = onBodyChange;
  }, [onBodyChange]);

  const indentationStyle = indentation?.style;
  const indentationWidth = indentation?.width;

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }
    viewRef.current = new EditorView({ parent: host });
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
      shownDocumentRef.current = null;
      composition.end();
    };
  }, [composition]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null || scrollSynchronizer === undefined) {
      return;
    }
    const attached = scrollSynchronizer.attach("editor", new EditorScrollPane(view));
    view.scrollDOM.addEventListener("scroll", attached.scrolled, { passive: true });
    return () => {
      view.scrollDOM.removeEventListener("scroll", attached.scrolled);
      attached.detach();
    };
  }, [scrollSynchronizer]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) {
      return;
    }
    const unit =
      indentationStyle === undefined || indentationWidth === undefined
        ? IndentUnit.from()
        : IndentUnit.from({ style: indentationStyle, width: indentationWidth });
    const tabIndentation = new TabIndentation(composition, unit).extension();
    const show = () => {
      if (shownDocumentRef.current === documentKey) {
        view.dispatch({ effects: indentationCompartment.reconfigure(tabIndentation) });
        return;
      }
      shownDocumentRef.current = documentKey;
      view.setState(
        EditorState.create({
          doc: body,
          extensions: [
            editorExtensions(composition, indentationCompartment.of(tabIndentation)),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onBodyChangeRef.current?.(update.state.doc.toString());
              }
            }),
          ],
        }),
      );
      if (focusOnShow) {
        view.focus();
      }
    };
    if (!composition.isComposing) {
      show();
      return;
    }
    const unsubscribe = composition.subscribe((isComposing) => {
      if (!isComposing) {
        unsubscribe();
        show();
      }
    });
    return unsubscribe;
  }, [
    composition,
    documentKey,
    body,
    focusOnShow,
    indentationStyle,
    indentationWidth,
    indentationCompartment,
  ]);

  return <div className="markdown-editor" ref={hostRef} />;
}

function editorExtensions(composition: CompositionState, tabIndentation: Extension) {
  return [
    tabIndentation,
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown(),
    syntaxHighlighting(defaultHighlightStyle),
    EditorView.lineWrapping,
    EditorView.domEventHandlers({
      compositionstart: () => {
        composition.start();
      },
      compositionend: () => {
        composition.end();
      },
      // A composition whose end event never arrives must not block switching
      // articles or Tab for the rest of the session; leaving the editor ends it.
      blur: () => {
        composition.end();
      },
    }),
  ];
}
