import { Check, CircleAlert, LoaderCircle } from "lucide-react";

import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { AutosaveSession, SaveIndicator } from "./AutosaveSession";
import { useAutosaveStatus } from "./useAutosaveSession";

type SaveStatusLineProps = {
  session: AutosaveSession;
};

/**
 * The line under the editor: `workspace ❯ file name` on the left, a save
 * indicator with no words on the right, and a failed save or an outside
 * change spelled out between them. Nothing while no article is open.
 */
export function SaveStatusLine({ session }: SaveStatusLineProps) {
  const status = useAutosaveStatus(session);
  const messages = useMessages();

  if (status.kind === "noArticle") {
    return null;
  }

  return (
    <footer className="save-status-line" aria-label={messages.saveStatusLine}>
      <span className="article-path" aria-label={messages.articlePath(status.workspace, status.fileName)}>
        <span className="article-path__workspace">{status.workspace}</span>
        <span className="article-path__separator" aria-hidden="true">
          ❯
        </span>
        <span className="article-path__file">{status.fileName}</span>
      </span>
      {status.failureMessage !== null && (
        <span className="save-status-line__failure" role="alert">
          {messages.saveFailed(status.failureMessage)}
        </span>
      )}
      {status.modifiedElsewhere && (
        <span className="save-status-line__warning" role="alert">
          {messages.changedOutsideRustle}
          <button type="button" onClick={() => void session.overwrite()}>
            {messages.overwrite}
          </button>
          <button type="button" onClick={() => void session.reload()}>
            {messages.reload}
          </button>
        </span>
      )}
      <SaveIndicatorMark indicator={status.indicator} />
    </footer>
  );
}

function SaveIndicatorMark({ indicator }: { indicator: SaveIndicator }) {
  const messages = useMessages();
  const Mark = INDICATOR_MARKS[indicator];
  return (
    <span
      className={`save-indicator save-indicator--${indicator}`}
      role="img"
      aria-label={messages.saveIndicators[indicator]}
      data-indicator={indicator}
    >
      <Mark className="icon" aria-hidden="true" />
    </span>
  );
}

const INDICATOR_MARKS = {
  saving: LoaderCircle,
  saved: Check,
  failed: CircleAlert,
} satisfies Record<SaveIndicator, typeof Check>;
