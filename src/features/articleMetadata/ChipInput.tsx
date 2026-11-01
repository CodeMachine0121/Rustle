import { X } from "lucide-react";
import { useId, type KeyboardEvent } from "react";

import { useCompositionState } from "../../shared/composition/CompositionContext";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { candidatesFor, withChip } from "./chipValues";

const CHIP_KEYS = ["Enter", ","];

type ChipInputProps = {
  label: string;
  values: string[];
  typed: string;
  vocabulary: readonly string[];
  onValuesChange: (values: string[]) => void;
  onTypedChange: (typed: string) => void;
};

/**
 * Several values typed one at a time: Enter or a comma turns the text into a
 * chip, Backspace on empty text removes the last one, and words the
 * workspace already uses are offered while typing. A key the input method
 * owns is left to it.
 */
export function ChipInput({
  label,
  values,
  typed,
  vocabulary,
  onValuesChange,
  onTypedChange,
}: ChipInputProps) {
  const composition = useCompositionState();
  const messages = useMessages();
  const inputId = useId();
  const candidates = candidatesFor(vocabulary, typed, values);

  const addChip = (value: string) => {
    onValuesChange(withChip(values, value));
    onTypedChange("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composition.ownsKey(event.nativeEvent)) {
      return;
    }
    if (CHIP_KEYS.includes(event.key)) {
      event.preventDefault();
      if (typed.trim() !== "") {
        addChip(typed);
      }
    } else if (event.key === "Backspace" && typed === "" && values.length > 0) {
      event.preventDefault();
      onValuesChange(values.slice(0, -1));
    }
  };

  return (
    <div className="chip-input">
      <label htmlFor={inputId}>{label}</label>
      <div className="chip-input__box">
        {values.map((value) => (
          <span key={value} className="chip">
            {value}
            <button
              type="button"
              aria-label={messages.removeChip(value)}
              onClick={() => onValuesChange(values.filter((chip) => chip !== value))}
            >
              <X className="icon chip__remove-mark" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          type="text"
          value={typed}
          onChange={(event) => onTypedChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => composition.start()}
          onCompositionEnd={() => composition.end()}
          onBlur={() => composition.end()}
        />
      </div>
      {candidates.length > 0 && (
        <ul className="chip-input__candidates" aria-label={messages.candidatesFor(label)}>
          {candidates.map((candidate) => (
            <li key={candidate}>
              <button type="button" onClick={() => addChip(candidate)}>
                {candidate}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
