import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import type { ArticleHolder } from "../vault/VaultSession";
import { WritingLayout, type ViewMode } from "./WritingLayout";

async function layoutWith(isOpen = true) {
  const stored: Settings = { ...DEFAULT_SETTINGS, previewPanel: { isOpen, widthRatio: 0.35 } };
  const channels = {
    readSettings: vi.fn(() => Promise.resolve<ChannelResult<Settings>>({ ok: true, payload: stored })),
    writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
  };
  const settings = new SettingsSession(channels);
  await settings.load();
  return { layout: new WritingLayout(settings), settings, channels };
}

function holderAnswering(outcome: Awaited<ReturnType<ArticleHolder["closeArticle"]>>): ArticleHolder {
  return {
    openArticle: vi.fn(() => Promise.resolve(outcome)),
    closeArticle: vi.fn(() => Promise.resolve(outcome)),
    placeCursor: vi.fn(),
  };
}

const OPENED = {
  article: { workspace: "Blog", fileName: "zen.md", body: "", lastKnownModifiedAt: "" },
  title: "Zen",
};

describe("WritingLayout", () => {
  it.each<[boolean, ViewMode]>([
    [true, "sideBySide"],
    [false, "editorOnly"],
  ])("starts from the remembered preview (open: %s) as %s, never in Zen Mode", async (isOpen, viewMode) => {
    const { layout } = await layoutWith(isOpen);

    expect(layout.snapshot).toEqual({ viewMode, isZen: false, controlsLiveIn: "editor" });
  });

  it.each<[ViewMode, boolean]>([
    ["editorOnly", false],
    ["sideBySide", true],
    ["previewOnly", true],
  ])("remembers choosing %s as the preview being open: %s", async (viewMode, isOpen) => {
    const { layout, settings } = await layoutWith(viewMode === "editorOnly");

    layout.choose(viewMode);

    expect(layout.snapshot.viewMode).toBe(viewMode);
    expect(settings.settings.previewPanel).toEqual({ isOpen, widthRatio: 0.35 });
  });

  it("does not write the settings when the choice keeps the preview as it was", async () => {
    const { layout, channels } = await layoutWith(true);

    layout.choose("previewOnly");
    layout.choose("sideBySide");

    expect(channels.writeSettings).not.toHaveBeenCalled();
  });

  it("starts side by side again after preview only, as only the open preview is remembered", async () => {
    const { layout, settings } = await layoutWith(true);
    layout.choose("previewOnly");

    expect(new WritingLayout(settings).snapshot.viewMode).toBe("sideBySide");
  });

  it("moves the controls to the preview's header in preview only and back", async () => {
    const { layout } = await layoutWith();

    layout.choose("previewOnly");
    expect(layout.snapshot.controlsLiveIn).toBe("preview");

    layout.choose("sideBySide");
    expect(layout.snapshot.controlsLiveIn).toBe("editor");
  });

  it("hands the keyboard to the moved buttons once, only when a choice moved them", async () => {
    const { layout } = await layoutWith();

    layout.choose("editorOnly");
    expect(layout.takeControlsFocus()).toBe(false);

    layout.choose("previewOnly");
    expect(layout.takeControlsFocus()).toBe(true);
    expect(layout.takeControlsFocus()).toBe(false);

    layout.toggleZen();
    layout.togglePreviewFromShortcut();
    expect(layout.takeControlsFocus()).toBe(false);
  });

  it.each<[ViewMode, ViewMode]>([
    ["sideBySide", "editorOnly"],
    ["editorOnly", "sideBySide"],
    ["previewOnly", "sideBySide"],
  ])("turns %s into %s on the preview shortcut", async (from, to) => {
    const { layout } = await layoutWith();
    layout.choose(from);

    layout.togglePreviewFromShortcut();

    expect(layout.snapshot.viewMode).toBe(to);
  });

  it("turns Zen Mode on and off without touching the view mode or the settings", async () => {
    const { layout, channels } = await layoutWith();
    layout.choose("previewOnly");

    layout.toggleZen();
    expect(layout.snapshot).toEqual({ viewMode: "previewOnly", isZen: true, controlsLiveIn: "preview" });

    layout.choose("editorOnly");
    expect(layout.snapshot.isZen).toBe(true);

    layout.toggleZen();
    expect(layout.snapshot.isZen).toBe(false);
    expect(channels.writeSettings).toHaveBeenCalledTimes(1);
  });

  it("tells subscribers about its own changes and the settings', and stops when asked", async () => {
    const { layout, settings } = await layoutWith();
    const listener = vi.fn();
    const unsubscribe = layout.subscribe(listener);

    layout.toggleZen();
    settings.change((current) => ({ ...current, previewPanel: { ...current.previewPanel, isOpen: false } }));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(layout.snapshot.viewMode).toBe("editorOnly");

    unsubscribe();
    layout.toggleZen();
    settings.change((current) => ({ ...current, previewPanel: { ...current.previewPanel, isOpen: true } }));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("forgets preview only once the settings close the preview from elsewhere", async () => {
    const { layout, settings } = await layoutWith();
    layout.choose("previewOnly");

    settings.change((current) => ({ ...current, previewPanel: { ...current.previewPanel, isOpen: false } }));
    settings.change((current) => ({ ...current, previewPanel: { ...current.previewPanel, isOpen: true } }));

    expect(layout.snapshot.viewMode).toBe("sideBySide");
  });

  it("gives the same snapshot until something changes", async () => {
    const { layout } = await layoutWith();
    const first = layout.snapshot;

    expect(layout.snapshot).toBe(first);
    layout.toggleZen();
    expect(layout.snapshot).not.toBe(first);
  });

  describe("revealing the editor", () => {
    it.each(["blockedByUnansweredWarning", "blockedByFailedSave"] as const)(
      "brings the editor back from preview only when leaving is refused (%s), without remembering it",
      async (refusal) => {
        const { layout, channels } = await layoutWith();
        layout.choose("previewOnly");
        const holder = layout.revealEditorWhenNeeded(holderAnswering(refusal));

        await expect(holder.openArticle(OPENED)).resolves.toBe(refusal);

        expect(layout.snapshot.viewMode).toBe("sideBySide");
        expect(channels.writeSettings).not.toHaveBeenCalled();
      },
    );

    it("brings the editor back when closing the article is refused", async () => {
      const { layout } = await layoutWith();
      layout.choose("previewOnly");

      await layout.revealEditorWhenNeeded(holderAnswering("blockedByFailedSave")).closeArticle();

      expect(layout.snapshot.viewMode).toBe("sideBySide");
    });

    it("stays in preview only when the article is let go", async () => {
      const { layout } = await layoutWith();
      layout.choose("previewOnly");
      const inner = holderAnswering("switched");
      const holder = layout.revealEditorWhenNeeded(inner);

      await expect(holder.openArticle(OPENED)).resolves.toBe("switched");
      await expect(holder.closeArticle()).resolves.toBe("switched");

      expect(inner.openArticle).toHaveBeenCalledWith(OPENED);
      expect(layout.snapshot.viewMode).toBe("previewOnly");
    });

    it("brings the editor back from preview only for an opened article that asks for the keyboard", async () => {
      const { layout, channels } = await layoutWith();
      layout.choose("previewOnly");
      const holder = layout.revealEditorWhenNeeded(holderAnswering("switched"));

      await holder.openArticle({ ...OPENED, focusEditor: true });

      expect(layout.snapshot.viewMode).toBe("sideBySide");
      expect(channels.writeSettings).not.toHaveBeenCalled();
    });

    it("brings the editor back from preview only to place the cursor in the open article", async () => {
      const { layout, channels } = await layoutWith();
      layout.choose("previewOnly");
      const inner = holderAnswering("switched");

      layout.revealEditorWhenNeeded(inner).placeCursor(12);

      expect(inner.placeCursor).toHaveBeenCalledWith(12);
      expect(layout.snapshot.viewMode).toBe("sideBySide");
      expect(channels.writeSettings).not.toHaveBeenCalled();
    });

    it("leaves editor only alone on a refusal", async () => {
      const { layout } = await layoutWith(false);
      const listener = vi.fn();
      layout.subscribe(listener);

      await layout.revealEditorWhenNeeded(holderAnswering("blockedByFailedSave")).closeArticle();

      expect(layout.snapshot.viewMode).toBe("editorOnly");
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
