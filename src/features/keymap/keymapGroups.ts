import { FINDING_SHORTCUTS, type FinderKind } from "../finding/FindingKeys";
import type { Messages } from "../interfaceLanguage/messages";
import type { KeyboardShortcut } from "../preview/KeyboardShortcut";

/** A catalog entry that is a plain sentence, so a row can be worded in the interface language. */
export type SentenceKey = { [Key in keyof Messages]: Messages[Key] extends string ? Key : never }[keyof Messages];

/** One key Rustle teaches: the key as printed on the keyboard (never translated) and what it does. */
export type KeymapRow = { keys: string; action: SentenceKey };

export type KeymapGroup = { title: SentenceKey; rows: readonly KeymapRow[] };

const FINDING_ACTIONS: Record<FinderKind, SentenceKey> = {
  title: "findArticlesByTitle",
  body: "findArticlesByBody",
  workspace: "switchWorkspace",
};

/**
 * Every key Rustle itself teaches, in the order the overview shows them.
 * Keys the system or the editor already had (undo, copy, a dialog's Enter)
 * and Vim's keys are not here; Shift+Cmd+W is, because Cmd+W was taken from
 * closing the window. Changing a key's owner means changing its row here.
 */
export function keymapGroups(previewToggle: KeyboardShortcut): readonly KeymapGroup[] {
  return [
    {
      title: "writingShortcutGroup",
      rows: [
        { keys: "Tab", action: "indent" },
        { keys: "Shift+Tab", action: "outdent" },
        { keys: "Enter", action: "continueLine" },
        { keys: "/", action: "openSnippetMenu" },
        { keys: "Cmd+B", action: "bold" },
        { keys: "Cmd+I", action: "italic" },
        { keys: "Cmd+W", action: "extendSelection" },
        { keys: "Esc", action: "leave" },
      ],
    },
    {
      title: "viewShortcutGroup",
      rows: [
        { keys: previewToggle.label, action: "togglePreview" },
        { keys: "Cmd+0", action: "resetFontSize" },
      ],
    },
    {
      title: "windowShortcutGroup",
      rows: [{ keys: "Shift+Cmd+W", action: "closeWindow" }],
    },
    {
      title: "findingShortcutGroup",
      rows: FINDING_SHORTCUTS.map(({ finder, keys }) => ({ keys, action: FINDING_ACTIONS[finder] })),
    },
  ];
}
