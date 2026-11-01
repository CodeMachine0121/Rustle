import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";

import type { CompositionState } from "../../shared/composition/CompositionState";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import type { ImagePaste } from "../imagePaste/ImagePaste";
import type { ScrollSynchronizer } from "../preview/ScrollSynchronizer";
import { cursorLineHighlight } from "./cursorLineHighlight";
import { EditorScrollPane } from "./EditorScrollPane";
import { EmphasisShortcuts } from "./EmphasisShortcuts";
import { IndentUnit, type IndentationSettings } from "./IndentUnit";
import { TableRowContinuation } from "./TableRowContinuation";
import { TabIndentation } from "./TabIndentation";
import { xcodeTheme } from "./xcodeTheme";

// Mod-I is italic now; selecting the enclosing syntax node is retired.
const editorDefaultKeymap = defaultKeymap.filter((binding) => binding.key !== "Mod-i");

type BodyChangeListener = (body: string) => void;

type MarkdownEditorProps = {
  documentKey: string;
  body: string;
  indentation?: IndentationSettings;
  focusOnShow?: boolean;
  imagePaste?: ImagePaste;
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
  imagePaste,
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
    return scrollSynchronizer.attach("editor", new EditorScrollPane(view));
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
            imagePaste?.extension() ?? [],
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
    imagePaste,
    indentationStyle,
    indentationWidth,
    indentationCompartment,
  ]);

  return <div className="markdown-editor" ref={hostRef} />;
}

function editorExtensions(composition: CompositionState, tabIndentation: Extension) {
  return [
    tabIndentation,
    new TableRowContinuation(composition).extension(),
    new EmphasisShortcuts(composition).extension(),
    history(),
    keymap.of([...editorDefaultKeymap, ...historyKeymap]),
    markdown(),
    xcodeTheme(),
    cursorLineHighlight(),
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
