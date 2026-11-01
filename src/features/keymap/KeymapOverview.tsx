import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";

import { IconButton } from "../../shared/icons/IconButton";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { KeyboardShortcut } from "../preview/KeyboardShortcut";
import { keymapGroups } from "./keymapGroups";

type KeymapOverviewProps = {
  headingId: string;
  previewToggle: KeyboardShortcut;
  onBack: () => void;
};

/** The keys Rustle teaches, by group: what each does on the left, the key on the right. */
export function KeymapOverview({ headingId, previewToggle, onBack }: KeymapOverviewProps) {
  const messages = useMessages();
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <>
      <div className="keymap-overview__header">
        <IconButton ref={backRef} label={messages.backToSettings} icon={ArrowLeft} onClick={onBack} />
        <h2 id={headingId}>{messages.keyboardShortcuts}</h2>
      </div>
      <div className="keymap-overview">
        {keymapGroups(previewToggle).map((group) => (
          <section key={group.title} className="keymap-overview__group">
            <h3>{messages[group.title]}</h3>
            <dl>
              {group.rows.map((row) => (
                <div key={row.action} className="keymap-overview__row">
                  <dt>{messages[row.action]}</dt>
                  <dd>
                    <kbd>{row.keys}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}
