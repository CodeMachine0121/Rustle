export type ArticleSummary = {
  fileName: string;
  title: string;
  createdAt: string;
  category: string[];
  tags: string[];
  hasIncompleteMetadata: boolean;
};
