import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ArticleBody } from "../../ipc/articleBody";
import type { ChannelResult } from "../../ipc/channelResult";
import type { SavedBody } from "../../ipc/savedBody";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "../autosave/AutosaveSession";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import type { InterfaceLanguage } from "../interfaceLanguage/interfaceLanguage";
import { LiveWordCount } from "./LiveWordCount";
import { WordCountLabel } from "./WordCountLabel";

const SAVED: ChannelResult<SavedBody> = {
  ok: true,
  payload: { outcome: "saved", updatedAt: "2026-08-20T08:04:11.123Z", lastKnownModifiedAt: "2026-08-20T08:04:11.123Z" },
};

function article(body: string): ArticleBody {
  return { workspace: "Blog", fileName: "a.md", body, lastKnownModifiedAt: "2026-08-20T08:00:00.000Z" };
}

function renderLabel(language: InterfaceLanguage) {
  const composition = new CompositionState();
  const editor = new AutosaveSession(composition, {
    saveBody: () => Promise.resolve(SAVED),
    readBody: () => Promise.resolve({ ok: true, payload: article("") }),
  });
  const wordCount = new LiveWordCount(editor, composition);
  const { container } = render(
    <InterfaceLanguageProvider language={language}>
      <WordCountLabel wordCount={wordCount} />
    </InterfaceLanguageProvider>,
  );
  return { container, editor };
}

describe("WordCountLabel", () => {
  it("shows nothing while no article is open", () => {
    const { container } = renderLabel("zh");

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["zh", "今天寫了 Rust 程式", "7 字"],
    ["zh", "", "0 字"],
    ["zh", "字".repeat(1284), "1,284 字"],
    ["en", "Hello world, 2026!", "3 words"],
    ["en", "Hi", "1 word"],
  ] as const)("in %s writes %j as %s", async (language, body, expected) => {
    const { editor } = renderLabel(language);

    await act(() => editor.openArticle({ article: article(body), title: "A" }));

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("follows the typing", async () => {
    const { editor } = renderLabel("zh");
    await act(() => editor.openArticle({ article: article("一二"), title: "A" }));

    act(() => editor.changeBody("一二三"));

    expect(screen.getByText("3 字")).toBeInTheDocument();
  });
});
