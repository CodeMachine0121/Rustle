import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";

import type { CompositionState } from "../../shared/composition/CompositionState";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import type { CursorPlacement } from "../autosave/AutosaveSession";
import type { ImagePaste } from "../imagePaste/ImagePaste";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { ScrollSynchronizer } from "../preview/ScrollSynchronizer";
import { SnippetCatalog } from "../snippets/SnippetCatalog";
import { SnippetExpansion } from "../snippets/SnippetExpansion";
import type { SystemClipboardRegister } from "../vim/SystemClipboardRegister";
import { VimEditing } from "../vim/VimEditing";
import type { VimMode } from "../vim/VimModeSession";
import { cursorLineHighlight } from "./cursorLineHighlight";
import { EditorScrollPane } from "./EditorScrollPane";
import { EmphasisShortcuts } from "./EmphasisShortcuts";
import { ExtendSelection } from "./ExtendSelection";
import { IndentUnit, type IndentationSettings } from "./IndentUnit";
import { TableRowContinuation } from "./TableRowContinuation";
import { TabIndentation } from "./TabIndentation";
import { xcodeTheme } from "./xcodeTheme";

const SHIPPED_SNIPPETS = SnippetCatalog.shipped();

// Mod-I is italic now; selecting the enclosing syntax node moved to Mod-W (ExtendSelection).
const editorDefaultKeymap = defaultKeymap.filter((binding) => binding.key !== "Mod-i");

type BodyChangeListener = (body: string) => void;

type MarkdownEditorProps = {
  documentKey: string;
  body: string;
  indentation?: IndentationSettings;
  focusOnShow?: boolean;
  cursorPlacement?: CursorPlacement | null;
  imagePaste?: ImagePaste;
  onBodyChange?: BodyChangeListener;
  scrollSynchronizer?: ScrollSynchronizer;
  fontSizePixels?: number;
  vimEnabled?: boolean;
  vimRegister?: SystemClipboardRegister;
  onVimModeChange?: (mode: VimMode) => void;
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
 * A new `cursorPlacement` puts the cursor at the start of that line of the
 * shown document (the last line when it is shorter) and takes the keyboard.
 * A new `fontSizePixels` resizes the text in place and re-measures it, so
 * the text, cursor, undo history and composition are untouched.
 * A half-width slash opens the shipped snippets (see `SnippetExpansion`).
 * With `vimEnabled` the editor is modal (see `VimEditing`); turning it on or
 * off changes the keys in place and reports every mode to `onVimModeChange`.
 */
export function MarkdownEditor({
  documentKey,
  body,
  indentation,
  focusOnShow = false,
  cursorPlacement = null,
  imagePaste,
  onBodyChange,
  scrollSynchronizer,
  fontSizePixels,
  vimEnabled = false,
  vimRegister,
  onVimModeChange,
}: MarkdownEditorProps) {
  const composition = useCompositionState();
  const snippetMenuLabel = useMessages().snippetMenu;
  const snippetMenuLabelRef = useRef(snippetMenuLabel);
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const shownDocumentRef = useRef<string | null>(null);
  const appliedPlacementRef = useRef<number | null>(null);
  const onBodyChangeRef = useRef(onBodyChange);
  const [indentationCompartment] = useState(() => new Compartment());
  const [vimEditing] = useState(() => new VimEditing(composition, vimEnabled, vimRegister));

  useEffect(() => {
    onBodyChangeRef.current = onBodyChange;
  }, [onBodyChange]);

  useEffect(() => {
    snippetMenuLabelRef.current = snippetMenuLabel;
  }, [snippetMenuLabel]);

  useEffect(() => {
    vimEditing.reportModesTo((mode) => onVimModeChange?.(mode));
  }, [vimEditing, onVimModeChange]);

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
    if (view === null || fontSizePixels === undefined) {
      return;
    }
    view.dom.style.fontSize = `${fontSizePixels}px`;
    view.requestMeasure();
  }, [fontSizePixels]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: vimEditing.switchTo(vimEnabled) });
  }, [vimEditing, vimEnabled]);

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
    const placeCursor = () => {
      if (cursorPlacement === null || appliedPlacementRef.current === cursorPlacement.sequence) {
        return;
      }
      appliedPlacementRef.current = cursorPlacement.sequence;
      putCursorOnLine(view, cursorPlacement.line);
    };
    const show = () => {
      if (shownDocumentRef.current === documentKey) {
        view.dispatch({ effects: indentationCompartment.reconfigure(tabIndentation) });
        placeCursor();
        return;
      }
      shownDocumentRef.current = documentKey;
      view.setState(
        EditorState.create({
          doc: body,
          extensions: [
            editorExtensions(composition, indentationCompartment.of(tabIndentation), vimEditing),
            new SnippetExpansion(composition, SHIPPED_SNIPPETS, () => snippetMenuLabelRef.current).extension(),
            imagePaste?.extension() ?? [],
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onBodyChangeRef.current?.(update.state.doc.toString());
              }
            }),
            vimEditing.extension(),
          ],
        }),
      );
      appliedPlacementRef.current = null;
      if (focusOnShow) {
        view.focus();
      }
      placeCursor();
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
    cursorPlacement,
    imagePaste,
    indentationStyle,
    indentationWidth,
    indentationCompartment,
    vimEditing,
  ]);

  return <div className="markdown-editor" ref={hostRef} />;
}

function putCursorOnLine(view: EditorView, line: number) {
  const { doc } = view.state;
  const target = doc.line(Math.min(Math.max(line, 1), doc.lines));
  view.dispatch({
    selection: { anchor: target.from },
    effects: EditorView.scrollIntoView(target.from, { y: "center" }),
  });
  view.focus();
}

function editorExtensions(composition: CompositionState, tabIndentation: Extension, vimEditing: VimEditing) {
  return [
    tabIndentation,
    new TableRowContinuation(composition).extension(),
    new EmphasisShortcuts(composition).extension(),
    new ExtendSelection(composition).extension(),
    history(),
    keymap.of(historyKeymap),
    vimEditing.typingKeys(editorDefaultKeymap),
    markdown({ addKeymap: false }),
    Prec.high(vimEditing.typingKeys(markdownKeymap)),
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
