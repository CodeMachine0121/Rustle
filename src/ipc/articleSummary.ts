export type ArticleSummary = {
  fileName: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  category: string[];
  tags: string[];
  hasIncompleteMetadata: boolean;
};
