import { describe, expect, it } from "vitest";

import { CHINESE_MESSAGES, ENGLISH_MESSAGES, messagesFor, withFallback, type Messages } from "./messages";

describe("messages", () => {
  it("has an English sentence for every Chinese one", () => {
    expect(Object.keys(ENGLISH_MESSAGES).sort()).toEqual(Object.keys(CHINESE_MESSAGES).sort());
  });

  it("names the sidebar sections in the interface language, except WORKSPACES", () => {
    const chinese = messagesFor("zh");
    const english = messagesFor("en");

    expect([chinese.workspacesTitle, chinese.statusTitle, chinese.tagsTitle]).toEqual(["WORKSPACES", "狀態", "標籤"]);
    expect([english.workspacesTitle, english.statusTitle, english.tagsTitle]).toEqual(["WORKSPACES", "STATUS", "TAGS"]);
  });

  it("counts words in Chinese with 字 and in English with word or words", () => {
    expect(messagesFor("zh").wordCount(1284)).toBe("1,284 字");
    expect(messagesFor("en").wordCount(1)).toBe("1 word");
    expect(messagesFor("en").wordCount(0)).toBe("0 words");
  });

  it("keeps vault, workspace and metadata untranslated in Chinese sentences", () => {
    const chinese = messagesFor("zh");

    expect(chinese.workspaceUnreadable("permission denied")).toBe("讀不到這個 workspace：permission denied");
    expect(chinese.vaultUnreadable("permission denied")).toBe("讀不到 vault：permission denied");
    expect(chinese.incompleteMetadata).toBe("metadata 不完整");
  });

  it("puts the writer's own words into a sentence as they are", () => {
    expect(messagesFor("en").deleteArticle("我的旅行")).toBe('Delete "我的旅行"');
    expect(messagesFor("zh").deleteArticle("My Trip")).toBe("刪除 My Trip");
    expect(messagesFor("en").renameWorkspace("Travel")).toBe('Rename "Travel"');
  });

  it("changes only the words around a time, never the time", () => {
    expect(messagesFor("zh").createdAt("2026-08-21 14:30")).toBe("建立於 2026-08-21 14:30");
    expect(messagesFor("en").createdAt("2026-08-21 14:30")).toBe("Created 2026-08-21 14:30");
    expect(messagesFor("zh").notRecordedInFile).toBe("（檔案沒有記錄）");
    expect(messagesFor("en").notRecordedInFile).toBe("(not recorded in the file)");
  });

  it("says why an image was not saved, with or without a reason", () => {
    expect(messagesFor("en").imageNotSaved("disk full")).toBe("Could not save the image: disk full");
    expect(messagesFor("en").imageNotSaved("")).toBe("Could not save the image.");
    expect(messagesFor("zh").imageNotSaved("")).toBe("圖片存不進去。");
  });

  it("joins an operation and its reason the way each language punctuates", () => {
    expect(messagesFor("zh").failureWithReason("刪除文章失敗", "磁碟已滿")).toBe("刪除文章失敗：磁碟已滿");
    expect(messagesFor("en").failureWithReason("Could not delete the article", "disk full")).toBe(
      "Could not delete the article: disk full",
    );
  });
});

describe("withFallback", () => {
  it("says a sentence missing in one language with the other language's", () => {
    const { settings: _settings, ...missingOne } = ENGLISH_MESSAGES;
    void _settings;

    const messages: Messages = withFallback(missingOne, CHINESE_MESSAGES);

    expect(messages.settings).toBe("設定");
    expect(messages.language).toBe("Language");
  });

  it("never shows a blank sentence", () => {
    const messages = withFallback({ ...ENGLISH_MESSAGES, dismiss: "", save: undefined }, CHINESE_MESSAGES);

    expect(messages.dismiss).toBe("關閉提示");
    expect(messages.save).toBe("儲存");
  });
});
