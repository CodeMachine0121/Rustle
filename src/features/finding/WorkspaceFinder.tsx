import { useMemo, useState } from "react";

import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { VaultSnapshot } from "../vault/VaultSession";
import { FinderPalette } from "./FinderPalette";
import { FindingText } from "./FindingText";

export type WorkspaceDestination = { kind: "allNotes" } | { kind: "workspace"; workspace: string };

type WorkspaceFinderProps = {
  snapshot: VaultSnapshot;
  onChoose: (destination: WorkspaceDestination) => void;
  onDismiss: () => void;
};

type Destination = { destination: WorkspaceDestination; name: string; articleCount: number | null };

/** All Notes first, then every workspace in the sidebar's order, narrowed by name. */
export function WorkspaceFinder({ snapshot, onChoose, onDismiss }: WorkspaceFinderProps) {
  const messages = useMessages();
  const [text, setText] = useState("");
  const { workspaces } = snapshot;
  const destinations = useMemo<Destination[]>(
    () => [
      {
        destination: { kind: "allNotes" },
        name: messages.allNotes,
        articleCount: workspaces.reduce((total, { articleCount }) => total + (articleCount ?? 0), 0),
      },
      ...workspaces.map(({ name, articleCount }) => ({
        destination: { kind: "workspace" as const, workspace: name },
        name,
        articleCount,
      })),
    ],
    [workspaces, messages.allNotes],
  );
  const matched = useMemo(() => {
    const findingText = new FindingText(text);
    return destinations.filter(({ name }) => findingText.matches(name));
  }, [destinations, text]);
  const rows = useMemo(
    () =>
      matched.map(({ destination, name, articleCount }) => ({
        key: destination.kind === "allNotes" ? "allNotes" : `workspace:${destination.workspace}`,
        content: (
          <>
            <span className="finder-row-title">{name}</span>
            <span className="finder-row-count">
              {articleCount === null ? messages.unknownArticleCount : messages.articleCount(articleCount)}
            </span>
          </>
        ),
      })),
    [matched, messages],
  );

  return (
    <FinderPalette
      label={messages.switchWorkspace}
      rows={rows}
      statusLine={workspaceStatusLine()}
      onTextChange={setText}
      onChoose={(index) => {
        const chosen = matched[index];
        if (chosen !== undefined) {
          onChoose(chosen.destination);
        }
      }}
      onDismiss={onDismiss}
    />
  );

  function workspaceStatusLine(): string | null {
    if (matched.length === 0) {
      return messages.noMatchingWorkspaces;
    }
    return workspaces.length === 0 ? messages.noWorkspacesYet : null;
  }
}
