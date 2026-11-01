import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleBody } from "../../ipc/articleBody";
import type { ChannelResult } from "../../ipc/channelResult";
import type { SavedBody } from "../../ipc/savedBody";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "../autosave/AutosaveSession";
import { PreviewedBody } from "./PreviewedBody";

function articleBody(fileName: string, body: string): ArticleBody {
  return { workspace: "Blog", fileName, body, lastKnownModifiedAt: "2026-08-20T08:00:00.000Z" };
}

const SAVED: ChannelResult<SavedBody> = {
  ok: true,
  payload: {
    outcome: "saved",
    updatedAt: "2026-08-20T08:04:11.123Z",
    lastKnownModifiedAt: "2026-08-20T08:04:11.123Z",
  },
};

describe("PreviewedBody", () => {
  let composition: CompositionState;
  let editor: AutosaveSession;
  let previewed: PreviewedBody;
  let redraws: number;

  beforeEach(async () => {
    vi.useFakeTimers();
    composition = new CompositionState();
    editor = new AutosaveSession(composition, {
      saveBody: () => Promise.resolve(SAVED),
      readBody: (workspace, fileName) =>
        Promise.resolve({ ok: true, payload: articleBody(fileName, `${workspace} 磁碟`) }),
    });
    previewed = new PreviewedBody(editor, composition);
    redraws = 0;
    await editor.openArticle({ article: articleBody("a.md", "舊內容"), title: "A" });
    previewed.subscribe(() => {
      redraws += 1;
    });
  });

  afterEach(() => {
    previewed.dispose();
    editor.dispose();
    vi.useRealTimers();
  });

  it("shows nothing while no article is open", () => {
    const withoutArticle = new PreviewedBody(new AutosaveSession(composition, {
      saveBody: () => Promise.resolve(SAVED),
      readBody: () => Promise.resolve({ ok: true, payload: articleBody("a.md", "") }),
    }), composition);

    expect(withoutArticle.body).toBeNull();
  });

  it("shows an opened article at once", () => {
    expect(previewed.body).toBe("舊內容");
  });

  it("shows typing 150 milliseconds after it stops", () => {
    editor.changeBody("新內容");

    vi.advanceTimersByTime(149);
    expect(previewed.body).toBe("舊內容");
    vi.advanceTimersByTime(1);
    expect(previewed.body).toBe("新內容");
  });

  it("redraws once for a burst of typing", () => {
    ["一", "一二", "一二三", "一二三四", "一二三四五"].forEach((body) => {
      editor.changeBody(body);
      vi.advanceTimersByTime(50);
    });
    expect(redraws).toBe(0);

    vi.advanceTimersByTime(100);

    expect(previewed.body).toBe("一二三四五");
    expect(redraws).toBe(1);
  });

  it("pauses the countdown while composing and finishes the rest afterwards", () => {
    editor.changeBody("新內容");
    vi.advanceTimersByTime(100);

    composition.start();
    vi.advanceTimersByTime(2000);
    expect(previewed.body).toBe("舊內容");

    composition.end();
    vi.advanceTimersByTime(49);
    expect(previewed.body).toBe("舊內容");
    vi.advanceTimersByTime(1);
    expect(previewed.body).toBe("新內容");
  });

  it("does not redraw for a change made while composing until composing ends", () => {
    composition.start();
    editor.changeBody("ㄋ");
    vi.advanceTimersByTime(2000);
    expect(redraws).toBe(0);

    composition.end();
    vi.advanceTimersByTime(149);
    expect(previewed.body).toBe("舊內容");
    vi.advanceTimersByTime(1);
    expect(previewed.body).toBe("ㄋ");
  });

  it("shows another article at once and never the previous one's pending update", async () => {
    editor.changeBody("A 的新內容");
    vi.advanceTimersByTime(100);

    const opening = editor.openArticle({ article: articleBody("b.md", "B 的正文"), title: "B" });
    await vi.advanceTimersByTimeAsync(0);
    await opening;
    expect(previewed.body).toBe("B 的正文");

    vi.advanceTimersByTime(500);
    expect(previewed.body).toBe("B 的正文");
  });

  it("shows nothing again once the article is closed", async () => {
    await editor.closeArticle();

    expect(previewed.body).toBeNull();
  });

  it("ignores notifications that do not change the body", () => {
    editor.changeBody("新內容");
    vi.advanceTimersByTime(150);
    redraws = 0;

    editor.changeBody("新內容");
    vi.advanceTimersByTime(150);

    expect(redraws).toBe(0);
  });
});
