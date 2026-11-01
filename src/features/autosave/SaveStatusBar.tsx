import type { AutosaveSession } from "./AutosaveSession";
import { useAutosaveStatus } from "./useAutosaveSession";

type SaveStatusBarProps = {
  session: AutosaveSession;
};

export function SaveStatusBar({ session }: SaveStatusBarProps) {
  const status = useAutosaveStatus(session);

  if (status.kind === "noArticle") {
    return <header className="save-status-bar" aria-label="標題列" />;
  }

  return (
    <header className="save-status-bar" aria-label="標題列">
      <span className="save-status-bar__title">{status.title}</span>
      {status.modifiedElsewhere ? (
        <span className="save-status-bar__warning" role="alert">
          檔案在外部被改動過
          <button type="button" onClick={() => void session.overwrite()}>
            覆寫
          </button>
          <button type="button" onClick={() => void session.reload()}>
            重新載入
          </button>
        </span>
      ) : (
        <>
          {status.failureMessage !== null && (
            <span className="save-status-bar__failure" role="alert">
              儲存失敗：{status.failureMessage}
            </span>
          )}
          <span className="save-status-bar__state">
            {status.hasUnsavedChanges ? "未儲存的變更" : "已儲存"}
          </span>
        </>
      )}
    </header>
  );
}
