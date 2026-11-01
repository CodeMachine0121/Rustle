import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { AutosaveSession } from "./AutosaveSession";
import { useAutosaveStatus } from "./useAutosaveSession";

type SaveStatusBarProps = {
  session: AutosaveSession;
};

export function SaveStatusBar({ session }: SaveStatusBarProps) {
  const status = useAutosaveStatus(session);
  const messages = useMessages();

  if (status.kind === "noArticle") {
    return <header className="save-status-bar" aria-label={messages.titleBar} />;
  }

  return (
    <header className="save-status-bar" aria-label={messages.titleBar}>
      <span className="save-status-bar__title">{status.title}</span>
      {status.failureMessage !== null && (
        <span className="save-status-bar__failure" role="alert">
          {messages.saveFailed(status.failureMessage)}
        </span>
      )}
      {status.modifiedElsewhere ? (
        <span className="save-status-bar__warning" role="alert">
          {messages.changedOutsideRustle}
          <button type="button" onClick={() => void session.overwrite()}>
            {messages.overwrite}
          </button>
          <button type="button" onClick={() => void session.reload()}>
            {messages.reload}
          </button>
        </span>
      ) : (
        <span className="save-status-bar__state">
          {status.hasUnsavedChanges ? messages.unsavedChanges : messages.saved}
        </span>
      )}
    </header>
  );
}
