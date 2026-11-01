import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { ArticleLocation } from "../../ipc/articleSummary";
import type { BodyMatch } from "../../ipc/bodySearch";
import { useCompositionState } from "../../shared/composition/CompositionContext";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import type { Messages } from "../interfaceLanguage/messages";
import { orderArticles } from "../vault/articleArrangement";
import type { VaultSnapshot } from "../vault/VaultSession";
import { BodySearch, type BodySearchState, type SearchBodies } from "./BodySearch";
import { FinderPalette } from "./FinderPalette";
import { FindingText } from "./FindingText";

type BodyFinderProps = {
  snapshot: VaultSnapshot;
  searchBodies: SearchBodies;
  onChoose: (article: ArticleLocation, line: number) => void;
  onDismiss: () => void;
};

/** One row per saved body line holding the typed text, articles in the list's order. */
export function BodyFinder({ snapshot, searchBodies, onChoose, onDismiss }: BodyFinderProps) {
  const messages = useMessages();
  const composition = useCompositionState();
  const [bodySearch] = useState(() => new BodySearch(composition, searchBodies));
  const state = useSyncExternalStore(bodySearch.subscribe, () => bodySearch.state);
  const { articles, showsAllNotes } = snapshot;
  const ordered = useMemo(() => orderArticles(articles), [articles]);
  const titles = useMemo(
    () => new Map(articles.map((article) => [`${article.workspace}/${article.fileName}`, article.title])),
    [articles],
  );
  const matches = useMemo(() => (state.kind === "found" ? state.result.matches : []), [state]);
  const rows = useMemo(
    () =>
      matches.map((match) => ({
        key: `${match.workspace}/${match.fileName}:${match.lineNumber}`,
        content: <BodyMatchRow match={match} title={titles.get(`${match.workspace}/${match.fileName}`) ?? match.fileName} showsWorkspace={showsAllNotes} />,
      })),
    [matches, titles, showsAllNotes],
  );

  useEffect(() => () => bodySearch.dispose(), [bodySearch]);

  return (
    <FinderPalette
      label={messages.findArticlesByBody}
      rows={rows}
      statusLine={bodyStatusLine(state, messages)}
      onTextChange={(text) => bodySearch.search(new FindingText(text), ordered)}
      onChoose={(index) => {
        const chosen = matches[index];
        if (chosen !== undefined) {
          onChoose({ workspace: chosen.workspace, fileName: chosen.fileName }, chosen.lineNumber);
        }
      }}
      onDismiss={onDismiss}
    />
  );
}

function bodyStatusLine(state: BodySearchState, messages: Messages): string | null {
  switch (state.kind) {
    case "waitingForText":
      return messages.typeToSearchBodies;
    case "failed":
      return messages.searchFailed;
    case "found":
      if (state.result.matches.length === 0) {
        return messages.noMatchingBodies;
      }
      return state.result.isTruncated ? messages.tooManyBodyMatches : null;
  }
}

type BodyMatchRowProps = { match: BodyMatch; title: string; showsWorkspace: boolean };

function BodyMatchRow({ match, title, showsWorkspace }: BodyMatchRowProps) {
  const messages = useMessages();
  return (
    <>
      <span className="finder-row-title">{title}</span>
      {showsWorkspace && <span className="finder-row-workspace">{match.workspace}</span>}
      <span className="finder-row-line-number">{messages.lineNumber(match.lineNumber)}</span>
      <span className="finder-row-line">{match.lineText}</span>
    </>
  );
}
