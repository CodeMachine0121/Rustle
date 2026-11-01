export type WorkspaceSummary = {
  name: string;
  /** `null` when the workspace folder cannot be read. */
  articleCount: number | null;
};
