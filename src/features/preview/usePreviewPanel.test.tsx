import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
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
  const { result } = renderHook(() => usePreviewPanel(settings));
  return { result, channels };
}

describe("usePreviewPanel", () => {
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
        sidebar: { collapsedSections: [] },
      });
    });
  });
});
