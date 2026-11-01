// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { CompositionState } from "../../shared/composition/CompositionState";
import { SettingsSession } from "../settings/SettingsSession";
import { EditingSurfaceFontSizes, FONT_SIZE_SURFACE_ATTRIBUTE } from "./EditingSurfaceFontSizes";
import { FontSize } from "./FontSize";

const STORED_SETTINGS: Settings = {
  indentation: { style: "spaces", width: 2 },
  previewPanel: { isOpen: true, widthRatio: 0.35 },
  lastOpened: { workspace: "Blog", article: "zen.md" },
  sidebar: { collapsedSections: [] },
};

const MOUSE_NOTCH = 100;

const attached: (() => void)[] = [];

type Surfaces = { editor: HTMLElement; preview: HTMLElement; sidebar: HTMLElement };

function surfaces(): Surfaces {
  document.body.innerHTML = `
    <nav class="sidebar"><p class="row">Blog</p></nav>
    <section ${FONT_SIZE_SURFACE_ATTRIBUTE}="editor"><div class="line">寫作</div></section>
    <section ${FONT_SIZE_SURFACE_ATTRIBUTE}="preview"><p class="line">寫作</p></section>`;
  const find = (selector: string) => {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`missing ${selector}`);
    }
    return element;
  };
  return {
    editor: find('[data-font-size-surface="editor"] .line'),
    preview: find('[data-font-size-surface="preview"] .line'),
    sidebar: find(".sidebar .row"),
  };
}

async function fontSizes(read: ChannelResult<Settings> = { ok: true, payload: STORED_SETTINGS }) {
  const channels = {
    readSettings: vi.fn(() => Promise.resolve(read)),
    writeSettings: vi.fn(() => Promise.resolve<ChannelResult<null>>({ ok: true, payload: null })),
  };
  const settings = new SettingsSession(channels);
  await settings.load();
  const composition = new CompositionState();
  const sizes = new EditingSurfaceFontSizes(settings, composition);
  const detach = sizes.attach(window);
  attached.push(detach);
  return { sizes, settings, channels, composition, detach };
}

function zoom(target: HTMLElement, deltaY: number, modifiers: WheelEventInit = { metaKey: true }): WheelEvent {
  const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true, ...modifiers });
  target.dispatchEvent(event);
  return event;
}

function pinch(target: HTMLElement, scales: number[]): Event[] {
  const fire = (type: string, scale: number) => {
    const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), { scale });
    target.dispatchEvent(event);
    return event;
  };
  return [fire("gesturestart", 1), ...scales.map((scale) => fire("gesturechange", scale)), fire("gestureend", 1)];
}

function hover(target: HTMLElement) {
  target.dispatchEvent(new Event("pointerover", { bubbles: true }));
}

function pressReset(init: KeyboardEventInit = { metaKey: true }): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "0", bubbles: true, cancelable: true, ...init });
  document.body.dispatchEvent(event);
  return event;
}

const pixels = (size: FontSize) => size.pixels;

describe("EditingSurfaceFontSizes", () => {
  let surface: Surfaces;

  beforeEach(() => {
    vi.useFakeTimers();
    surface = surfaces();
  });

  afterEach(() => {
    attached.splice(0).forEach((detach) => detach());
    vi.useRealTimers();
  });

  it("zooms the editor under the pointer and leaves the preview alone", async () => {
    const { sizes } = await fontSizes();

    zoom(surface.editor, -MOUSE_NOTCH);

    expect(sizes.snapshot.editor.pixels).toBeGreaterThan(15);
    expect(sizes.snapshot.preview).toBe(FontSize.DEFAULT);
  });

  it("zooms the preview under the pointer and leaves the editor alone", async () => {
    const { sizes } = await fontSizes();

    zoom(surface.preview, -MOUSE_NOTCH);

    expect(sizes.snapshot.preview.pixels).toBeGreaterThan(15);
    expect(sizes.snapshot.editor).toBe(FontSize.DEFAULT);
  });

  it("keeps each surface's own size", async () => {
    const { sizes } = await fontSizes();
    zoom(surface.editor, -20);
    zoom(surface.editor, -20);
    zoom(surface.editor, -20);
    const zoomedEditor = sizes.snapshot.editor.pixels;

    zoom(surface.preview, 20);

    expect(sizes.snapshot.preview.pixels).toBeLessThan(15);
    expect(sizes.snapshot.editor.pixels).toBe(zoomedEditor);
  });

  it("zooms nothing, not even the page, over the sidebar", async () => {
    const { sizes, channels } = await fontSizes();

    const wheel = zoom(surface.sidebar, -MOUSE_NOTCH);
    const pinchEvents = pinch(surface.sidebar, [1.5]);
    vi.runAllTimers();

    expect(wheel.defaultPrevented).toBe(true);
    expect(pinchEvents.every((event) => event.defaultPrevented)).toBe(true);
    expect(sizes.snapshot).toEqual({ editor: FontSize.DEFAULT, preview: FontSize.DEFAULT });
    expect(channels.writeSettings).not.toHaveBeenCalled();
  });

  it("leaves a plain wheel to scrolling", async () => {
    const { sizes } = await fontSizes();

    const wheel = zoom(surface.editor, -MOUSE_NOTCH, {});

    expect(wheel.defaultPrevented).toBe(false);
    expect(sizes.snapshot.editor).toBe(FontSize.DEFAULT);
  });

  it("keeps the page from zooming while it zooms a surface", async () => {
    await fontSizes();

    expect(zoom(surface.editor, -MOUSE_NOTCH, { ctrlKey: true }).defaultPrevented).toBe(true);
  });

  it("grows with every event of a pinch, not in jumps", async () => {
    const { sizes } = await fontSizes();
    const seen: number[] = [];
    sizes.subscribe(() => seen.push(sizes.snapshot.editor.pixels));

    pinch(surface.editor, [1.05, 1.1, 1.15, 1.2]);

    expect(seen).toHaveLength(4);
    expect(seen).toEqual([...seen].sort((first, second) => first - second));
    expect(new Set(seen).size).toBe(4);
  });

  it("comes back to the starting size after the same gesture the other way", async () => {
    const { sizes } = await fontSizes();

    pinch(surface.editor, [1.1, 1.3]);
    pinch(surface.editor, [1 / 1.1, 1 / 1.3]);

    expect(sizes.snapshot.editor.pixels).toBeCloseTo(15, 10);
  });

  it("zooms while the input method is composing, because a pinch is never the input method's", async () => {
    const { sizes, composition } = await fontSizes();
    composition.start();

    pinch(surface.editor, [1.5]);

    expect(sizes.snapshot.editor.pixels).toBeGreaterThan(15);
    expect(composition.isComposing).toBe(true);
  });

  it("stays at the smallest and the largest size", async () => {
    const { sizes } = await fontSizes();

    for (let notch = 0; notch < 10; notch += 1) {
      zoom(surface.editor, MOUSE_NOTCH);
      zoom(surface.preview, -MOUSE_NOTCH);
    }

    expect(sizes.snapshot.editor.pixels).toBe(10);
    expect(sizes.snapshot.preview.pixels).toBe(28);
  });

  it("opens with the remembered sizes, clamped by the same rule as a gesture", async () => {
    const { sizes } = await fontSizes({
      ok: true,
      payload: { ...STORED_SETTINGS, fontSize: { editor: 999, preview: 13.5 } },
    });

    expect(sizes.snapshot.editor).toEqual(FontSize.of(28));
    expect(sizes.snapshot.preview.pixels).toBe(13.5);
  });

  it("opens at the default when the settings have no size", async () => {
    const { sizes } = await fontSizes();

    expect(sizes.snapshot.editor).toBe(FontSize.DEFAULT);
  });

  it("writes a gesture once it is over, to a tenth of a pixel, keeping every other setting", async () => {
    const { sizes, channels } = await fontSizes({
      ok: true,
      payload: { ...STORED_SETTINGS, fontSize: { preview: 13.5 } },
    });
    for (let event = 0; event < 30; event += 1) {
      zoom(surface.editor, -1.5);
      vi.advanceTimersByTime(16);
    }

    expect(channels.writeSettings).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);

    expect(channels.writeSettings).toHaveBeenCalledTimes(1);
    expect(channels.writeSettings).toHaveBeenCalledWith({
      ...STORED_SETTINGS,
      fontSize: { preview: 13.5, editor: sizes.snapshot.editor.forSettings() },
    });
    expect(sizes.snapshot.editor.forSettings()).not.toBe(Math.round(sizes.snapshot.editor.pixels));
  });

  it("keeps the zoom on screen when the settings could not be read, without writing them", async () => {
    const { sizes, channels } = await fontSizes({ ok: false, reason: "unexpected", message: "broken" });

    zoom(surface.editor, -MOUSE_NOTCH);
    vi.runAllTimers();

    expect(sizes.snapshot.editor.pixels).toBeGreaterThan(15);
    expect(channels.writeSettings).not.toHaveBeenCalled();
  });

  it("keeps the zoom on screen when the settings cannot be written", async () => {
    const { sizes, channels } = await fontSizes();
    channels.writeSettings.mockResolvedValue({ ok: false, reason: "unexpected", message: "read-only" });

    zoom(surface.editor, -MOUSE_NOTCH);
    vi.runAllTimers();
    await Promise.resolve();

    expect(sizes.snapshot.editor.pixels).toBeGreaterThan(15);
  });

  it("puts the hovered surface back to the default with Cmd+0 and writes it at once", async () => {
    const { sizes, channels } = await fontSizes({
      ok: true,
      payload: { ...STORED_SETTINGS, fontSize: { editor: 22, preview: 12 } },
    });
    hover(surface.preview);

    const key = pressReset();

    expect(key.defaultPrevented).toBe(true);
    expect(sizes.snapshot.preview).toBe(FontSize.DEFAULT);
    expect(sizes.snapshot.editor.pixels).toBe(22);
    expect(channels.writeSettings).toHaveBeenCalledWith({
      ...STORED_SETTINGS,
      fontSize: { editor: 22, preview: 15 },
    });
  });

  it("puts the editor back with Ctrl+0 too", async () => {
    const { sizes } = await fontSizes();
    zoom(surface.editor, -MOUSE_NOTCH);
    hover(surface.editor);

    pressReset({ ctrlKey: true });

    expect(sizes.snapshot.editor).toBe(FontSize.DEFAULT);
  });

  it("does nothing on Cmd+0 when the surface is already at the default", async () => {
    const { channels } = await fontSizes();
    hover(surface.editor);

    pressReset();

    expect(channels.writeSettings).not.toHaveBeenCalled();
  });

  it("leaves Cmd+0 to the input method while it composes", async () => {
    const { sizes, composition } = await fontSizes();
    zoom(surface.editor, -MOUSE_NOTCH);
    const zoomed = sizes.snapshot.editor.pixels;
    hover(surface.editor);
    composition.start();

    const key = pressReset();

    expect(key.defaultPrevented).toBe(false);
    expect(sizes.snapshot.editor.pixels).toBe(zoomed);
  });

  it("leaves Cmd+0 alone over anything but a surface, and 0 alone without Cmd or Ctrl", async () => {
    const { sizes } = await fontSizes();
    zoom(surface.editor, -MOUSE_NOTCH);
    const zoomed = sizes.snapshot.editor.pixels;

    hover(surface.sidebar);
    const overSidebar = pressReset();
    hover(surface.editor);
    const plainZero = pressReset({});

    expect(overSidebar.defaultPrevented).toBe(false);
    expect(plainZero.defaultPrevented).toBe(false);
    expect(sizes.snapshot.editor.pixels).toBe(zoomed);
  });

  it("writes a gesture still waiting when it is disposed", async () => {
    const { sizes, channels } = await fontSizes();
    zoom(surface.editor, -MOUSE_NOTCH);

    sizes.dispose();

    expect(channels.writeSettings).toHaveBeenCalledTimes(1);
  });

  it("stops listening once detached", async () => {
    const { sizes, detach } = await fontSizes();
    detach();

    const wheel = zoom(surface.editor, -MOUSE_NOTCH);

    expect(wheel.defaultPrevented).toBe(false);
    expect(sizes.snapshot.editor).toBe(FontSize.DEFAULT);
  });

  it("tells its subscribers about the stored sizes and about every zoom", async () => {
    const { sizes, settings } = await fontSizes();
    const listener = vi.fn();
    const unsubscribe = sizes.subscribe(listener);

    settings.change((current) => ({ ...current, fontSize: { editor: 20 } }));
    zoom(surface.preview, -MOUSE_NOTCH);
    unsubscribe();
    zoom(surface.preview, -MOUSE_NOTCH);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(pixels(sizes.snapshot.editor)).toBe(20);
  });

  it("hands out the same snapshot until a size changes", async () => {
    const { sizes, settings } = await fontSizes();
    const before = sizes.snapshot;

    settings.change((current) => ({ ...current, lastOpened: { workspace: "Blog", article: "other.md" } }));

    expect(sizes.snapshot).toBe(before);
  });
});
