import type { ArticleSummary } from "../../ipc/articleSummary";
import type { VaultSnapshot } from "./VaultSession";

const LEADING_DATE = /^\d{4}-\d{2}-\d{2}/;

type ArticleColumnProps = {
  snapshot: VaultSnapshot;
  onSelect: (fileName: string) => void;
  onCreateArticle: () => void;
  onEditMetadata: (article: ArticleSummary) => void;
  onDelete: (article: ArticleSummary) => void;
};

export function ArticleColumn(props: ArticleColumnProps) {
  const { snapshot, onCreateArticle } = props;
  if (snapshot.selectedWorkspace === null) {
    return <p className="empty-state">選一個 workspace</p>;
  }
  return (
    <>
      <button type="button" className="new-article-button" onClick={onCreateArticle}>
        ＋ 新文章
      </button>
      <ArticleList {...props} />
    </>
  );
}

function ArticleList({ snapshot, onSelect, onCreateArticle, onEditMetadata, onDelete }: ArticleColumnProps) {
  const { articles, selectedArticle, articleListFailure } = snapshot;
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
  return (
    <ul className="column-list">
      {articles.map((article) => (
        <li key={article.fileName} className="column-item">
          <ArticleRow
            article={article}
            isSelected={article.fileName === selectedArticle}
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
