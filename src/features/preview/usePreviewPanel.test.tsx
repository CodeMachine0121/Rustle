import { act, fireEvent, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { PreviewWidth } from "./PreviewWidth";
import { usePreviewPanel } from "./usePreviewPanel";

async function openPanel(toggleShortcut?: string, widthRatio = 0.5) {
  const stored: Settings = {
    ...DEFAULT_SETTINGS,
    previewPanel: { ...DEFAULT_SETTINGS.previewPanel, toggleShortcut, widthRatio },
    lastOpened: { workspace: "Blog", article: "zen.md" },
  };
  const channels = {
    readSettings: vi.fn(() => Promise.resolve<ChannelResult<Settings>>({ ok: true, payload: stored })),
    writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
  };
  const settings = new SettingsSession(channels);
  await settings.load();
  const composition = new CompositionState();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CompositionProvider state={composition}>{children}</CompositionProvider>
  );
  const { result } = renderHook(() => usePreviewPanel(settings), { wrapper });
  return { result, composition, channels };
}

function pressShortcut(keys: Partial<KeyboardEventInit>) {
  act(() => {
    fireEvent.keyDown(window, keys);
  });
}

const MOD_SHIFT_P = { metaKey: true, shiftKey: true, key: "P", code: "KeyP" };

describe("usePreviewPanel", () => {
  it("closes and opens the panel and remembers it", async () => {
    const { result, channels } = await openPanel();

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(channels.writeSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ previewPanel: expect.objectContaining({ isOpen: false }) }),
    );

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
  });

  it("collapses on Mod+Shift+P and expands on the next Mod+Shift+P", async () => {
    const { result } = await openPanel();

    pressShortcut(MOD_SHIFT_P);
    expect(result.current.isOpen).toBe(false);
    pressShortcut(MOD_SHIFT_P);
    expect(result.current.isOpen).toBe(true);
  });

  it("toggles on Mod+Shift+P, with Ctrl as well as Cmd", async () => {
    const { result } = await openPanel();

    pressShortcut(MOD_SHIFT_P);
    expect(result.current.isOpen).toBe(false);
    pressShortcut({ ctrlKey: true, shiftKey: true, key: "P", code: "KeyP" });
    expect(result.current.isOpen).toBe(true);
  });

  it("toggles on the shortcut written in the settings instead of the default", async () => {
    const { result } = await openPanel("Mod+Alt+K");

    pressShortcut({ metaKey: true, altKey: true, key: "˚", code: "KeyK" });
    expect(result.current.isOpen).toBe(false);
    pressShortcut(MOD_SHIFT_P);
    expect(result.current.isOpen).toBe(false);
  });

  it.each(["", "???", "Shift", "Mod+Shift+"])("toggles on Mod+Shift+P when the setting is %j", async (written) => {
    const { result } = await openPanel(written);

    pressShortcut(MOD_SHIFT_P);

    expect(result.current.isOpen).toBe(false);
  });

  it("leaves the shortcut to the input method while composing", async () => {
    const { result, composition } = await openPanel();

    act(() => composition.start());
    pressShortcut(MOD_SHIFT_P);
    expect(result.current.isOpen).toBe(true);

    act(() => composition.end());
    pressShortcut(MOD_SHIFT_P);
    expect(result.current.isOpen).toBe(false);
  });

  it.each([
    ["Shift+P", { shiftKey: true, key: "P", code: "KeyP" }],
    ["Mod+P", { metaKey: true, key: "p", code: "KeyP" }],
  ])("ignores %s", async (_name, keys) => {
    const { result } = await openPanel();

    pressShortcut(keys);

    expect(result.current.isOpen).toBe(true);
  });

  describe("width", () => {
    it.each([
      [0.35, 0.35],
      [0.97, 0.8],
    ])("shows a stored ratio of %f as %f", async (stored, shown) => {
      const { result } = await openPanel(undefined, stored);

      expect(result.current.width.ratio).toBeCloseTo(shown);
    });

    it("follows a drag on screen without writing the settings", async () => {
      const { result, channels } = await openPanel();

      act(() => result.current.resize(PreviewWidth.of(0.6)));
      act(() => result.current.resize(PreviewWidth.of(0.7)));

      expect(result.current.width.ratio).toBeCloseTo(0.7);
      expect(channels.writeSettings).not.toHaveBeenCalled();
    });

    it("remembers the width on release and keeps every other setting", async () => {
      const { result, channels } = await openPanel("Mod+Alt+K");
      act(() => result.current.resize(PreviewWidth.of(0.6)));

      act(() => result.current.commitWidth(PreviewWidth.of(0.65)));

      expect(result.current.width.ratio).toBeCloseTo(0.65);
      expect(channels.writeSettings).toHaveBeenCalledTimes(1);
      expect(channels.writeSettings).toHaveBeenCalledWith({
        indentation: DEFAULT_SETTINGS.indentation,
        previewPanel: { isOpen: true, widthRatio: 0.65, toggleShortcut: "Mod+Alt+K" },
        lastOpened: { workspace: "Blog", article: "zen.md" },
      });
    });
  });
});
