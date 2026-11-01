import { describe, expect, it } from "vitest";

import { CHINESE_MESSAGES, ENGLISH_MESSAGES } from "../interfaceLanguage/messages";
import { KeyboardShortcut } from "../preview/KeyboardShortcut";
import { keymapGroups } from "./keymapGroups";

function rowsInChinese(previewToggle = KeyboardShortcut.DEFAULT) {
  return keymapGroups(previewToggle).map((group) => [
    CHINESE_MESSAGES[group.title],
    group.rows.map((row) => [CHINESE_MESSAGES[row.action], row.keys]),
  ]);
}

describe("keymapGroups", () => {
  it("lists the keys Rustle teaches, writing first, then view, window and finding", () => {
    expect(rowsInChinese()).toEqual([
      [
        "寫作",
        [
          ["縮排", "Tab"],
          ["退縮", "Shift+Tab"],
          ["續行", "Enter"],
          ["片語選單", "/"],
          ["粗體", "Cmd+B"],
          ["斜體", "Cmd+I"],
          ["擴大選取", "Cmd+W"],
          ["退出", "Esc"],
        ],
      ],
      [
        "畫面",
        [
          ["開關預覽", "Shift+Cmd+P"],
          ["字體回預設", "Cmd+0"],
        ],
      ],
      ["視窗", [["關閉視窗", "Shift+Cmd+W"]]],
      [
        "尋找",
        [
          ["用標題找文章", "Cmd+T"],
          ["用內文找文章", "Shift+Cmd+F"],
          ["切換 workspace", "Cmd+P"],
        ],
      ],
    ]);
  });

  it("writes the preview row with the key the settings chose", () => {
    const groups = keymapGroups(KeyboardShortcut.fromSetting("Mod+Alt+K"));

    const previewRow = groups.flatMap((group) => group.rows).find((row) => row.action === "togglePreview");

    expect(previewRow?.keys).toBe("Option+Cmd+K");
  });

  it("leaves out the keys the system and the editor already had", () => {
    const keys = keymapGroups(KeyboardShortcut.DEFAULT).flatMap((group) => group.rows.map((row) => row.keys));

    expect(keys).not.toContain("Cmd+Z");
    expect(keys).not.toContain("Shift+Cmd+Z");
    expect(keys).not.toContain("Cmd+C");
    expect(keys).not.toContain("Cmd+V");
  });

  it("says what each key does in a word or two, never a sentence, in both languages", () => {
    const actions = keymapGroups(KeyboardShortcut.DEFAULT).flatMap((group) => group.rows.map((row) => row.action));

    for (const action of actions) {
      for (const sentence of [CHINESE_MESSAGES[action], ENGLISH_MESSAGES[action]]) {
        expect(sentence).toBeDefined();
        expect(sentence).not.toMatch(/[，。；、,.;:：]/);
      }
    }
  });
});
