import type { Text } from "@codemirror/state";

import type { ScrollPane } from "../preview/ScrollSynchronizer";

type LineBlock = { from: number; top: number; height: number };

/** The parts of a CodeMirror `EditorView` that say where its lines are. */
export type EditorGeometry = {
  scrollDOM: HTMLElement;
  documentTop: number;
  state: { doc: Text };
  lineBlockAtHeight(height: number): LineBlock;
  lineBlockAt(position: number): LineBlock;
};

/** The editor as a sync side: lines are zero-based, with the fraction of a (wrapped) line scrolled past. */
export class EditorScrollPane implements ScrollPane {
  readonly #view: EditorGeometry;

  constructor(view: EditorGeometry) {
    this.#view = view;
  }

  position(): number {
    return this.#view.scrollDOM.scrollTop;
  }

  maximumPosition(): number {
    const { scrollHeight, clientHeight } = this.#view.scrollDOM;
    return Math.max(0, scrollHeight - clientHeight);
  }

  lineAtTop(): number {
    const height = this.position() - this.#documentPosition();
    const block = this.#view.lineBlockAtHeight(height);
    const line = this.#view.state.doc.lineAt(block.from).number - 1;
    const fraction = block.height > 0 ? (height - block.top) / block.height : 0;
    return line + Math.min(1, Math.max(0, fraction));
  }

  positionForLine(line: number): number {
    const { doc } = this.#view.state;
    const whole = Math.min(doc.lines - 1, Math.max(0, Math.floor(line)));
    const fraction = Math.min(1, Math.max(0, line - whole));
    const block = this.#view.lineBlockAt(doc.line(whole + 1).from);
    return this.#documentPosition() + block.top + fraction * block.height;
  }

  scrollTo(position: number): void {
    this.#view.scrollDOM.scrollTop = position;
  }

  // Where the document starts inside the scrolled content, below any padding.
  #documentPosition(): number {
    const { scrollDOM, documentTop } = this.#view;
    return documentTop - scrollDOM.getBoundingClientRect().top + scrollDOM.scrollTop;
  }
}
