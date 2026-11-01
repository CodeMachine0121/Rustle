import { useEffect, useState } from "react";

import { channels } from "../ipc/channels";
import { CompositionProvider } from "../shared/composition/CompositionContext";
import { ArticleColumn } from "../features/vault/ArticleColumn";
import { EditorColumn } from "../features/vault/EditorColumn";
import { useVaultSnapshot } from "../features/vault/useVaultSnapshot";
import { VaultSession } from "../features/vault/VaultSession";
import { WorkspaceColumn } from "../features/vault/WorkspaceColumn";
import { AppLayout } from "./AppLayout";

export function App() {
  const [session] = useState(() => new VaultSession(channels));

  useEffect(() => {
    void session.start();
  }, [session]);

  return (
    <CompositionProvider>
      <VaultView session={session} />
    </CompositionProvider>
  );
}

function VaultView({ session }: { session: VaultSession }) {
  const snapshot = useVaultSnapshot(session);
  return (
    <AppLayout
      workspaces={
        <WorkspaceColumn
          snapshot={snapshot}
          onSelect={(workspace) => void session.selectWorkspace(workspace)}
          onCreate={(typedName) => session.createWorkspace(typedName)}
        />
      }
      articles={
        <ArticleColumn snapshot={snapshot} onSelect={(fileName) => void session.selectArticle(fileName)} />
      }
      editor={<EditorColumn snapshot={snapshot} />}
    />
  );
}
