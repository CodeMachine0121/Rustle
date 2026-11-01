import { describe, expect, it } from "vitest";

import { KeyboardShortcut, type ShortcutKeyEvent } from "./KeyboardShortcut";

function press(combination: Partial<ShortcutKeyEvent>): ShortcutKeyEvent {
  return { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, code: "", ...combination };
}

const CMD_SHIFT_P = press({ metaKey: true, shiftKey: true, code: "KeyP" });
const CTRL_SHIFT_P = press({ ctrlKey: true, shiftKey: true, code: "KeyP" });

describe("KeyboardShortcut", () => {
  it("defaults to Mod+Shift+P, with Cmd or Ctrl as Mod", () => {
    expect(KeyboardShortcut.DEFAULT.matches(CMD_SHIFT_P)).toBe(true);
    expect(KeyboardShortcut.DEFAULT.matches(CTRL_SHIFT_P)).toBe(true);
  });

  it.each([
    ["Shift+P without Mod", press({ shiftKey: true, code: "KeyP" })],
    ["Mod+P without Shift", press({ metaKey: true, code: "KeyP" })],
    ["Mod+Shift+Alt+P", press({ metaKey: true, shiftKey: true, altKey: true, code: "KeyP" })],
    ["Mod+Shift+O", press({ metaKey: true, shiftKey: true, code: "KeyO" })],
  ])("does not match %s", (_name, event) => {
    expect(KeyboardShortcut.DEFAULT.matches(event)).toBe(false);
  });

  it("reads a written combination by its physical key", () => {
    const shortcut = KeyboardShortcut.fromSetting("Mod+Alt+K");

    expect(shortcut.matches(press({ ctrlKey: true, altKey: true, code: "KeyK" }))).toBe(true);
    expect(shortcut.matches(CMD_SHIFT_P)).toBe(false);
  });

  it("reads Cmd as another name for Mod", () => {
    const shortcut = KeyboardShortcut.fromSetting("Cmd+Alt+K");

    expect(shortcut.matches(press({ metaKey: true, altKey: true, code: "KeyK" }))).toBe(true);
    expect(shortcut.matches(CMD_SHIFT_P)).toBe(false);
  });

  it("reads modifiers in any case and order, and digits", () => {
    const shortcut = KeyboardShortcut.fromSetting("shift + MOD + 1");

    expect(shortcut.matches(press({ metaKey: true, shiftKey: true, code: "Digit1" }))).toBe(true);
  });

  it.each([undefined, "", "???", "Shift", "Mod+Shift+", "Shift+P", "Mod+Mod+P", "Mod+Hyper+P", "Mod+Shift+PP"])(
    "falls back to Mod+Shift+P for %j",
    (written) => {
      const shortcut = KeyboardShortcut.fromSetting(written);

      expect(shortcut.matches(CMD_SHIFT_P)).toBe(true);
    },
  );

  it.each([
    [undefined, "Shift+Cmd+P"],
    ["Mod+Alt+K", "Option+Cmd+K"],
    ["alt + shift + mod + k", "Option+Shift+Cmd+K"],
    ["Mod+1", "Cmd+1"],
    ["???", "Shift+Cmd+P"],
    ["Cmd+Alt+K", "Option+Cmd+K"],
    ["Cmd+Mod+K", "Shift+Cmd+P"],
  ])("writes %j the way a Mac menu does: %s", (written, label) => {
    expect(KeyboardShortcut.fromSetting(written).label).toBe(label);
  });
});
