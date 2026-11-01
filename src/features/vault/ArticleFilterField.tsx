import { useEffect, useState, type KeyboardEvent } from "react";

import { CompositionAwareDebouncer } from "../../shared/composition/CompositionAwareDebouncer";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";

/** The same pause the preview waits for after typing stops. */
export const FILTER_DELAY_MILLISECONDS = 150;

type ArticleFilterFieldProps = {
  onApply: (filterText: string) => void;
};

/**
 * Shows what was typed at once and applies it once typing (and any
 * composition) has paused. Enter applies now and Escape clears, unless the
 * key belongs to the input method.
 */
export function ArticleFilterField({ onApply }: ArticleFilterFieldProps) {
  const composition = useCompositionState();
  const messages = useMessages();
  const [typedText, setTypedText] = useState("");
  const [debouncer] = useState(
    () => new CompositionAwareDebouncer(composition, FILTER_DELAY_MILLISECONDS),
  );

  useEffect(() => () => debouncer.dispose(), [debouncer]);

  const applyNow = (text: string) => {
    debouncer.cancel();
    onApply(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composition.ownsKey(event.nativeEvent)) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      applyNow(typedText);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setTypedText("");
      applyNow("");
    }
  };

  return (
    <input
      type="text"
      className="article-filter-field"
      aria-label={messages.filterArticles}
      placeholder={messages.filterPlaceholder}
      value={typedText}
      onChange={(event) => {
        const text = event.target.value;
        setTypedText(text);
        debouncer.schedule(() => onApply(text));
      }}
      onKeyDown={handleKeyDown}
      onCompositionStart={() => composition.start()}
      onCompositionEnd={() => composition.end()}
      onBlur={() => composition.end()}
    />
  );
}
