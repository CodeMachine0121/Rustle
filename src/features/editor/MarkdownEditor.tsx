import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";

import type { CompositionState } from "../../shared/composition/CompositionState";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import { IndentUnit, type IndentationSettings } from "./IndentUnit";
import { TabIndentation } from "./TabIndentation";

type MarkdownEditorProps = {
  documentKey: string;
  body: string;
  indentation?: IndentationSettings;
};

/**
 * One editor for the app's lifetime. Another document key replaces the
 * document (with its own undo history) without rebuilding the editable
 * element, and never while an input method is composing: it waits for the
 * composition to end. The key, not the body, decides: two articles with the
 * same text are still two documents.
 */
export function MarkdownEditor({ documentKey, body, indentation }: MarkdownEditorProps) {
  const composition = useCompositionState();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const shownDocumentRef = useRef<string | null>(null);
  const [indentationCompartment] = useState(() => new Compartment());

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
          extensions: editorExtensions(composition, indentationCompartment.of(tabIndentation)),
        }),
      );
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
  }, [composition, documentKey, body, indentationStyle, indentationWidth, indentationCompartment]);

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
