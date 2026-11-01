import { useRef, useState } from "react";

import type { ArticleLocation } from "../../ipc/articleSummary";
import type { ArticleOrder } from "../vault/articleArrangement";
import type { VaultSnapshot } from "../vault/VaultSession";
import type { SearchBodies } from "./BodySearch";
import { BodyFinder } from "./BodyFinder";
import type { FinderKind } from "./FindingKeys";
import { TitleFinder } from "./TitleFinder";
import { useFindingKeys } from "./useFindingKeys";
import { WorkspaceFinder, type WorkspaceDestination } from "./WorkspaceFinder";

type FindersProps = {
  snapshot: VaultSnapshot;
  order: ArticleOrder;
  searchBodies: SearchBodies;
  onOpenFoundArticle: (article: ArticleLocation, cursorLine?: number) => void;
  onGoTo: (destination: WorkspaceDestination) => void;
};

type OpenFinder = { kind: FinderKind; opening: number };

/**
 * At most one finder at a time, opened by its key: the same key closes it,
 * another key swaps it for a fresh one. Finding articles needs a scope, so
 * without one the title and body finders stay closed. Dismissing gives the
 * keyboard back to where it was.
 */
export function Finders({ snapshot, order, searchBodies, onOpenFoundArticle, onGoTo }: FindersProps) {
  const [open, setOpen] = useState<OpenFinder | null>(null);
  const focusBeforeOpening = useRef<HTMLElement | null>(null);
  const hasScope = snapshot.selectedWorkspace !== null || snapshot.showsAllNotes;

  const dismiss = () => {
    setOpen(null);
    focusBeforeOpening.current?.focus();
    focusBeforeOpening.current = null;
  };

  const close = () => {
    setOpen(null);
    focusBeforeOpening.current = null;
  };

  useFindingKeys((kind) => {
    if (open?.kind === kind) {
      dismiss();
      return;
    }
    if (kind !== "workspace" && !hasScope) {
      return;
    }
    if (open === null) {
      focusBeforeOpening.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setOpen({ kind, opening: (open?.opening ?? 0) + 1 });
  });

  if (open === null) {
    return null;
  }
  switch (open.kind) {
    case "title":
      return (
        <TitleFinder
          key={open.opening}
          snapshot={snapshot}
          order={order}
          onChoose={(article) => {
            close();
            onOpenFoundArticle(article);
          }}
          onDismiss={dismiss}
        />
      );
    case "body":
      return (
        <BodyFinder
          key={open.opening}
          snapshot={snapshot}
          order={order}
          searchBodies={searchBodies}
          onChoose={(article, line) => {
            close();
            onOpenFoundArticle(article, line);
          }}
          onDismiss={dismiss}
        />
      );
    case "workspace":
      return (
        <WorkspaceFinder
          key={open.opening}
          snapshot={snapshot}
          onChoose={(destination) => {
            close();
            onGoTo(destination);
          }}
          onDismiss={dismiss}
        />
      );
  }
}
