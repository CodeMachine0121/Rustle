import { useSyncExternalStore } from "react";

import type { ImagePaste } from "./ImagePaste";

type ImagePasteStatusLineProps = {
  imagePaste: ImagePaste;
};

/** One line above the editor that never blocks typing. */
export function ImagePasteStatusLine({ imagePaste }: ImagePasteStatusLineProps) {
  const status = useSyncExternalStore(imagePaste.subscribe, () => imagePaste.status);

  switch (status.kind) {
    case "idle":
      return null;
    case "saving":
      return (
        <p className="image-paste-status" role="status">
          正在存圖片…
        </p>
      );
    case "failed":
      return (
        <p className="image-paste-status image-paste-status--failed" role="alert">
          圖片沒有存進去：{status.message}
        </p>
      );
  }
}
