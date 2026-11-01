import { useEffect, useState } from "react";

import { AutosaveSession } from "../features/autosave/AutosaveSession";
import { watchWindowCloseRequests } from "../features/autosave/watchWindowCloseRequests";
import { vocabularyOf } from "../features/articleMetadata/articleVocabulary";
import { CreateArticleDialog } from "../features/createArticle/CreateArticleDialog";
import { PreviewedBody } from "../features/preview/PreviewedBody";
import { PreviewPanel } from "../features/preview/PreviewPanel";
import { usePreviewPanel } from "../features/preview/usePreviewPanel";
import { SettingsSession } from "../features/settings/SettingsSession";
import { ArticleColumn } from "../features/vault/ArticleColumn";
import { EditorColumn } from "../features/vault/EditorColumn";
import { useVaultSnapshot } from "../features/vault/useVaultSnapshot";
import { VaultSession } from "../features/vault/VaultSession";
import { WorkspaceColumn } from "../features/vault/WorkspaceColumn";
import { channels } from "../ipc/channels";
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
          />
        }
        articles={
          <ArticleColumn
            snapshot={snapshot}
            onSelect={(fileName) => void session.selectArticle(fileName)}
            onCreateArticle={() => setArticleDialogOpenedAt(new Date())}
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
    </>
  );
}

// Losing focus makes the input method commit its composition and end it.
function blurFocusedElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}
