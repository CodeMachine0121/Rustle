import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleBody } from "../../ipc/articleBody";
import type { ChannelResult } from "../../ipc/channelResult";
import type { SavedBody } from "../../ipc/savedBody";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "../autosave/AutosaveSession";
import { LiveWordCount } from "./LiveWordCount";

function articleBody(fileName: string, body: string): ArticleBody {
  return { workspace: "Blog", fileName, body, lastKnownModifiedAt: "2026-08-20T08:00:00.000Z" };
}

const SAVED: ChannelResult<SavedBody> = {
  ok: true,
  payload: { outcome: "saved", updatedAt: "2026-08-20T08:04:11.123Z", lastKnownModifiedAt: "2026-08-20T08:04:11.123Z" },
};

describe("LiveWordCount", () => {
  let composition: CompositionState;
  let editor: AutosaveSession;
  let wordCount: LiveWordCount;
  let redraws: number;

  beforeEach(async () => {
    vi.useFakeTimers();
    composition = new CompositionState();
    editor = new AutosaveSession(composition, {
      saveBody: () => Promise.resolve(SAVED),
      readBody: (_, fileName) => Promise.resolve({ ok: true, payload: articleBody(fileName, "") }),
    });
    wordCount = new LiveWordCount(editor, composition);
    redraws = 0;
    wordCount.subscribe(() => {
      redraws += 1;
    });
  });

  afterEach(() => {
    wordCount.dispose();
    editor.dispose();
    vi.useRealTimers();
  });

  it("counts nothing while no article is open", () => {
    expect(wordCount.count).toBeNull();
  });

  it("counts an opened article at once", async () => {
    await editor.openArticle({ article: articleBody("a.md", "十個字十個字十個字十"), title: "A" });

    expect(wordCount.count).toBe(10);
  });

  it("counts a typed character at once", async () => {
    await editor.openArticle({ article: articleBody("a.md", "十個字十個字十個字十"), title: "A" });

    editor.changeBody("十個字十個字十個字十好");

    expect(wordCount.count).toBe(11);
  });

  it("keeps the count while composing and catches up when the candidate is chosen", async () => {
    await editor.openArticle({ article: articleBody("a.md", "十個字十個字十個字十"), title: "A" });

    composition.start();
    editor.changeBody("十個字十個字十個字十ㄗˋ");
    expect(wordCount.count).toBe(10);

    editor.changeBody("十個字十個字十個字十字");
    composition.end();
    expect(wordCount.count).toBe(11);
  });

  it("counts another article at once", async () => {
    await editor.openArticle({ article: articleBody("a.md", "一二三"), title: "A" });

    await editor.openArticle({ article: articleBody("b.md", "一二"), title: "B" });

    expect(wordCount.count).toBe(2);
  });

  it("counts another article at once even while composing", async () => {
    await editor.openArticle({ article: articleBody("a.md", "一二三"), title: "A" });
    composition.start();

    const opening = editor.openArticle({ article: articleBody("b.md", "一二"), title: "B" });
    composition.end();
    composition.start();
    await opening;

    expect(wordCount.count).toBe(2);
  });

  it("counts nothing again once the article is closed", async () => {
    await editor.openArticle({ article: articleBody("a.md", "一二三"), title: "A" });

    await editor.closeArticle();

    expect(wordCount.count).toBeNull();
  });

  it("redraws only when the count changes", async () => {
    await editor.openArticle({ article: articleBody("a.md", "一二三"), title: "A" });
    const redrawsAfterOpening = redraws;

    editor.changeBody("一二三。");

    expect(redraws).toBe(redrawsAfterOpening);
  });

  it("stops following once disposed", async () => {
    wordCount.dispose();

    await editor.openArticle({ article: articleBody("a.md", "一二三"), title: "A" });

    expect(wordCount.count).toBeNull();
    expect(redraws).toBe(0);
  });
});
