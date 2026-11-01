import { act, fireEvent, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { useWritingLayout } from "./useWritingLayout";
import { WritingLayout } from "./WritingLayout";

async function renderLayout(toggleShortcut?: string) {
  const stored: Settings = {
    ...DEFAULT_SETTINGS,
    previewPanel: { ...DEFAULT_SETTINGS.previewPanel, toggleShortcut },
  };
  const channels = {
    readSettings: vi.fn(() => Promise.resolve<ChannelResult<Settings>>({ ok: true, payload: stored })),
    writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
  };
  const settings = new SettingsSession(channels);
  await settings.load();
  const layout = new WritingLayout(settings);
  const composition = new CompositionState();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CompositionProvider state={composition}>{children}</CompositionProvider>
  );
  const { result } = renderHook(() => useWritingLayout(layout, settings), { wrapper });
  return { result, layout, composition, channels };
}

function pressShortcut(keys: Partial<KeyboardEventInit>) {
  act(() => {
    fireEvent.keyDown(window, keys);
  });
}

const MOD_SHIFT_P = { metaKey: true, shiftKey: true, key: "P", code: "KeyP" };

describe("useWritingLayout", () => {
  it("goes to editor only on Mod+Shift+P, back side by side on the next, and remembers it", async () => {
    const { result, channels } = await renderLayout();

    pressShortcut(MOD_SHIFT_P);
    expect(result.current.viewMode).toBe("editorOnly");
    expect(channels.writeSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ previewPanel: expect.objectContaining({ isOpen: false }) }),
    );

    pressShortcut(MOD_SHIFT_P);
    expect(result.current.viewMode).toBe("sideBySide");
  });

  it("brings the editor back from preview only on the shortcut", async () => {
    const { result, layout } = await renderLayout();
    act(() => layout.choose("previewOnly"));

    pressShortcut(MOD_SHIFT_P);

    expect(result.current).toMatchObject({ viewMode: "sideBySide", controlsLiveIn: "editor" });
  });

  it("toggles with Ctrl as well as Cmd", async () => {
    const { result } = await renderLayout();

    pressShortcut({ ctrlKey: true, shiftKey: true, key: "P", code: "KeyP" });

    expect(result.current.viewMode).toBe("editorOnly");
  });

  it("toggles on the shortcut written in the settings instead of the default", async () => {
    const { result } = await renderLayout("Mod+Alt+K");

    pressShortcut(MOD_SHIFT_P);
    expect(result.current.viewMode).toBe("sideBySide");
    pressShortcut({ metaKey: true, altKey: true, key: "˚", code: "KeyK" });
    expect(result.current.viewMode).toBe("editorOnly");
  });

  it.each(["", "???", "Shift", "Mod+Shift+"])("toggles on Mod+Shift+P when the setting is %j", async (written) => {
    const { result } = await renderLayout(written);

    pressShortcut(MOD_SHIFT_P);

    expect(result.current.viewMode).toBe("editorOnly");
  });

  it("leaves the shortcut to the input method while composing", async () => {
    const { result, composition } = await renderLayout();

    act(() => composition.start());
    pressShortcut(MOD_SHIFT_P);
    expect(result.current.viewMode).toBe("sideBySide");

    act(() => composition.end());
    pressShortcut(MOD_SHIFT_P);
    expect(result.current.viewMode).toBe("editorOnly");
  });

  it.each([
    ["Shift+P", { shiftKey: true, key: "P", code: "KeyP" }],
    ["Mod+P", { metaKey: true, key: "p", code: "KeyP" }],
    ["Escape", { key: "Escape", code: "Escape" }],
  ])("ignores %s", async (_name, keys) => {
    const { result } = await renderLayout();

    pressShortcut(keys);

    expect(result.current).toEqual({ viewMode: "sideBySide", isZen: false, controlsLiveIn: "editor" });
  });

  it("follows Zen Mode", async () => {
    const { result, layout } = await renderLayout();

    act(() => layout.toggleZen());

    expect(result.current.isZen).toBe(true);
  });
});
