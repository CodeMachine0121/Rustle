import type { CompositionState } from "../../shared/composition/CompositionState";
import type { SettingsSession } from "../settings/SettingsSession";
import { FontSize } from "./FontSize";
import { ZoomGesture } from "./ZoomGesture";

export type FontSizeSurface = "editor" | "preview";

export type EditingSurfaceFontSizesSnapshot = Readonly<Record<FontSizeSurface, FontSize>>;

/** Marks the element whose text a zoom over it scales. */
export const FONT_SIZE_SURFACE_ATTRIBUTE = "data-font-size-surface";

// A gesture is a burst of events; it is over once they stop for this long.
const WRITE_AFTER_IDLE_MILLISECONDS = 300;

type PinchEvent = Event & { readonly scale: number };

/**
 * The editor's and the preview's font sizes. A zoom acts on the surface
 * under the pointer, shows at once and is written once the gesture is
 * over; nothing outside the two surfaces, and never the whole page, is
 * zoomed. A pinch is never the input method's, so it works while
 * composing; Cmd/Ctrl+0 is a key, so it steps aside.
 */
export class EditingSurfaceFontSizes {
  readonly #settings: SettingsSession;
  readonly #composition: CompositionState;
  readonly #gesture = new ZoomGesture();
  readonly #listeners = new Set<() => void>();
  // What this session set, unrounded: the settings keep a rounded copy.
  readonly #shown: Partial<Record<FontSizeSurface, FontSize>> = {};
  #snapshot: EditingSurfaceFontSizesSnapshot = { editor: FontSize.DEFAULT, preview: FontSize.DEFAULT };
  #hoveredSurface: FontSizeSurface | null = null;
  #pinchedSurface: FontSizeSurface | null = null;
  #pendingWrite: ReturnType<typeof setTimeout> | null = null;

  constructor(settings: SettingsSession, composition: CompositionState) {
    this.#settings = settings;
    this.#composition = composition;
  }

  get snapshot(): EditingSurfaceFontSizesSnapshot {
    const editor = this.#sizeOf("editor");
    const preview = this.#sizeOf("preview");
    if (editor.pixels !== this.#snapshot.editor.pixels || preview.pixels !== this.#snapshot.preview.pixels) {
      this.#snapshot = { editor, preview };
    }
    return this.#snapshot;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    const unsubscribeFromSettings = this.#settings.subscribe(listener);
    return () => {
      this.#listeners.delete(listener);
      unsubscribeFromSettings();
    };
  };

  /** Listens to the window; returns what stops listening. */
  attach(target: Window): () => void {
    const onWheel = (event: WheelEvent) => {
      const ratio = this.#gesture.ratioForWheel(event);
      if (ratio === null) {
        return;
      }
      event.preventDefault();
      this.#scale(surfaceOf(event.target), ratio);
    };
    const onPinchStart = (event: Event) => {
      event.preventDefault();
      this.#gesture.startPinch();
      this.#pinchedSurface = surfaceOf(event.target);
    };
    const onPinchChange = (event: Event) => {
      event.preventDefault();
      this.#scale(this.#pinchedSurface, this.#gesture.ratioForPinch((event as PinchEvent).scale));
    };
    const onPinchEnd = (event: Event) => {
      event.preventDefault();
      this.#pinchedSurface = null;
    };
    const onPointerOver = (event: PointerEvent) => {
      this.#hoveredSurface = surfaceOf(event.target);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const isReset = (event.metaKey || event.ctrlKey) && event.key === "0";
      if (!isReset || this.#hoveredSurface === null || this.#composition.ownsKey(event)) {
        return;
      }
      event.preventDefault();
      this.#reset(this.#hoveredSurface);
    };
    const options = { capture: true, passive: false };
    target.addEventListener("wheel", onWheel, options);
    target.addEventListener("gesturestart", onPinchStart, options);
    target.addEventListener("gesturechange", onPinchChange, options);
    target.addEventListener("gestureend", onPinchEnd, options);
    target.addEventListener("pointerover", onPointerOver, true);
    target.addEventListener("keydown", onKeyDown, true);
    return () => {
      target.removeEventListener("wheel", onWheel, options);
      target.removeEventListener("gesturestart", onPinchStart, options);
      target.removeEventListener("gesturechange", onPinchChange, options);
      target.removeEventListener("gestureend", onPinchEnd, options);
      target.removeEventListener("pointerover", onPointerOver, true);
      target.removeEventListener("keydown", onKeyDown, true);
    };
  }

  /** Writes a gesture still waiting to be written. */
  dispose(): void {
    if (this.#pendingWrite !== null) {
      this.#write();
    }
  }

  #sizeOf(surface: FontSizeSurface): FontSize {
    return this.#shown[surface] ?? FontSize.of(this.#settings.settings.fontSize?.[surface]);
  }

  #scale(surface: FontSizeSurface | null, ratio: number): void {
    if (surface === null) {
      return;
    }
    this.#show(surface, this.#sizeOf(surface).scaledBy(ratio));
    if (this.#pendingWrite !== null) {
      clearTimeout(this.#pendingWrite);
    }
    this.#pendingWrite = setTimeout(() => this.#write(), WRITE_AFTER_IDLE_MILLISECONDS);
  }

  #reset(surface: FontSizeSurface): void {
    if (this.#sizeOf(surface).isDefault) {
      return;
    }
    this.#show(surface, FontSize.DEFAULT);
    this.#write();
  }

  #show(surface: FontSizeSurface, size: FontSize): void {
    this.#shown[surface] = size;
    this.#listeners.forEach((listener) => listener());
  }

  #write(): void {
    if (this.#pendingWrite !== null) {
      clearTimeout(this.#pendingWrite);
      this.#pendingWrite = null;
    }
    const { editor, preview } = this.#shown;
    this.#settings.change((current) => ({
      ...current,
      fontSize: {
        ...current.fontSize,
        ...(editor === undefined ? {} : { editor: editor.forSettings() }),
        ...(preview === undefined ? {} : { preview: preview.forSettings() }),
      },
    }));
  }
}

function surfaceOf(target: EventTarget | null): FontSizeSurface | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const surface = target.closest(`[${FONT_SIZE_SURFACE_ATTRIBUTE}]`)?.getAttribute(FONT_SIZE_SURFACE_ATTRIBUTE);
  return surface === "editor" || surface === "preview" ? surface : null;
}
