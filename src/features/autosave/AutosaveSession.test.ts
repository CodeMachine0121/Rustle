import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleBody } from "../../ipc/articleBody";
import type { ChannelResult } from "../../ipc/channelResult";
import type { SaveBodyRequest, SavedBody } from "../../ipc/savedBody";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "./AutosaveSession";

const LOADED_AT = "2026-08-20T08:00:00.000Z";
const SAVED_AT = "2026-08-20T08:04:11.123Z";

function articleBody(fileName: string, body = "載入的正文"): ArticleBody {
  return { workspace: "Blog", fileName, body, lastKnownModifiedAt: LOADED_AT };
}

function saved(lastKnownModifiedAt = SAVED_AT): ChannelResult<SavedBody> {
  return { ok: true, payload: { outcome: "saved", updatedAt: SAVED_AT, lastKnownModifiedAt } };
}

const MODIFIED_ELSEWHERE: ChannelResult<SavedBody> = {
  ok: true,
  payload: { outcome: "modifiedElsewhere", lastKnownModifiedAt: LOADED_AT },
};

const DISK_FULL: ChannelResult<SavedBody> = {
  ok: false,
  reason: "unexpected",
  message: "No space left on device",
};

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe("AutosaveSession", () => {
  let composition: CompositionState;
  let saveBody: ReturnType<
    typeof vi.fn<(request: SaveBodyRequest) => Promise<ChannelResult<SavedBody>>>
  >;
  let readBody: ReturnType<
    typeof vi.fn<(workspace: string, fileName: string) => Promise<ChannelResult<ArticleBody>>>
  >;
  let releaseFocus: ReturnType<typeof vi.fn<() => void>>;
  let session: AutosaveSession;

  beforeEach(() => {
    vi.useFakeTimers();
    composition = new CompositionState();
    saveBody = vi.fn((request: SaveBodyRequest) => {
      void request;
      return Promise.resolve(saved());
    });
    readBody = vi.fn((workspace: string, fileName: string) =>
      Promise.resolve<ChannelResult<ArticleBody>>({
        ok: true,
        payload: {
          workspace,
          fileName,
          body: "磁碟上的正文",
          lastKnownModifiedAt: "2026-08-20T09:00:00.000Z",
        },
      }),
    );
    releaseFocus = vi.fn();
    session = new AutosaveSession(composition, { saveBody, readBody }, { releaseFocus });
  });

  afterEach(() => {
    session.dispose();
    vi.useRealTimers();
  });

  async function openZen(): Promise<void> {
    await session.openArticle({ article: articleBody("zen.md"), title: "寫作的禪" });
  }

  async function advance(milliseconds: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(milliseconds);
  }

  async function typeAndAutosave(body: string): Promise<void> {
    session.changeBody(body);
    await advance(1000);
  }

  describe("when to save", () => {
    it("saves the typed body once typing has stopped for a second", async () => {
      await openZen();

      session.changeBody("新的正文");
      await advance(999);
      expect(saveBody).not.toHaveBeenCalled();

      await advance(1);
      expect(saveBody).toHaveBeenCalledTimes(1);
      expect(saveBody).toHaveBeenCalledWith({
        workspace: "Blog",
        fileName: "zen.md",
        body: "新的正文",
        lastKnownModifiedAt: LOADED_AT,
        overwrite: false,
      });
    });

    it("saves only once after typing every 0.9 seconds and then stopping", async () => {
      await openZen();

      session.changeBody("一");
      await advance(900);
      session.changeBody("一二");
      await advance(900);
      session.changeBody("一二三");
      await advance(900);
      expect(saveBody).not.toHaveBeenCalled();

      await advance(1000);
      expect(saveBody).toHaveBeenCalledTimes(1);
      expect(saveBody.mock.lastCall?.[0].body).toBe("一二三");
    });

    it("never saves while composing, however long it lasts", async () => {
      await openZen();
      session.changeBody("新的正文");
      await advance(400);

      composition.start();
      await advance(10_000);

      expect(saveBody).not.toHaveBeenCalled();
    });

    it("finishes the remaining time after the composition ends", async () => {
      await openZen();
      session.changeBody("新的正文");
      await advance(400);
      composition.start();
      await advance(10_000);

      composition.end();
      await advance(599);
      expect(saveBody).not.toHaveBeenCalled();

      await advance(1);
      expect(saveBody).toHaveBeenCalledTimes(1);
    });

    it("starts counting a change made while composing only after the composition ends", async () => {
      await openZen();
      composition.start();

      session.changeBody("組字中的正文");
      await advance(10_000);
      expect(saveBody).not.toHaveBeenCalled();

      composition.end();
      await advance(1000);
      expect(saveBody).toHaveBeenCalledTimes(1);
    });

    it("does not save a change made without an open article", async () => {
      session.changeBody("無處可存");
      await advance(1000);

      expect(saveBody).not.toHaveBeenCalled();
    });

    it("never runs two saves of the article at the same time", async () => {
      await openZen();
      const firstSave = deferred<ChannelResult<SavedBody>>();
      saveBody.mockReturnValueOnce(firstSave.promise);

      await typeAndAutosave("第一版");
      await typeAndAutosave("第二版");
      expect(saveBody).toHaveBeenCalledTimes(1);

      firstSave.resolve(saved("2026-08-20T08:04:12.000Z"));
      await advance(0);
      expect(saveBody).toHaveBeenCalledTimes(2);
      expect(saveBody.mock.lastCall?.[0]).toMatchObject({
        body: "第二版",
        lastKnownModifiedAt: "2026-08-20T08:04:12.000Z",
      });
    });

    it("expects the modification time of the previous save on the next one", async () => {
      await openZen();
      saveBody.mockResolvedValueOnce(saved("2026-08-20T08:04:12.000Z"));

      await typeAndAutosave("第一版");
      await typeAndAutosave("第二版");

      expect(saveBody.mock.lastCall?.[0].lastKnownModifiedAt).toBe("2026-08-20T08:04:12.000Z");
    });
  });

  describe("handing the keyboard to the editor", () => {
    it("asks the editor to take the keyboard only for an article opened that way", async () => {
      await session.openArticle({ article: articleBody("new.md"), title: "新文章", focusEditor: true });
      expect(session.document.takesFocus).toBe(true);

      await session.openArticle({ article: articleBody("other.md"), title: "另一篇" });
      expect(session.document.takesFocus).toBe(false);
    });

    it("does not ask for the keyboard when a reload shows the same article again", async () => {
      await session.openArticle({ article: articleBody("new.md"), title: "新文章", focusEditor: true });

      await session.reload();

      expect(session.document.takesFocus).toBe(false);
    });
  });

  describe("putting the cursor on a line", () => {
    it("asks the editor to put the cursor on the line an article was opened at", async () => {
      await session.openArticle({ article: articleBody("tired.md"), title: "今天很累", cursorLine: 7 });

      expect(session.document.cursorPlacement).toMatchObject({ line: 7 });
    });

    it("asks for no cursor line when an article is opened without one", async () => {
      await session.openArticle({ article: articleBody("tired.md"), title: "今天很累" });

      expect(session.document.cursorPlacement).toBeNull();
    });

    it("moves the cursor in the open article without replacing its text", async () => {
      await session.openArticle({ article: articleBody("tired.md"), title: "今天很累", cursorLine: 3 });
      const shown = session.document;
      session.changeBody("還沒存的字");

      session.placeCursor(12);

      expect(session.document.version).toBe(shown.version);
      expect(session.document.cursorPlacement?.line).toBe(12);
      expect(session.document.cursorPlacement?.sequence).not.toBe(shown.cursorPlacement?.sequence);
      expect(session.body).toBe("還沒存的字");
    });

    it("asks again for the same line chosen twice", async () => {
      await session.openArticle({ article: articleBody("tired.md"), title: "今天很累" });
      session.placeCursor(7);
      const first = session.document.cursorPlacement;

      session.placeCursor(7);

      expect(session.document.cursorPlacement).not.toEqual(first);
    });

    it("places no cursor while no article is open", () => {
      session.placeCursor(7);

      expect(session.document.cursorPlacement).toBeNull();
    });
  });

  describe("leaving the article", () => {
    it("saves the previous article before switching to another", async () => {
      await openZen();
      session.changeBody("未存的正文");

      const outcome = await session.openArticle({
        article: articleBody("other.md"),
        title: "另一篇",
      });

      expect(outcome).toBe("switched");
      expect(saveBody).toHaveBeenCalledTimes(1);
      expect(saveBody.mock.lastCall?.[0]).toMatchObject({ fileName: "zen.md", body: "未存的正文" });
      expect(session.status).toMatchObject({
        kind: "article",
        title: "另一篇",
        hasUnsavedChanges: false,
      });
      expect(session.document.body).toBe("載入的正文");
    });

    it("saves before closing the article when the workspace changes", async () => {
      await openZen();
      session.changeBody("未存的正文");

      const outcome = await session.closeArticle();

      expect(outcome).toBe("switched");
      expect(saveBody).toHaveBeenCalledTimes(1);
      expect(session.status).toEqual({ kind: "noArticle" });
    });

    it("does not save when switching without unsaved changes", async () => {
      await openZen();

      await session.openArticle({ article: articleBody("other.md"), title: "另一篇" });
      await session.closeArticle();

      expect(saveBody).not.toHaveBeenCalled();
    });

    it("waits for the composition to end before saving, and only then finishes the switch", async () => {
      await openZen();
      session.changeBody("組字中的正文");
      composition.start();

      let switched = false;
      const switching = session.openArticle({ article: articleBody("other.md"), title: "另一篇" });
      void switching.then(() => {
        switched = true;
      });
      await advance(5000);
      expect(saveBody).not.toHaveBeenCalled();
      expect(switched).toBe(false);

      composition.end();
      await expect(switching).resolves.toBe("switched");
      expect(saveBody).toHaveBeenCalledTimes(1);
    });
  });

  describe("outside changes", () => {
    async function warned(): Promise<void> {
      await openZen();
      saveBody.mockResolvedValueOnce(MODIFIED_ELSEWHERE);
      await typeAndAutosave("Rustle 的正文");
    }

    it("shows the warning, keeps the changes unsaved and keeps the loaded modification time", async () => {
      await warned();

      expect(session.status).toMatchObject({
        modifiedElsewhere: true,
        hasUnsavedChanges: true,
        indicator: "saving",
      });
      await session.overwrite();
      expect(saveBody.mock.lastCall?.[0].lastKnownModifiedAt).toBe(LOADED_AT);
    });

    it("stops autosaving until the warning is answered", async () => {
      await warned();

      await typeAndAutosave("又打了幾個字");
      await advance(5000);

      expect(saveBody).toHaveBeenCalledTimes(1);
    });

    it("sends an authorised overwrite and clears the warning when it is written", async () => {
      await warned();

      await session.overwrite();

      expect(saveBody).toHaveBeenCalledTimes(2);
      expect(saveBody.mock.lastCall?.[0]).toMatchObject({ body: "Rustle 的正文", overwrite: true });
      expect(session.status).toMatchObject({ modifiedElsewhere: false, hasUnsavedChanges: false });
    });

    it("keeps the warning when the file changed again during the overwrite", async () => {
      await warned();
      saveBody.mockResolvedValueOnce(MODIFIED_ELSEWHERE);

      await session.overwrite();

      expect(session.status).toMatchObject({ modifiedElsewhere: true, hasUnsavedChanges: true });
    });

    it("saves what was typed during the warning after the overwrite", async () => {
      await warned();
      session.changeBody("警示期間打的字");

      await session.overwrite();
      await advance(1000);

      expect(saveBody.mock.lastCall?.[0]).toMatchObject({
        body: "警示期間打的字",
        overwrite: true,
      });
      expect(session.status).toMatchObject({ hasUnsavedChanges: false });
    });

    it("reloads the body on disk and drops the warning and the unsaved changes", async () => {
      await warned();
      const versionBefore = session.document.version;

      await session.reload();

      expect(readBody).toHaveBeenCalledWith("Blog", "zen.md");
      expect(session.document).toEqual({
        version: versionBefore + 1,
        body: "磁碟上的正文",
        takesFocus: false,
        cursorPlacement: null,
      });
      expect(session.status).toMatchObject({ modifiedElsewhere: false, hasUnsavedChanges: false });
      await typeAndAutosave("重新載入後打的字");
      expect(saveBody.mock.lastCall?.[0].lastKnownModifiedAt).toBe("2026-08-20T09:00:00.000Z");
    });

    it("waits for the composition to end before reading the file on reload", async () => {
      await warned();
      composition.start();

      const reloading = session.reload();
      await advance(5000);
      expect(readBody).not.toHaveBeenCalled();
      expect(session.document.body).toBe("載入的正文");

      composition.end();
      await reloading;
      expect(session.document.body).toBe("磁碟上的正文");
    });

    it("keeps the warning and reports the failure when the reload cannot read the file", async () => {
      await warned();
      readBody.mockResolvedValueOnce({ ok: false, reason: "unexpected", message: "gone" });

      await session.reload();

      expect(session.status).toMatchObject({ modifiedElsewhere: true, failureMessage: "gone", indicator: "failed" });
    });

    it("refuses to switch article while the warning is unanswered and writes nothing", async () => {
      await warned();

      const outcome = await session.openArticle({
        article: articleBody("other.md"),
        title: "另一篇",
      });

      expect(outcome).toBe("blockedByUnansweredWarning");
      expect(saveBody).toHaveBeenCalledTimes(1);
      expect(session.status).toMatchObject({
        title: "寫作的禪",
        modifiedElsewhere: true,
        hasUnsavedChanges: true,
      });
    });

    it("refuses to close the article while the warning is unanswered, every time", async () => {
      await warned();

      await expect(session.closeArticle()).resolves.toBe("blockedByUnansweredWarning");
      await expect(session.closeArticle()).resolves.toBe("blockedByUnansweredWarning");
      expect(session.status).toMatchObject({ title: "寫作的禪" });
    });

    it("lets the user switch once the overwrite was written", async () => {
      await warned();
      await session.overwrite();

      const outcome = await session.openArticle({
        article: articleBody("other.md"),
        title: "另一篇",
      });

      expect(outcome).toBe("switched");
    });
  });

  describe("failed saves", () => {
    async function failed(): Promise<void> {
      await openZen();
      saveBody.mockResolvedValue(DISK_FULL);
      await typeAndAutosave("未存的正文");
    }

    it("shows the failure and keeps the changes unsaved", async () => {
      await failed();

      expect(session.status).toMatchObject({
        failureMessage: "No space left on device",
        hasUnsavedChanges: true,
      });
    });

    it("refuses the first switch after a failed save and keeps the article", async () => {
      await failed();

      const outcome = await session.openArticle({
        article: articleBody("other.md"),
        title: "另一篇",
      });

      expect(outcome).toBe("blockedByFailedSave");
      expect(session.status).toMatchObject({
        title: "寫作的禪",
        hasUnsavedChanges: true,
        failureMessage: "No space left on device",
      });
    });

    it("lets a second, informed switch through and drops the unsaved changes", async () => {
      await failed();
      await session.openArticle({ article: articleBody("other.md"), title: "另一篇" });
      const savesBefore = saveBody.mock.calls.length;

      const outcome = await session.openArticle({
        article: articleBody("other.md"),
        title: "另一篇",
      });

      expect(outcome).toBe("switched");
      expect(saveBody).toHaveBeenCalledTimes(savesBefore);
      expect(session.status).toMatchObject({ title: "另一篇", hasUnsavedChanges: false });
    });

    it("applies the same rule to closing the article", async () => {
      await failed();

      await expect(session.closeArticle()).resolves.toBe("blockedByFailedSave");
      await expect(session.closeArticle()).resolves.toBe("switched");
      expect(session.status).toEqual({ kind: "noArticle" });
    });

    it("gives every new failure its own refused first attempt", async () => {
      await failed();
      await session.closeArticle();
      saveBody.mockResolvedValue(saved());
      await typeAndAutosave("磁碟又有空間了");
      saveBody.mockResolvedValue(DISK_FULL);
      await typeAndAutosave("又存不進去");

      await expect(session.closeArticle()).resolves.toBe("blockedByFailedSave");
    });

    it("switches after a save succeeds on the way out", async () => {
      await failed();
      saveBody.mockResolvedValue(saved());

      await expect(session.closeArticle()).resolves.toBe("switched");
    });
  });

  describe("closing the window", () => {
    it("closes without saving or releasing focus when nothing is unsaved", async () => {
      await openZen();

      await expect(session.prepareToCloseWindow()).resolves.toBe("close");
      expect(saveBody).not.toHaveBeenCalled();
      expect(releaseFocus).not.toHaveBeenCalled();
    });

    it("closes right away without an open article", async () => {
      await expect(session.prepareToCloseWindow()).resolves.toBe("close");
    });

    it("releases focus, saves, and only then agrees to close", async () => {
      await openZen();
      session.changeBody("未存的正文");
      const save = deferred<ChannelResult<SavedBody>>();
      saveBody.mockReturnValueOnce(save.promise);

      let decision: string | undefined;
      void session.prepareToCloseWindow().then((answer) => {
        decision = answer;
      });
      await advance(0);
      expect(releaseFocus).toHaveBeenCalledTimes(1);
      expect(saveBody).toHaveBeenCalledTimes(1);
      expect(decision).toBeUndefined();

      save.resolve(saved());
      await advance(0);
      expect(decision).toBe("close");
    });

    it("waits for the composition the released focus ends before saving", async () => {
      await openZen();
      session.changeBody("組字中的正文");
      composition.start();
      releaseFocus.mockImplementation(() => composition.end());

      await expect(session.prepareToCloseWindow()).resolves.toBe("close");
      expect(saveBody).toHaveBeenCalledTimes(1);
    });

    it("stays open when the save fails and closes on the second attempt without saving", async () => {
      await openZen();
      saveBody.mockResolvedValue(DISK_FULL);
      session.changeBody("未存的正文");

      await expect(session.prepareToCloseWindow()).resolves.toBe("stay");
      expect(session.status).toMatchObject({ failureMessage: "No space left on device" });

      await expect(session.prepareToCloseWindow()).resolves.toBe("close");
      expect(saveBody).toHaveBeenCalledTimes(1);
      expect(releaseFocus).toHaveBeenCalledTimes(1);
    });

    it("stays open while the warning is unanswered and closes on the second attempt", async () => {
      await openZen();
      saveBody.mockResolvedValueOnce(MODIFIED_ELSEWHERE);
      await typeAndAutosave("Rustle 的正文");

      await expect(session.prepareToCloseWindow()).resolves.toBe("stay");
      expect(session.status).toMatchObject({ modifiedElsewhere: true });
      await expect(session.prepareToCloseWindow()).resolves.toBe("close");
      expect(saveBody).toHaveBeenCalledTimes(1);
    });
  });

  describe("races with leaving the article", () => {
    it("does not save or reload anything without an open article", async () => {
      await session.overwrite();
      await session.reload();

      expect(saveBody).not.toHaveBeenCalled();
      expect(readBody).not.toHaveBeenCalled();
    });

    it("ignores the answer of a save for an article that was already left", async () => {
      await openZen();
      saveBody.mockResolvedValueOnce(DISK_FULL);
      await typeAndAutosave("第一版");
      await session.closeArticle();
      const lateSave = deferred<ChannelResult<SavedBody>>();
      saveBody.mockReturnValueOnce(lateSave.promise);
      await typeAndAutosave("第二版");

      await session.openArticle({ article: articleBody("other.md"), title: "另一篇" });
      lateSave.resolve(DISK_FULL);
      await advance(0);

      expect(session.status).toMatchObject({ title: "另一篇", failureMessage: null });
    });

    it("ignores a reload that answers after another article was opened", async () => {
      await openZen();
      const lateRead = deferred<ChannelResult<ArticleBody>>();
      readBody.mockReturnValueOnce(lateRead.promise);
      const reloading = session.reload();
      await advance(0);
      expect(readBody).toHaveBeenCalledWith("Blog", "zen.md");

      await session.openArticle({
        article: articleBody("other.md", "另一篇的正文"),
        title: "另一篇",
      });
      lateRead.resolve({ ok: true, payload: articleBody("zen.md", "上一篇的正文") });
      await reloading;

      expect(session.document.body).toBe("另一篇的正文");
    });

    it("closes the window after saving even without a way to release focus", async () => {
      const plainSession = new AutosaveSession(composition, { saveBody, readBody });
      await plainSession.openArticle({ article: articleBody("zen.md"), title: "寫作的禪" });
      plainSession.changeBody("未存的正文");

      await expect(plainSession.prepareToCloseWindow()).resolves.toBe("close");
      plainSession.dispose();
    });
  });

  describe("status", () => {
    it("has no save status without an open article", () => {
      expect(session.status).toEqual({ kind: "noArticle" });
    });

    it("is saved right after opening an article", async () => {
      await openZen();

      expect(session.status).toEqual({
        kind: "article",
        workspace: "Blog",
        fileName: "zen.md",
        title: "寫作的禪",
        indicator: "saved",
        hasUnsavedChanges: false,
        modifiedElsewhere: false,
        failureMessage: null,
      });
    });

    it("becomes unsaved as soon as the body changes and saved once written", async () => {
      await openZen();
      const notified = vi.fn();
      session.subscribe(notified);

      session.changeBody("新的正文");
      expect(session.status).toMatchObject({ hasUnsavedChanges: true, indicator: "saving" });
      expect(notified).toHaveBeenCalled();

      await advance(1000);
      expect(session.status).toMatchObject({ hasUnsavedChanges: false, indicator: "saved" });
    });

    it("stays unsaved when typing continued while the save was in flight", async () => {
      await openZen();
      const save = deferred<ChannelResult<SavedBody>>();
      saveBody.mockReturnValueOnce(save.promise);
      await typeAndAutosave("第一版");

      session.changeBody("第二版");
      save.resolve(saved());
      await advance(0);

      expect(session.status).toMatchObject({ hasUnsavedChanges: true });
    });

    it("clears a failure once a later save succeeds", async () => {
      await openZen();
      saveBody.mockResolvedValueOnce(DISK_FULL);
      await typeAndAutosave("第一版");

      await typeAndAutosave("第二版");

      expect(session.status).toMatchObject({ failureMessage: null, hasUnsavedChanges: false, indicator: "saved" });
    });

    it("stops notifying an unsubscribed listener", async () => {
      const notified = vi.fn();
      const unsubscribe = session.subscribe(notified);

      unsubscribe();
      await openZen();

      expect(notified).not.toHaveBeenCalled();
    });
  });
});
