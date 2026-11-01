import { useEffect, useState } from "react";

import { AutosaveSession } from "../features/autosave/AutosaveSession";
import { watchWindowCloseRequests } from "../features/autosave/watchWindowCloseRequests";
import { vocabularyOf } from "../features/articleMetadata/articleVocabulary";
import { CreateArticleDialog } from "../features/createArticle/CreateArticleDialog";
import { ArticleDeletionDialog } from "../features/deletion/ArticleDeletionDialog";
import { WorkspaceDeletionDialog } from "../features/deletion/WorkspaceDeletionDialog";
import { Finders } from "../features/finding/Finders";
import { EditArticleMetadataDialog } from "../features/editArticleMetadata/EditArticleMetadataDialog";
import { ImagePaste } from "../features/imagePaste/ImagePaste";
import { InterfaceLanguageProvider } from "../features/interfaceLanguage/InterfaceLanguageContext";
import { SettingsEntry } from "../features/interfaceLanguage/SettingsEntry";
import { useInterfaceLanguage } from "../features/interfaceLanguage/useInterfaceLanguage";
import { PreviewedBody } from "../features/preview/PreviewedBody";
import { PreviewPanel } from "../features/preview/PreviewPanel";
import { ScrollSynchronizer } from "../features/preview/ScrollSynchronizer";
import { usePreviewPanel } from "../features/preview/usePreviewPanel";
import { SettingsSession } from "../features/settings/SettingsSession";
import { Sidebar } from "../features/sidebar/Sidebar";
import { DEFAULT_ARTICLE_ORDER, type ArticleOrder } from "../features/vault/articleArrangement";
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
  const [scrollSynchronizer] = useState(() => new ScrollSynchronizer());
  const [imagePaste] = useState(() => new ImagePaste(composition, channels, autosave));
  const snapshot = useVaultSnapshot(session);
  const previewPanel = usePreviewPanel(settings);
  const interfaceLanguage = useInterfaceLanguage(settings, channels);
  const [articleOrder, setArticleOrder] = useState<ArticleOrder>(DEFAULT_ARTICLE_ORDER);
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

  useEffect(() => () => imagePaste.dispose(), [imagePaste]);

  return (
    <InterfaceLanguageProvider language={interfaceLanguage.language}>
      <AppLayout
        sidebar={
          <Sidebar
            snapshot={snapshot}
            settings={settings}
            onSelectAllNotes={() => void session.selectAllNotes()}
            onToggleStatus={(choice) => session.toggleStatusFilter(choice)}
            onToggleTag={(tag) => session.toggleTagFilter(tag)}
            workspaces={
              <WorkspaceColumn
                snapshot={snapshot}
                onSelect={(workspace) => void session.selectWorkspace(workspace)}
                onCreate={(typedName) => session.createWorkspace(typedName)}
                onRename={(workspace, typedName) => session.renameWorkspace(workspace, typedName)}
                onDelete={(workspace) => void askToDeleteWorkspace(workspace)}
              />
            }
          />
        }
        articles={
          <ArticleColumn
            snapshot={snapshot}
            order={articleOrder}
            onOrderChange={setArticleOrder}
            onSelect={(article) => void session.selectArticle(article)}
            onCreateArticle={() => setArticleDialogOpenedAt(new Date())}
            onEditMetadata={setArticleBeingEdited}
            onDelete={setArticleToDelete}
          />
        }
        editor={
          <EditorColumn
            snapshot={snapshot}
            autosave={autosave}
            scrollSynchronizer={scrollSynchronizer}
            imagePaste={imagePaste}
          />
        }
        sidebarFooter={
          <SettingsEntry language={interfaceLanguage.language} onChoose={interfaceLanguage.choose} />
        }
        preview={{
          isOpen: previewPanel.isOpen,
          content: (
            <PreviewPanel previewedBody={previewedBody} scrollSynchronizer={scrollSynchronizer} />
          ),
          onOpen: previewPanel.open,
          onClose: previewPanel.close,
          width: previewPanel.width,
          onResize: previewPanel.resize,
          onResizeEnd: previewPanel.commitWidth,
        }}
      />
      {articleDialogOpenedAt !== null && snapshot.selectedWorkspace !== null && (
        <CreateArticleDialog
          workspace={snapshot.selectedWorkspace}
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
          onSave={(draft) => session.updateMetadata(articleBeingEdited, draft)}
          onClose={() => setArticleBeingEdited(null)}
        />
      )}
      {articleToDelete !== null && (
        <ArticleDeletionDialog
          title={articleToDelete.title}
          onConfirm={async () => {
            await session.deleteArticle(articleToDelete);
            setArticleToDelete(null);
          }}
          onCancel={() => setArticleToDelete(null)}
        />
      )}
      {workspaceToDelete !== null && (
        <WorkspaceDeletionDialog
          workspace={workspaceToDelete.workspace}
          contents={workspaceToDelete.contents}
          onConfirm={async () => {
            await session.deleteWorkspace(workspaceToDelete.workspace);
            setWorkspaceToDelete(null);
          }}
          onCancel={() => setWorkspaceToDelete(null)}
        />
      )}
      <Finders
        snapshot={snapshot}
        order={articleOrder}
        searchBodies={channels.searchBodies}
        onOpenFoundArticle={(article, cursorLine) => void session.openFoundArticle(article, cursorLine)}
        onGoTo={(destination) =>
          void (destination.kind === "allNotes"
            ? session.goToAllNotes(articleOrder)
            : session.goToWorkspace(destination.workspace, articleOrder))
        }
      />
      <OperationFailureNotice
        failure={snapshot.operationFailure}
        onDismiss={() => session.dismissOperationFailure()}
      />
    </InterfaceLanguageProvider>
  );
}

// Losing focus makes the input method commit its composition and end it.
function blurFocusedElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}
