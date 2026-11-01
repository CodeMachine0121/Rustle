import { describe, expect, it, vi } from "vitest";

import { ScrollSynchronizer, type ScrollPane } from "./ScrollSynchronizer";

type PaneState = { position: number; lineAtTop: number };

function pane(
  state: PaneState,
  { maximum = 1000, positionForLine = (line: number) => line * 20, snapTo = (position: number) => position } = {},
) {
  return {
    state,
    position: vi.fn(() => state.position),
    maximumPosition: vi.fn(() => maximum),
    lineAtTop: vi.fn(() => state.lineAtTop),
    positionForLine: vi.fn(positionForLine),
    scrollTo: vi.fn((position: number) => {
      state.position = snapTo(position);
    }),
  } satisfies ScrollPane & { state: PaneState };
}

function synchronized() {
  const synchronizer = new ScrollSynchronizer();
  const editor = pane({ position: 0, lineAtTop: 0 });
  const preview = pane({ position: 0, lineAtTop: 0 }, { snapTo: (position) => Math.floor(position / 100) * 100 });
  const editorSide = synchronizer.attach("editor", editor);
  const previewSide = synchronizer.attach("preview", preview);
  return { synchronizer, editor, preview, editorSide, previewSide };
}

describe("ScrollSynchronizer", () => {
  it("asks the preview to put the editor's top line at its top", () => {
    const { editor, preview, editorSide } = synchronized();
    editor.state.position = 108;
    editor.state.lineAtTop = 5.4;

    editorSide.scrolled();

    expect(preview.positionForLine).toHaveBeenCalledWith(5.4);
    expect(preview.scrollTo).toHaveBeenCalledWith(108);
  });

  it("asks the editor to put the preview's top line at its top", () => {
    const { editor, preview, previewSide } = synchronized();
    preview.state.position = 300;
    preview.state.lineAtTop = 12;

    previewSide.scrolled();

    expect(editor.positionForLine).toHaveBeenCalledWith(12);
    expect(editor.scrollTo).toHaveBeenCalledWith(240);
  });

  it("stops after one scroll: the preview's own scroll event does not move the editor", () => {
    const { editor, preview, editorSide, previewSide } = synchronized();
    editor.state.position = 250;
    editor.state.lineAtTop = 12.5;

    editorSide.scrolled();
    preview.state.lineAtTop = 10;
    previewSide.scrolled();

    expect(preview.scrollTo).toHaveBeenCalledTimes(1);
    expect(preview.state.position).toBe(200);
    expect(editor.scrollTo).not.toHaveBeenCalled();
  });

  it("follows the writer scrolling the side that has just followed", () => {
    const { editor, preview, editorSide, previewSide } = synchronized();
    editor.state.position = 250;
    editor.state.lineAtTop = 12.5;
    editorSide.scrolled();

    preview.state.position = 600;
    preview.state.lineAtTop = 30;
    previewSide.scrolled();

    expect(editor.scrollTo).toHaveBeenCalledWith(600);
  });

  it("writes nothing and remembers nothing when the follower is already in place", () => {
    const { editor, preview, editorSide, previewSide } = synchronized();
    preview.state.position = 100;
    editor.state.position = 100;
    editor.state.lineAtTop = 5;

    editorSide.scrolled();
    expect(preview.scrollTo).not.toHaveBeenCalled();

    preview.state.lineAtTop = 5;
    previewSide.scrolled();
    expect(editor.scrollTo).not.toHaveBeenCalled();

    preview.state.position = 400;
    preview.state.lineAtTop = 20;
    previewSide.scrolled();
    expect(editor.scrollTo).toHaveBeenCalledWith(400);
  });

  it("follows a scroll event of a follower that could not move, even at the same position", () => {
    const synchronizer = new ScrollSynchronizer();
    const editor = pane({ position: 0, lineAtTop: 0 });
    const preview = pane({ position: 0, lineAtTop: 0 }, { snapTo: () => 0 });
    const editorSide = synchronizer.attach("editor", editor);
    const previewSide = synchronizer.attach("preview", preview);
    editor.state.position = 200;
    editor.state.lineAtTop = 10;
    editorSide.scrolled();

    previewSide.scrolled();

    expect(editor.scrollTo).toHaveBeenCalledWith(0);
  });

  it.each([
    ["top", 0, 0],
    ["bottom", 1000, 1000],
  ])("takes the follower to its %s when the leader is at its own", (_edge, leaderPosition, target) => {
    const synchronizer = new ScrollSynchronizer();
    const editor = pane({ position: 500, lineAtTop: 25 }, { maximum: 1000 });
    const preview = pane({ position: 500, lineAtTop: 20 }, { maximum: 1000, positionForLine: () => 700 });
    synchronizer.attach("preview", preview);
    const editorSide = synchronizer.attach("editor", editor);
    editor.state.position = leaderPosition;

    editorSide.scrolled();

    expect(preview.scrollTo).toHaveBeenCalledWith(target);
  });

  it("keeps the follower's position within its range", () => {
    const synchronizer = new ScrollSynchronizer();
    const editor = pane({ position: 500, lineAtTop: 25 });
    const preview = pane({ position: 0, lineAtTop: 0 }, { maximum: 300, positionForLine: () => 900 });
    synchronizer.attach("preview", preview);

    synchronizer.attach("editor", editor).scrolled();

    expect(preview.scrollTo).toHaveBeenCalledWith(300);
  });

  it("does nothing with only one side attached", () => {
    const synchronizer = new ScrollSynchronizer();
    const editor = pane({ position: 200, lineAtTop: 10 });

    expect(() => synchronizer.attach("editor", editor).scrolled()).not.toThrow();
    expect(editor.scrollTo).not.toHaveBeenCalled();
  });

  it("stops following a side once it is detached", () => {
    const { editor, preview, editorSide, previewSide } = synchronized();
    previewSide.detach();
    editor.state.position = 200;
    editor.state.lineAtTop = 10;

    editorSide.scrolled();
    previewSide.scrolled();

    expect(preview.scrollTo).not.toHaveBeenCalled();
    expect(editor.scrollTo).not.toHaveBeenCalled();
  });

  it("keeps a newer pane attached when an older one on the same side is detached", () => {
    const { synchronizer, editor, previewSide } = synchronized();
    const newerPreview = pane({ position: 0, lineAtTop: 0 });
    synchronizer.attach("preview", newerPreview);
    previewSide.detach();
    editor.state.position = 200;
    editor.state.lineAtTop = 10;

    synchronizer.attach("editor", editor).scrolled();

    expect(newerPreview.scrollTo).toHaveBeenCalledWith(200);
  });
});
