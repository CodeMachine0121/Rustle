import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";

export type FinderRow = { key: string; content: ReactNode };

type FinderPaletteProps = {
  label: string;
  rows: readonly FinderRow[];
  /** Said under the rows: why there are none, or that there were too many. */
  statusLine: string | null;
  /** The typed text, reported only once no input method is composing it. */
  onTextChange: (text: string) => void;
  /** Called with the selected index, which may be past the rows when there are none. */
  onChoose: (index: number) => void;
  onDismiss: () => void;
};

/**
 * The one overlay every finder uses: a field and the rows that follow it.
 * Up and down move the selection and stop at either end, Enter chooses it,
 * Escape or a click outside dismisses. New
 * rows put the selection back on the first one. Keys the input method owns
 * are left to it.
 */
export function FinderPalette({ label, rows, statusLine, onTextChange, onChoose, onDismiss }: FinderPaletteProps) {
  const composition = useCompositionState();
  const messages = useMessages();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [shownRows, setShownRows] = useState(rows);
  const listRef = useRef<HTMLUListElement>(null);

  if (shownRows !== rows) {
    setShownRows(rows);
    setSelectedIndex(0);
  }

  useEffect(() => {
    listRef.current?.children.item(selectedIndex)?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, rows]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composition.ownsKey(event.nativeEvent)) {
      return;
    }
    const lastIndex = rows.length - 1;
    if (event.key === "ArrowDown") {
      setSelectedIndex((index) => Math.min(index + 1, Math.max(lastIndex, 0)));
    } else if (event.key === "ArrowUp") {
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      onChoose(selectedIndex);
    } else if (event.key === "Escape") {
      onDismiss();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className="finder-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className="finder" role="dialog" aria-label={label}>
        <input
          type="text"
          className="finder-field"
          aria-label={label}
          autoFocus
          onChange={(event) => {
            if (!composition.isComposing) {
              onTextChange(event.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => composition.start()}
          onCompositionEnd={(event) => {
            composition.end();
            onTextChange(event.currentTarget.value);
          }}
          onBlur={() => composition.end()}
        />
        {rows.length > 0 && (
          <ul className="finder-rows" role="listbox" aria-label={messages.findingResults} ref={listRef}>
            {rows.map((row, index) => (
              <li
                key={row.key}
                role="option"
                aria-selected={index === selectedIndex}
                className="finder-row"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChoose(index)}
              >
                {row.content}
              </li>
            ))}
          </ul>
        )}
        {statusLine !== null && (
          <p className="finder-status" role="status">
            {statusLine}
          </p>
        )}
      </div>
    </div>
  );
}
