import type { ArticleLocation } from "./articleSummary";

export type BodySearchRequest = { text: string; articles: ArticleLocation[] };

export type BodyMatch = ArticleLocation & { lineNumber: number; lineText: string };

/** The first hits in the order the articles were given, and whether there were more. */
export type BodySearchResult = { matches: BodyMatch[]; isTruncated: boolean };
