import { describe, expect, it } from "vitest";

import { documentLanguageOf, interfaceLanguageOf, LANGUAGE_OPTIONS } from "./interfaceLanguage";

describe("interfaceLanguageOf", () => {
  it.each([
    [["zh-Hant-TW", "en-US"], "zh"],
    [["zh-TW"], "zh"],
    [["zh_CN"], "zh"],
    [["zh-Hans"], "zh"],
    [["ZH-hant"], "zh"],
    [["en-US", "zh-Hant-TW"], "en"],
    [["ja-JP", "zh-Hant-TW"], "en"],
    [["fr"], "en"],
    [[], "en"],
  ] as const)("reads %j as %s", (locales, language) => {
    expect(interfaceLanguageOf(locales)).toBe(language);
  });
});

describe("documentLanguageOf", () => {
  it("names the language a screen reader should speak in", () => {
    expect(documentLanguageOf("zh")).toBe("zh-Hant");
    expect(documentLanguageOf("en")).toBe("en");
  });
});

describe("LANGUAGE_OPTIONS", () => {
  it("writes each option in its own language", () => {
    expect(LANGUAGE_OPTIONS).toEqual([
      { language: "zh", name: "中文" },
      { language: "en", name: "English" },
    ]);
  });
});
