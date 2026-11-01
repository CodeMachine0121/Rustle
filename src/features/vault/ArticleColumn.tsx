import type { ArticleSummary } from "../../ipc/articleSummary";
import type { VaultSnapshot } from "./VaultSession";

const LEADING_DATE = /^\d{4}-\d{2}-\d{2}/;

type ArticleColumnProps = {
  snapshot: VaultSnapshot;
  onSelect: (fileName: string) => void;
};

export function ArticleColumn({ snapshot, onSelect }: ArticleColumnProps) {
  const { articles, selectedWorkspace, selectedArticle, articleListFailure } = snapshot;
  if (selectedWorkspace === null) {
    return <p className="empty-state">選一個 workspace</p>;
  }
  if (articleListFailure !== null) {
    return (
      <p className="column-message" role="alert">
        讀不到文章：{articleListFailure}
      </p>
    );
  }
  if (articles.length === 0) {
    return <p className="empty-state">建立第一篇文章</p>;
  }
  return (
    <ul className="column-list">
      {articles.map((article) => (
        <li key={article.fileName}>
          <ArticleRow
            article={article}
            isSelected={article.fileName === selectedArticle}
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
  onSelect: (fileName: string) => void;
};

function ArticleRow({ article, isSelected, onSelect }: ArticleRowProps) {
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
    </button>
  );
}
