import { useMemo, useState } from "react";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { statusLabelOf } from "../sidebar/statusChoice";
import {
  ARTICLE_ORDERS,
  articleOrderNamed,
  arrangeArticles,
  DEFAULT_ARTICLE_ORDER,
  type ArticleOrder,
} from "./articleArrangement";
import { ArticleFilterField } from "./ArticleFilterField";
import { CHOOSE_A_WORKSPACE_FIRST, type VaultSnapshot } from "./VaultSession";

const LEADING_DATE = /^\d{4}-\d{2}-\d{2}/;

type ArticleColumnProps = {
  snapshot: VaultSnapshot;
  onSelect: (article: ArticleSummary) => void;
  onCreateArticle: () => void;
  onEditMetadata: (article: ArticleSummary) => void;
  onDelete: (article: ArticleSummary) => void;
};

/**
 * The scope's articles, filtered and ordered on screen only: the
 * snapshot's list, the selection and the files stay as they are. Under All
 * Notes a new article is refused, as it would have no workspace to go in.
 */
export function ArticleColumn(props: ArticleColumnProps) {
  const { snapshot, onCreateArticle } = props;
  const [filterText, setFilterText] = useState("");
  const [order, setOrder] = useState<ArticleOrder>(DEFAULT_ARTICLE_ORDER);
  const [creationRefusedIn, setCreationRefusedIn] = useState<VaultSnapshot["articles"] | null>(null);
  if (snapshot.selectedWorkspace === null && !snapshot.showsAllNotes) {
    return <p className="empty-state">選一個 workspace</p>;
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
        <select
          aria-label="排序"
          value={order}
          onChange={(event) => setOrder(articleOrderNamed(event.target.value))}
        >
          {ARTICLE_ORDERS.map(({ order: value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="new-article-button" onClick={createArticle}>
        ＋ 新文章
      </button>
      {isCreationRefused && (
        <p className="column-message" role="alert">
          {CHOOSE_A_WORKSPACE_FIRST}
        </p>
      )}
      <ArticleList {...props} onCreateArticle={createArticle} filterText={filterText} order={order} />
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
  const { articles, selectedArticle, articleListFailure, sidebarFilter, showsAllNotes } = snapshot;
  const rows = useMemo(
    () => arrangeArticles(articles, { filterText, sidebarFilter, order, openArticle: selectedArticle }),
    [articles, filterText, sidebarFilter, order, selectedArticle],
  );
  if (articleListFailure !== null) {
    return (
      <p className="column-message" role="alert">
        讀不到文章：{articleListFailure}
      </p>
    );
  }
  if (articles.length === 0 && showsAllNotes) {
    return <p className="empty-state">還沒有任何文章</p>;
  }
  if (articles.length === 0) {
    return (
      <button type="button" className="empty-state empty-state-action" onClick={onCreateArticle}>
        建立第一篇文章
      </button>
    );
  }
  if (rows.length === 0) {
    return <p className="empty-state">沒有符合的文章</p>;
  }
  return (
    <ul className="column-list">
      {rows.map(({ article, isOutsideFilter }) => (
        <li key={`${article.workspace}/${article.fileName}`} className="column-item">
          <ArticleRow
            article={article}
            isSelected={
              article.workspace === selectedArticle?.workspace &&
              article.fileName === selectedArticle.fileName
            }
            isOutsideFilter={isOutsideFilter}
            showsWorkspace={showsAllNotes}
            onSelect={onSelect}
          />
          <div className="row-actions">
            <button
              type="button"
              aria-label={`編輯 ${article.title} 的 metadata`}
              onClick={() => onEditMetadata(article)}
            >
              編輯 metadata
            </button>
            <button type="button" aria-label={`刪除 ${article.title}`} onClick={() => onDelete(article)}>
              刪除
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
  showsWorkspace: boolean;
  onSelect: (article: ArticleSummary) => void;
};

function ArticleRow({ article, isSelected, isOutsideFilter, showsWorkspace, onSelect }: ArticleRowProps) {
  const createdDate = LEADING_DATE.exec(article.createdAt)?.[0] ?? article.createdAt;
  const details = [createdDate, statusLabelOf(article) ?? ""].filter((detail) => detail !== "");
  return (
    <button
      type="button"
      className="column-row article-row"
      aria-pressed={isSelected}
      onClick={() => onSelect(article)}
    >
      <span className="row-title">{article.title}</span>
      {showsWorkspace && <span className="row-workspace">{article.workspace}</span>}
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
      {article.hasIncompleteMetadata && <span className="incomplete-marker">metadata 不完整</span>}
      {isOutsideFilter && <span className="open-article-marker">開著的・不符合篩選</span>}
    </button>
  );
}
