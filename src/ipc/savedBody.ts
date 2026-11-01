export type SavedBody =
  | { outcome: "saved"; updatedAt: string; lastKnownModifiedAt: string }
  | { outcome: "modifiedElsewhere"; lastKnownModifiedAt: string };

export type SaveBodyRequest = {
  workspace: string;
  fileName: string;
  body: string;
  lastKnownModifiedAt: string;
  overwrite: boolean;
};
