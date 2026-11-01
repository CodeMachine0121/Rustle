import { useMemo, useState } from "react";

import type { ArticleSummary } from "../../ipc/articleSummary";
import {
  ARTICLE_ORDERS,
  articleOrderNamed,
  arrangeArticles,
  DEFAULT_ARTICLE_ORDER,
  type ArticleOrder,
} from "./articleArrangement";
import { ArticleFilterField } from "./ArticleFilterField";
import type { VaultSnapshot } from "./VaultSession";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";

const LEADING_DATE = /^\d{4}-\d{2}-\d{2}/;

type ArticleColumnProps = {
  snapshot: VaultSnapshot;
  onSelect: (fileName: string) => void;
  onCreateArticle: () => void;
  onEditMetadata: (article: ArticleSummary) => void;
  onDelete: (article: ArticleSummary) => void;
};

/**
 * The selected workspace's articles, filtered and ordered on screen only:
 * the snapshot's list, the selection and the files stay as they are.
 */
export function ArticleColumn(props: ArticleColumnProps) {
  const { snapshot, onCreateArticle } = props;
  const [filterText, setFilterText] = useState("");
  const [order, setOrder] = useState<ArticleOrder>(DEFAULT_ARTICLE_ORDER);
  const messages = useMessages();
  if (snapshot.selectedWorkspace === null) {
    return <p className="empty-state">{messages.chooseWorkspaceFirst}</p>;
  }
  return (
    <>
      <div className="article-list-controls">
        <ArticleFilterField onApply={setFilterText} />
        <select
          aria-label={messages.sortOrder}
          value={order}
          onChange={(event) => setOrder(articleOrderNamed(event.target.value))}
        >
          {ARTICLE_ORDERS.map((value) => (
            <option key={value} value={value}>
              {messages.articleOrders[value]}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="new-article-button" onClick={onCreateArticle}>
        {messages.newArticle}
      </button>
      <ArticleList {...props} filterText={filterText} order={order} />
    </>
  );
}

type ArticleListProps = ArticleColumnProps & { filterText: string; order: ArticleOrder };

function ArticleList({
  snapshot,
  filterText,
  order,
  onSelect,
  onCreateArticle,
  onEditMetadata,
  onDelete,
}: ArticleListProps) {
  const { articles, selectedArticle, articleListFailure } = snapshot;
  const messages = useMessages();
  const rows = useMemo(
    () => arrangeArticles(articles, { filterText, order, openArticle: selectedArticle }),
    [articles, filterText, order, selectedArticle],
  );
  if (articleListFailure !== null) {
    return (
      <p className="column-message" role="alert">
        {messages.workspaceUnreadable(articleListFailure)}
      </p>
    );
  }
  if (articles.length === 0) {
    return (
      <button type="button" className="empty-state empty-state-action" onClick={onCreateArticle}>
        {messages.createFirstArticle}
      </button>
    );
  }
  if (rows.length === 0) {
    return <p className="empty-state">{messages.noMatchingArticles}</p>;
  }
  return (
    <ul className="column-list">
      {rows.map(({ article, isOutsideFilter }) => (
        <li key={article.fileName} className="column-item">
          <ArticleRow
            article={article}
            isSelected={article.fileName === selectedArticle}
            isOutsideFilter={isOutsideFilter}
            onSelect={onSelect}
          />
          <div className="row-actions">
            <button
              type="button"
              aria-label={messages.editMetadataFor(article.title)}
              onClick={() => onEditMetadata(article)}
            >
              {messages.editMetadata}
            </button>
            <button type="button" aria-label={messages.deleteArticle(article.title)} onClick={() => onDelete(article)}>
              {messages.delete}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

type ArticleRowProps = {
  article: ArticleSummary;
  isSelected: boolean;
  isOutsideFilter: boolean;
  onSelect: (fileName: string) => void;
};

function ArticleRow({ article, isSelected, isOutsideFilter, onSelect }: ArticleRowProps) {
  const messages = useMessages();
  const createdDate = LEADING_DATE.exec(article.createdAt)?.[0] ?? article.createdAt;
  const details = [createdDate, ...article.category].filter((detail) => detail !== "");
  return (
    <button
      type="button"
      className="column-row article-row"
      aria-pressed={isSelected}
      onClick={() => onSelect(article.fileName)}
    >
      <span className="row-title">{article.title}</span>
      {details.length > 0 && <span className="row-details">{details.join(" · ")}</span>}
      {article.tags.length > 0 && (
        <span className="row-tags">
          {article.tags.map((tag) => (
            <span key={tag} className="row-tag">
              {tag}
            </span>
          ))}
        </span>
      )}
      {article.hasIncompleteMetadata && <span className="incomplete-marker">{messages.incompleteMetadata}</span>}
      {isOutsideFilter && <span className="open-article-marker">{messages.openOutsideFilter}</span>}
    </button>
  );
}
