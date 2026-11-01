import { describe, expect, it } from "vitest";

import { FINDING_SHORTCUTS, finderForKey, type FindingKeyEvent } from "./FindingKeys";

function key(code: string, modifiers: Partial<FindingKeyEvent> = {}): FindingKeyEvent {
  return { code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers };
}

describe("finderForKey", () => {
  it.each([
    [key("KeyT", { metaKey: true }), "title"],
    [key("KeyF", { metaKey: true, shiftKey: true }), "body"],
    [key("KeyP", { metaKey: true }), "workspace"],
  ])("opens a finder with Cmd", (event, finder) => {
    expect(finderForKey(event)).toBe(finder);
  });

  it.each([
    ["Ctrl+P", key("KeyP", { ctrlKey: true })],
    ["Ctrl+T", key("KeyT", { ctrlKey: true })],
    ["Shift+Ctrl+F", key("KeyF", { ctrlKey: true, shiftKey: true })],
    ["Cmd+Ctrl+P", key("KeyP", { metaKey: true, ctrlKey: true })],
    ["Alt+Cmd+P", key("KeyP", { metaKey: true, altKey: true })],
    ["Cmd+F", key("KeyF", { metaKey: true })],
    ["Shift+Cmd+T", key("KeyT", { metaKey: true, shiftKey: true })],
    ["Shift+Cmd+P", key("KeyP", { metaKey: true, shiftKey: true })],
    ["Cmd+W", key("KeyW", { metaKey: true })],
    ["Shift+Cmd+W", key("KeyW", { metaKey: true, shiftKey: true })],
    ["P", key("KeyP")],
  ])("leaves %s alone", (_name, event) => {
    expect(finderForKey(event)).toBeNull();
  });

  it("names the three keys the way the keymap list writes them", () => {
    expect(FINDING_SHORTCUTS).toEqual([
      { finder: "title", keys: "Cmd+T" },
      { finder: "body", keys: "Shift+Cmd+F" },
      { finder: "workspace", keys: "Cmd+P" },
    ]);
  });
});
