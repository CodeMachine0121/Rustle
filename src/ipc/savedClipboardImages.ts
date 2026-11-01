export type SavedClipboardImage = { relativePath: string };

/** The images one paste stored, in clipboard order; empty when it held none. */
export type SavedClipboardImages = { images: SavedClipboardImage[] };
