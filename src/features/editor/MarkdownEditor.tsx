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

type MarkdownEditorProps = {
  initialBody: string;
  indentation?: IndentationSettings;
};

export function MarkdownEditor({ initialBody, indentation }: MarkdownEditorProps) {
  const composition = useCompositionState();
  const hostRef = useRef<HTMLDivElement>(null);

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
      state: EditorState.create({ doc: initialBody, extensions: editorExtensions(composition, unit) }),
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
