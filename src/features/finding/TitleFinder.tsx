import { useMemo, useState } from "react";

import type { ArticleLocation } from "../../ipc/articleSummary";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { orderArticles } from "../vault/articleArrangement";
import type { VaultSnapshot } from "../vault/VaultSession";
import { FinderPalette } from "./FinderPalette";
import { FindingText } from "./FindingText";

type TitleFinderProps = {
  snapshot: VaultSnapshot;
  onChoose: (article: ArticleLocation) => void;
  onDismiss: () => void;
};

/** The scope's articles in the list's order, narrowed by their titles only. */
export function TitleFinder({ snapshot, onChoose, onDismiss }: TitleFinderProps) {
  const messages = useMessages();
  const [text, setText] = useState("");
  const { articles, showsAllNotes } = snapshot;
  const ordered = useMemo(() => orderArticles(articles), [articles]);
  const matched = useMemo(() => {
    const findingText = new FindingText(text);
    return ordered.filter(({ title }) => findingText.matches(title));
  }, [ordered, text]);
  const rows = useMemo(
    () =>
      matched.map((article) => ({
        key: `${article.workspace}/${article.fileName}`,
        content: (
          <>
            <span className="finder-row-title">{article.title}</span>
            {showsAllNotes && <span className="finder-row-workspace">{article.workspace}</span>}
          </>
        ),
      })),
    [matched, showsAllNotes],
  );

  return (
    <FinderPalette
      label={messages.findArticlesByTitle}
      rows={rows}
      statusLine={titleStatusLine()}
      onTextChange={setText}
      onChoose={(index) => {
        const chosen = matched[index];
        if (chosen !== undefined) {
          onChoose(chosen);
        }
      }}
      onDismiss={onDismiss}
    />
  );

  function titleStatusLine(): string | null {
    if (articles.length === 0) {
      return showsAllNotes ? messages.noArticlesInVault : messages.noArticlesInWorkspace;
    }
    return matched.length === 0 ? messages.noMatchingArticles : null;
  }
}
