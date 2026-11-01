import { FilePenLine, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { statusChoiceOf } from "../sidebar/statusChoice";
import { arrangeArticles } from "./articleArrangement";
import { ArticleFilterField } from "./ArticleFilterField";
import { isSameArticle } from "./articleLocation";
import type { VaultSnapshot } from "./VaultSession";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";

const LEADING_DATE = /^\d{4}-\d{2}-\d{2}/;

type ArticleColumnProps = {
  snapshot: VaultSnapshot;
  onSelect: (article: ArticleSummary) => void;
  onCreateArticle: () => void;
  onEditMetadata: (article: ArticleSummary) => void;
  onDelete: (article: ArticleSummary) => void;
};

/**
 * The scope's articles, newest first and filtered on screen only: the
 * snapshot's list, the selection and the files stay as they are. The filter
 * and the new article icon stay above the list even when it is empty. Under
 * All Notes a new article is refused, as it would have no workspace to go in.
 */
export function ArticleColumn(props: ArticleColumnProps) {
  const { snapshot, onCreateArticle } = props;
  const [filterText, setFilterText] = useState("");
  const [creationRefusedIn, setCreationRefusedIn] = useState<VaultSnapshot["articles"] | null>(null);
  const messages = useMessages();
  if (snapshot.selectedWorkspace === null && !snapshot.showsAllNotes) {
    return <p className="empty-state">{messages.chooseWorkspaceFirst}</p>;
  }
  const isCreationRefused = snapshot.showsAllNotes && creationRefusedIn === snapshot.articles;
  const createArticle = () => {
    if (snapshot.showsAllNotes) {
      setCreationRefusedIn(snapshot.articles);
      return;
    }
    onCreateArticle();
  };
  return (
    <>
      <div className="article-list-controls">
        <ArticleFilterField onApply={setFilterText} />
        <button
          type="button"
          className="icon-button"
          aria-label={messages.newArticle}
          title={messages.newArticle}
          onClick={createArticle}
        >
          <FilePenLine className="icon" aria-hidden="true" />
        </button>
      </div>
      {isCreationRefused && (
        <p className="column-message" role="alert">
          {messages.noWorkspaceSelected}
        </p>
      )}
      <ArticleList {...props} filterText={filterText} />
    </>
  );
}

type ArticleListProps = ArticleColumnProps & { filterText: string };

function ArticleList({
  snapshot,
  filterText,
  onSelect,
  onEditMetadata,
  onDelete,
}: ArticleListProps) {
  const { articles, selectedArticle, articleListFailure, sidebarFilter, showsAllNotes } = snapshot;
  const messages = useMessages();
  const rows = useMemo(
    () => arrangeArticles(articles, { filterText, sidebarFilter, openArticle: selectedArticle }),
    [articles, filterText, sidebarFilter, selectedArticle],
  );
  if (articleListFailure !== null) {
    return (
      <p className="column-message" role="alert">
        {messages.workspaceUnreadable(articleListFailure)}
      </p>
    );
  }
  if (articles.length === 0 && showsAllNotes) {
    return <p className="empty-state">{messages.noArticlesInVault}</p>;
  }
  if (articles.length === 0) {
    return <p className="empty-state">{messages.createFirstArticle}</p>;
  }
  if (rows.length === 0) {
    return <p className="empty-state">{messages.noMatchingArticles}</p>;
  }
  return (
    <ul className="column-list">
      {rows.map(({ article, isOutsideFilter }) => (
        <li key={`${article.workspace}/${article.fileName}`} className="column-item article-card">
          <ArticleRow
            article={article}
            isSelected={isSameArticle(selectedArticle, article)}
            isOutsideFilter={isOutsideFilter}
            showsWorkspace={showsAllNotes}
            onSelect={onSelect}
          />
          <button
            type="button"
            className="icon-button card-action card-action--top"
            aria-label={messages.editMetadataFor(article.title)}
            title={messages.editMetadata}
            onClick={() => onEditMetadata(article)}
          >
            <Pencil className="icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button card-action card-action--bottom"
            aria-label={messages.deleteArticle(article.title)}
            title={messages.delete}
            onClick={() => onDelete(article)}
          >
            <Trash2 className="icon" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

type ArticleRowProps = {
  article: ArticleSummary;
  isSelected: boolean;
  isOutsideFilter: boolean;
  showsWorkspace: boolean;
  onSelect: (article: ArticleSummary) => void;
};

function ArticleRow({ article, isSelected, isOutsideFilter, showsWorkspace, onSelect }: ArticleRowProps) {
  const messages = useMessages();
  const createdDate = LEADING_DATE.exec(article.createdAt)?.[0] ?? article.createdAt;
  return (
    <button
      type="button"
      className="column-row article-row"
      aria-pressed={isSelected}
      onClick={() => onSelect(article)}
    >
      <span className="row-title">{article.title}</span>
      {showsWorkspace && <span className="row-workspace">{article.workspace}</span>}
      <span className="row-meta">
        <span className="row-status">{messages.statusLabels[statusChoiceOf(article.status)]}</span>
        {createdDate !== "" && <span className="row-date">{createdDate}</span>}
        {article.tags.map((tag) => (
          <span key={tag} className="row-tag">
            {tag}
          </span>
        ))}
        {article.hasIncompleteMetadata && <span className="incomplete-marker">{messages.incompleteMetadata}</span>}
        {isOutsideFilter && <span className="open-article-marker">{messages.openOutsideFilter}</span>}
      </span>
    </button>
  );
}
