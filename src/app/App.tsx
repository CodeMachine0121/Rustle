import { useEffect, useState } from "react";

import { AutosaveSession } from "../features/autosave/AutosaveSession";
import { watchWindowCloseRequests } from "../features/autosave/watchWindowCloseRequests";
import { vocabularyOf } from "../features/articleMetadata/articleVocabulary";
import { CreateArticleDialog } from "../features/createArticle/CreateArticleDialog";
import { ConfirmDeletionDialog } from "../features/deletion/ConfirmDeletionDialog";
import { EditArticleMetadataDialog } from "../features/editArticleMetadata/EditArticleMetadataDialog";
import { PreviewedBody } from "../features/preview/PreviewedBody";
import { PreviewPanel } from "../features/preview/PreviewPanel";
import { usePreviewPanel } from "../features/preview/usePreviewPanel";
import { SettingsSession } from "../features/settings/SettingsSession";
import { ArticleColumn } from "../features/vault/ArticleColumn";
import { EditorColumn } from "../features/vault/EditorColumn";
import { OperationFailureNotice } from "../features/vault/OperationFailureNotice";
import { useVaultSnapshot } from "../features/vault/useVaultSnapshot";
import { VaultSession } from "../features/vault/VaultSession";
import { WorkspaceColumn } from "../features/vault/WorkspaceColumn";
import type { ArticleSummary } from "../ipc/articleSummary";
import { channels } from "../ipc/channels";
import type { WorkspaceContents } from "../ipc/workspaceContents";
import { CompositionProvider, useCompositionState } from "../shared/composition/CompositionContext";
import { AppLayout } from "./AppLayout";

export function App() {
  return (
    <CompositionProvider>
      <VaultView />
    </CompositionProvider>
  );
}

function VaultView() {
  const composition = useCompositionState();
  const [autosave] = useState(
    () => new AutosaveSession(composition, channels, { releaseFocus: blurFocusedElement }),
  );
  const [settings] = useState(() => new SettingsSession(channels));
  const [session] = useState(() => new VaultSession(channels, autosave, settings));
  const [previewedBody] = useState(() => new PreviewedBody(autosave, composition));
  const snapshot = useVaultSnapshot(session);
  const previewPanel = usePreviewPanel(settings);
  const [articleDialogOpenedAt, setArticleDialogOpenedAt] = useState<Date | null>(null);
  const [articleBeingEdited, setArticleBeingEdited] = useState<ArticleSummary | null>(null);
  const [articleToDelete, setArticleToDelete] = useState<ArticleSummary | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<
    { workspace: string; contents: WorkspaceContents } | null
  >(null);

  const askToDeleteWorkspace = async (workspace: string) => {
    const contents = await session.countWorkspaceContents(workspace);
    if (contents !== null) {
      setWorkspaceToDelete({ workspace, contents });
    }
  };

  useEffect(() => {
    void session.start();
  }, [session]);

  useEffect(() => {
    void watchWindowCloseRequests(autosave, channels);
    return () => autosave.dispose();
  }, [autosave]);

  useEffect(() => () => previewedBody.dispose(), [previewedBody]);

  return (
    <>
      <AppLayout
        workspaces={
          <WorkspaceColumn
            snapshot={snapshot}
            onSelect={(workspace) => void session.selectWorkspace(workspace)}
            onCreate={(typedName) => session.createWorkspace(typedName)}
            onRename={(workspace, typedName) => session.renameWorkspace(workspace, typedName)}
            onDelete={(workspace) => void askToDeleteWorkspace(workspace)}
          />
        }
        articles={
          <ArticleColumn
            snapshot={snapshot}
            onSelect={(fileName) => void session.selectArticle(fileName)}
            onCreateArticle={() => setArticleDialogOpenedAt(new Date())}
            onEditMetadata={setArticleBeingEdited}
            onDelete={setArticleToDelete}
          />
        }
        editor={<EditorColumn snapshot={snapshot} autosave={autosave} />}
        preview={{
          isOpen: previewPanel.isOpen,
          content: <PreviewPanel previewedBody={previewedBody} />,
          onOpen: previewPanel.open,
          onClose: previewPanel.close,
        }}
      />
      {articleDialogOpenedAt !== null && (
        <CreateArticleDialog
          openedAt={articleDialogOpenedAt}
          vocabulary={vocabularyOf(snapshot.articles)}
          onCreate={(draft) => session.createArticle(draft)}
          onClose={() => setArticleDialogOpenedAt(null)}
        />
      )}
      {articleBeingEdited !== null && (
        <EditArticleMetadataDialog
          article={articleBeingEdited}
          vocabulary={vocabularyOf(snapshot.articles)}
          onSave={(draft) => session.updateMetadata(articleBeingEdited.fileName, draft)}
          onClose={() => setArticleBeingEdited(null)}
        />
      )}
      {articleToDelete !== null && (
        <ConfirmDeletionDialog
          heading={`刪除「${articleToDelete.title}」？`}
          confirmLabel="刪除文章"
          onConfirm={async () => {
            await session.deleteArticle(articleToDelete.fileName);
            setArticleToDelete(null);
          }}
          onCancel={() => setArticleToDelete(null)}
        >
          <p>這篇文章會移到系統垃圾桶，之後還可以從垃圾桶還原。</p>
          <p>
            它用到的圖片一張都不會被刪除——images/ 是整個 workspace 共用的，同一張圖可能還被別篇引用。
          </p>
        </ConfirmDeletionDialog>
      )}
      {workspaceToDelete !== null && (
        <ConfirmDeletionDialog
          heading={`刪除 workspace「${workspaceToDelete.workspace}」？`}
          confirmLabel="刪除 workspace"
          onConfirm={async () => {
            await session.deleteWorkspace(workspaceToDelete.workspace);
            setWorkspaceToDelete(null);
          }}
          onCancel={() => setWorkspaceToDelete(null)}
        >
          <p>
            將刪除 {workspaceToDelete.contents.articleCount} 篇文章與{" "}
            {workspaceToDelete.contents.imageCount} 張圖片。
          </p>
          <p>整個 {workspaceToDelete.workspace} 資料夾會移到系統垃圾桶，之後還可以從垃圾桶還原。</p>
        </ConfirmDeletionDialog>
      )}
      <OperationFailureNotice
        failure={snapshot.operationFailure}
        onDismiss={() => session.dismissOperationFailure()}
      />
    </>
  );
}

// Losing focus makes the input method commit its composition and end it.
function blurFocusedElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}
