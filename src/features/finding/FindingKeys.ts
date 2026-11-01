export type FinderKind = "title" | "body" | "workspace";

export type FindingKeyEvent = Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "code">;

/** The keys this app teaches for finding, as the keymap list writes them. */
export const FINDING_SHORTCUTS: readonly { finder: FinderKind; keys: string }[] = [
  { finder: "title", keys: "Cmd+T" },
  { finder: "body", keys: "Shift+Cmd+F" },
  { finder: "workspace", keys: "Cmd+P" },
];

/**
 * The finder a key opens. Only Cmd counts: Ctrl with the same letter is the
 * machine's own editing key (Ctrl+P is the previous line) and stays with it.
 */
export function finderForKey(event: FindingKeyEvent): FinderKind | null {
  if (!event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }
  if (event.code === "KeyT" && !event.shiftKey) {
    return "title";
  }
  if (event.code === "KeyF" && event.shiftKey) {
    return "body";
  }
  if (event.code === "KeyP" && !event.shiftKey) {
    return "workspace";
  }
  return null;
}
