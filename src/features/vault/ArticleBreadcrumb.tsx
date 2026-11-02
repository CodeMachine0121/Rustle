import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { statusChoiceOf } from "../sidebar/statusChoice";
import { StatusDot } from "../sidebar/StatusDot";
import { isSameArticle } from "./articleLocation";
import type { VaultSnapshot } from "./VaultSession";

type ArticleBreadcrumbProps = {
  snapshot: VaultSnapshot;
};

/** `workspace / title` of the open article and its status; nothing while none is open. */
export function ArticleBreadcrumb({ snapshot }: ArticleBreadcrumbProps) {
  const messages = useMessages();
  const article = snapshot.articles.find((listed) => isSameArticle(snapshot.selectedArticle, listed));
  if (article === undefined) {
    return null;
  }
  const choice = statusChoiceOf(article.status);
  return (
    <nav className="article-breadcrumb" aria-label={messages.articleBreadcrumb}>
      <span className="article-breadcrumb__workspace">{article.workspace}</span>
      <span className="article-breadcrumb__separator" aria-hidden="true">
        /
      </span>
      <span className="article-breadcrumb__title">{article.title}</span>
      {choice !== "noStatus" && (
        <span className="status-pill">
          <StatusDot choice={choice} />
          {messages.statusLabels[choice]}
        </span>
      )}
    </nav>
  );
}
