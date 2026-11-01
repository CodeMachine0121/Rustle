import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";

import type { CompositionState } from "../../shared/composition/CompositionState";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import { IndentUnit, type IndentationSettings } from "./IndentUnit";
import { TabIndentation } from "./TabIndentation";

type BodyChangeListener = (body: string) => void;

type MarkdownEditorProps = {
  initialBody: string;
  indentation?: IndentationSettings;
  onBodyChange?: BodyChangeListener;
};

export function MarkdownEditor({ initialBody, indentation, onBodyChange }: MarkdownEditorProps) {
  const composition = useCompositionState();
  const hostRef = useRef<HTMLDivElement>(null);
  const onBodyChangeRef = useRef(onBodyChange);

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
    const unit =
      indentationStyle === undefined || indentationWidth === undefined
        ? IndentUnit.from()
        : IndentUnit.from({ style: indentationStyle, width: indentationWidth });
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialBody,
        extensions: [
          editorExtensions(composition, unit),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onBodyChangeRef.current?.(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    return () => {
      view.destroy();
      composition.end();
    };
  }, [composition, initialBody, indentationStyle, indentationWidth]);

  return <div className="markdown-editor" ref={hostRef} />;
}

function editorExtensions(composition: CompositionState, unit: IndentUnit) {
  return [
    new TabIndentation(composition, unit).extension(),
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
    }),
  ];
}
