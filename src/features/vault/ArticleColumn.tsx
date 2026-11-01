import { useMemo, useState } from "react";

import type { ArticleSummary } from "../../ipc/articleSummary";
import {
  ARTICLE_ORDERS,
  articleOrderNamed,
  ArticleFilter,
  arrangeArticles,
  DEFAULT_ARTICLE_ORDER,
  type ArticleOrder,
} from "./articleArrangement";
import { ArticleFilterField } from "./ArticleFilterField";
import type { VaultSnapshot } from "./VaultSession";

const LEADING_DATE = /^\d{4}-\d{2}-\d{2}/;

type ArticleColumnProps = {
  snapshot: VaultSnapshot;
  onSelect: (fileName: string) => void;
  onCreateArticle: () => void;
};

/**
 * The selected workspace's articles, filtered and ordered on screen only:
 * the snapshot's list, the selection and the files stay as they are.
 */
export function ArticleColumn({ snapshot, onSelect, onCreateArticle }: ArticleColumnProps) {
  const [filterText, setFilterText] = useState("");
  const [order, setOrder] = useState<ArticleOrder>(DEFAULT_ARTICLE_ORDER);
  if (snapshot.selectedWorkspace === null) {
    return <p className="empty-state">選一個 workspace</p>;
  }
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
      <button type="button" className="new-article-button" onClick={onCreateArticle}>
        ＋ 新文章
      </button>
      <ArticleList
        snapshot={snapshot}
        filterText={filterText}
        order={order}
        onSelect={onSelect}
        onCreateArticle={onCreateArticle}
      />
    </>
  );
}

type ArticleListProps = ArticleColumnProps & { filterText: string; order: ArticleOrder };

function ArticleList({ snapshot, filterText, order, onSelect, onCreateArticle }: ArticleListProps) {
  const { articles, selectedArticle, articleListFailure } = snapshot;
  const filter = useMemo(() => new ArticleFilter(filterText), [filterText]);
  const rows = useMemo(
    () => arrangeArticles(articles, { filter, order, openArticle: selectedArticle }),
    [articles, filter, order, selectedArticle],
  );
  if (articleListFailure !== null) {
    return (
      <p className="column-message" role="alert">
        讀不到文章：{articleListFailure}
      </p>
    );
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
      {rows.map((article) => (
        <li key={article.fileName}>
          <ArticleRow
            article={article}
            isSelected={article.fileName === selectedArticle}
            isKeptOnlyBecauseOpen={!filter.isEmpty && !filter.matches(article)}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

type ArticleRowProps = {
  article: ArticleSummary;
  isSelected: boolean;
  isKeptOnlyBecauseOpen: boolean;
  onSelect: (fileName: string) => void;
};

function ArticleRow({ article, isSelected, isKeptOnlyBecauseOpen, onSelect }: ArticleRowProps) {
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
      {article.hasIncompleteMetadata && <span className="incomplete-marker">metadata 不完整</span>}
      {isKeptOnlyBecauseOpen && <span className="open-article-marker">開著・不符合篩選</span>}
    </button>
  );
}
