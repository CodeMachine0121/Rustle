import { useSyncExternalStore } from "react";

import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { ImagePaste } from "./ImagePaste";

type ImagePasteStatusLineProps = {
  imagePaste: ImagePaste;
};

/** One line above the editor that never blocks typing. */
export function ImagePasteStatusLine({ imagePaste }: ImagePasteStatusLineProps) {
  const status = useSyncExternalStore(imagePaste.subscribe, () => imagePaste.status);
  const messages = useMessages();

  switch (status.kind) {
    case "idle":
      return null;
    case "saving":
      return (
        <p className="image-paste-status" role="status">
          {messages.savingImage}
        </p>
      );
    case "failed":
      return (
        <p className="image-paste-status image-paste-status--failed" role="alert">
          {messages.imageNotSaved(status.message)}
        </p>
      );
  }
}
