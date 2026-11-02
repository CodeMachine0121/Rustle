import { useRef, useState } from "react";

import type { ArticleLocation } from "../../ipc/articleSummary";
import type { Scope, VaultSnapshot } from "../vault/VaultSession";
import type { SearchBodies } from "./BodySearch";
import { BodyFinder } from "./BodyFinder";
import type { FinderRequests } from "./FinderRequests";
import type { FinderKind } from "./FindingKeys";
import { TitleFinder } from "./TitleFinder";
import { useFindingKeys } from "./useFindingKeys";
import { WorkspaceFinder } from "./WorkspaceFinder";

type FindersProps = {
  snapshot: VaultSnapshot;
  searchBodies: SearchBodies;
  onOpenFoundArticle: (article: ArticleLocation, cursorLine?: number) => void;
  onGoTo: (scope: Scope) => void;
  /** Opens a finder from something on screen, as its key would. */
  requests?: FinderRequests;
};

type OpenFinder = { kind: FinderKind; opening: number };

/**
 * At most one finder at a time, opened by its key: the same key closes it,
 * another key swaps it for a fresh one. Finding articles needs a scope, so
 * without one the title and body finders stay closed. Dismissing gives the
 * keyboard back to where it was.
 */
export function Finders({ snapshot, searchBodies, onOpenFoundArticle, onGoTo, requests }: FindersProps) {
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

  const answer = (kind: FinderKind) => {
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
  };
  useFindingKeys(answer, requests);

  if (open === null) {
    return null;
  }
  switch (open.kind) {
    case "title":
      return (
        <TitleFinder
          key={open.opening}
          snapshot={snapshot}
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
