import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import type { AutosaveSwitchOutcome, SaveIndicator } from "../autosave/AutosaveSession";
import type { StatusChoice } from "../sidebar/statusChoice";
import type { Operation } from "../vault/operationFailure";
import type { InterfaceLanguage } from "./interfaceLanguage";

type LeavingRefusal = Exclude<AutosaveSwitchOutcome, "switched">;

/** Every sentence Rustle itself says. Values in a sentence are arguments and are never rewritten. */
export const CHINESE_MESSAGES = {
  sidebar: "側邊欄",
  allNotes: "所有文章",
  workspacesTitle: "WORKSPACES",
  statusTitle: "狀態",
  tagsTitle: "標籤",
  noTagsYet: "還沒有標籤",
  statusLabels: {
    active: "進行中",
    onHold: "暫停",
    completed: "已完成",
    dropped: "已放棄",
    noStatus: "未標記",
  } satisfies Record<StatusChoice, string> as Record<StatusChoice, string>,
  articlesTitle: "文章",
  articlesRegion: "文章",
  editorTitle: "編輯",
  editorRegion: "編輯區",
  previewTitle: "預覽",
  previewRegion: "預覽區",
  openPreview: "開啟預覽",
  openPreviewHandle: "◀ 預覽",
  closePreview: "關閉預覽",
  previewContent: "預覽內容",
  adjustPreviewWidth: "調整預覽寬度",

  settings: "設定",
  language: "語言",

  vaultUnreadable: (reason: string) => `讀不到 vault：${reason}`,
  firstWorkspace: "建立你的第一個 workspace",
  unknownArticleCount: "讀不到篇數",
  articleCount: (count: number) => `${count} 篇文章`,
  rename: "重新命名",
  renameWorkspace: (workspace: string) => `重新命名 ${workspace}`,
  delete: "刪除",
  deleteWorkspace: (workspace: string) => `刪除 ${workspace}`,
  newWorkspaceName: "新 workspace 名稱",
  newWorkspacePlaceholder: "＋ 新 workspace",
  newNameFor: (workspace: string) => `${workspace} 的新名稱`,
  workspaceNameRejections: {
    empty: "請先輸入 workspace 名稱。",
    containsPathSeparator: "名稱不能包含 / 或 \\，一個 workspace 就是一層資料夾。",
    reserved: "這是保留名稱（images，或以 . 開頭的名稱），請換一個。",
    alreadyUsed: "這個名稱已經有人用了，請換一個。",
  } satisfies Record<WorkspaceNameRejection, string> as Record<WorkspaceNameRejection, string>,

  deleteWorkspaceHeading: (workspace: string) => `刪除 workspace「${workspace}」？`,
  deleteWorkspaceContents: (articleCount: number, imageCount: number) =>
    `將刪除 ${articleCount} 篇文章與 ${imageCount} 張圖片。`,
  deleteWorkspaceDestination: (workspace: string) =>
    `整個 ${workspace} 資料夾會移到系統垃圾桶，之後還可以從垃圾桶還原。`,
  deleteWorkspaceConfirm: "刪除 workspace",

  filterArticles: "篩選文章",
  filterPlaceholder: "filter",
  newArticle: "新文章",
  chooseWorkspaceFirst: "先選一個 workspace",
  workspaceUnreadable: (reason: string) => `讀不到這個 workspace：${reason}`,
  createFirstArticle: "建立第一篇文章",
  noMatchingArticles: "沒有符合的文章",
  noArticlesInVault: "vault 裡還沒有文章",
  incompleteMetadata: "metadata 不完整",
  openOutsideFilter: "開著・不符合篩選",
  editMetadata: "編輯 metadata",
  editMetadataFor: (title: string) => `編輯 ${title} 的 metadata`,
  deleteArticle: (title: string) => `刪除 ${title}`,

  deleteArticleHeading: (title: string) => `刪除「${title}」？`,
  deleteArticleDestination: "這篇文章會移到系統垃圾桶，之後還可以從垃圾桶還原。",
  deleteArticleKeepsImages:
    "它用到的圖片一張都不會被刪除——images/ 是整個 workspace 共用的，同一張圖可能還被別篇引用。",
  deleteArticleConfirm: "刪除文章",

  noArticleOpen: "還沒有選取文章",
  articleUnreadable: (reason: string) => `讀不到這篇文章：${reason}`,

  saveStatusLine: "儲存狀態列",
  articlePath: (workspace: string, fileName: string) => `${workspace} 裡的 ${fileName}`,
  saveIndicators: {
    saving: "還沒存進檔案",
    saved: "已存進檔案",
    failed: "存不進檔案",
  } satisfies Record<SaveIndicator, string> as Record<SaveIndicator, string>,
  saveFailed: (reason: string) => `儲存失敗：${reason}`,
  changedOutsideRustle: "這個檔案在 Rustle 之外被改動過",
  overwrite: "覆寫",
  reload: "重新載入",
  savingImage: "圖片儲存中…",
  imageNotSaved: (reason: string) => (reason === "" ? "圖片存不進去。" : `圖片存不進去：${reason}`),

  newArticleHeading: (workspace: string) => `新文章 · ${workspace}`,
  editMetadataHeading: (fileName: string) => `編輯 metadata · ${fileName}`,
  titleField: "標題",
  statusField: "狀態",
  tagsField: "標籤",
  candidatesFor: (field: string) => `${field} 候選`,
  removeChip: (value: string) => `移除 ${value}`,
  createdAt: (minute: string) => `建立於 ${minute}`,
  updatedAt: (minute: string) => `更新於 ${minute}`,
  notRecordedInFile: "（檔案沒有記錄）",
  timesKeptOnCreate: "建立時間與更新時間都由 Rustle 自己維護，不必填。",
  timesKeptOnEdit: "建立時間與更新時間都由 Rustle 自己維護，不能編輯。檔名也不會因為改標題而改變。",
  blankTitleOnCreate: "請先輸入標題，「建立」才會啟用。",
  blankTitleOnEdit: "請先輸入標題，「儲存」才會啟用。",
  cancel: "取消",
  create: "建立",
  save: "儲存",

  failedOperations: {
    createArticle: "建立文章失敗",
    updateMetadata: "更新 metadata 失敗",
    deleteArticle: "刪除文章失敗",
    renameWorkspace: "重新命名 workspace 失敗",
    deleteWorkspace: "刪除 workspace 失敗",
  } satisfies Record<Operation, string> as Record<Operation, string>,
  failureWithReason: (failure: string, reason: string) => `${failure}：${reason}`,
  noWorkspaceSelected: "請先在左邊選一個 workspace，新文章才知道要建立在哪裡。",
  modifiedElsewhere: "這篇文章剛剛被別的程式改過，什麼都沒有寫入。請再試一次。",
  leavingRefusals: {
    blockedByUnansweredWarning: "請先回答寫作區下方的外部改動提示，再試一次。",
    blockedByFailedSave: "上一次儲存失敗。再按一次就會放掉未儲存的變更並繼續。",
  } satisfies Record<LeavingRefusal, string> as Record<LeavingRefusal, string>,
  dismiss: "關閉提示",
};

export type Messages = typeof CHINESE_MESSAGES;

export const ENGLISH_MESSAGES: Partial<Messages> = {
  sidebar: "Sidebar",
  allNotes: "All Notes",
  workspacesTitle: "WORKSPACES",
  statusTitle: "STATUS",
  tagsTitle: "TAGS",
  noTagsYet: "No tags yet",
  statusLabels: {
    active: "Active",
    onHold: "On Hold",
    completed: "Completed",
    dropped: "Dropped",
    noStatus: "No Status",
  },
  articlesTitle: "ARTICLES",
  articlesRegion: "Articles",
  editorTitle: "EDITOR",
  editorRegion: "Editor",
  previewTitle: "PREVIEW",
  previewRegion: "Preview",
  openPreview: "Open preview",
  openPreviewHandle: "◀ Preview",
  closePreview: "Close preview",
  previewContent: "Preview content",
  adjustPreviewWidth: "Adjust preview width",

  settings: "Settings",
  language: "Language",

  vaultUnreadable: (reason) => `Cannot read the vault: ${reason}`,
  firstWorkspace: "Create your first workspace",
  unknownArticleCount: "Article count unavailable",
  articleCount: (count) => (count === 1 ? "1 article" : `${count} articles`),
  rename: "Rename",
  renameWorkspace: (workspace) => `Rename "${workspace}"`,
  delete: "Delete",
  deleteWorkspace: (workspace) => `Delete "${workspace}"`,
  newWorkspaceName: "New workspace name",
  newWorkspacePlaceholder: "＋ New workspace",
  newNameFor: (workspace) => `New name for "${workspace}"`,
  workspaceNameRejections: {
    empty: "Enter a workspace name first.",
    containsPathSeparator: "A name cannot contain / or \\ — a workspace is one single folder.",
    reserved: "That name is reserved (images, or any name starting with a dot). Choose another.",
    alreadyUsed: "That name is already taken. Choose another.",
  },

  deleteWorkspaceHeading: (workspace) => `Delete workspace "${workspace}"?`,
  deleteWorkspaceContents: (articleCount, imageCount) =>
    `This will delete ${articleCount} article(s) and ${imageCount} image(s).`,
  deleteWorkspaceDestination: (workspace) =>
    `The whole ${workspace} folder goes to the system trash, where it can still be restored.`,
  deleteWorkspaceConfirm: "Delete workspace",

  filterArticles: "Filter articles",
  filterPlaceholder: "filter",
  newArticle: "New article",
  chooseWorkspaceFirst: "Choose a workspace first",
  workspaceUnreadable: (reason) => `Cannot read this workspace: ${reason}`,
  createFirstArticle: "Create the first article",
  noMatchingArticles: "No matching articles",
  noArticlesInVault: "No articles in the vault yet",
  incompleteMetadata: "incomplete metadata",
  openOutsideFilter: "open · outside the filter",
  editMetadata: "Edit metadata",
  editMetadataFor: (title) => `Edit metadata for "${title}"`,
  deleteArticle: (title) => `Delete "${title}"`,

  deleteArticleHeading: (title) => `Delete "${title}"?`,
  deleteArticleDestination: "The article goes to the system trash, where it can still be restored.",
  deleteArticleKeepsImages:
    "None of its images are deleted — images/ is shared by the whole workspace, and another article may still be using the same picture.",
  deleteArticleConfirm: "Delete article",

  noArticleOpen: "No article open",
  articleUnreadable: (reason) => `Cannot read this article: ${reason}`,

  saveStatusLine: "Save status",
  articlePath: (workspace, fileName) => `${fileName} in ${workspace}`,
  saveIndicators: {
    saving: "Not in the file yet",
    saved: "In the file",
    failed: "Cannot be written to the file",
  },
  saveFailed: (reason) => `Save failed: ${reason}`,
  changedOutsideRustle: "This file was changed outside Rustle",
  overwrite: "Overwrite",
  reload: "Reload",
  savingImage: "Saving image…",
  imageNotSaved: (reason) => (reason === "" ? "Could not save the image." : `Could not save the image: ${reason}`),

  newArticleHeading: (workspace) => `New article · ${workspace}`,
  editMetadataHeading: (fileName) => `Edit metadata · ${fileName}`,
  titleField: "Title",
  statusField: "Status",
  tagsField: "Tags",
  candidatesFor: (field) => `${field} suggestions`,
  removeChip: (value) => `Remove "${value}"`,
  createdAt: (minute) => `Created ${minute}`,
  updatedAt: (minute) => `Updated ${minute}`,
  notRecordedInFile: "(not recorded in the file)",
  timesKeptOnCreate: "Rustle keeps both times itself — there is nothing to fill in.",
  timesKeptOnEdit:
    "Rustle keeps both times itself; they cannot be edited. Changing the title does not change the file name either.",
  blankTitleOnCreate: "Enter a title first — then Create becomes available.",
  blankTitleOnEdit: "Enter a title first — then Save becomes available.",
  cancel: "Cancel",
  create: "Create",
  save: "Save",

  failedOperations: {
    createArticle: "Could not create the article",
    updateMetadata: "Could not update the metadata",
    deleteArticle: "Could not delete the article",
    renameWorkspace: "Could not rename the workspace",
    deleteWorkspace: "Could not delete the workspace",
  },
  failureWithReason: (failure, reason) => `${failure}: ${reason}`,
  noWorkspaceSelected: "Choose a workspace on the left first, so the new article knows where to go.",
  modifiedElsewhere: "Another program just changed this article, so nothing was written. Try again.",
  leavingRefusals: {
    blockedByUnansweredWarning: "Answer the external-change notice below the editor first, then try again.",
    blockedByFailedSave: "The last save failed. Press again to discard the unsaved changes and continue.",
  },
  dismiss: "Dismiss",
};

/** A sentence missing from `primary` is said with `fallback`'s: never a blank, never a key. */
export function withFallback(primary: Partial<Messages>, fallback: Messages): Messages {
  return { ...fallback, ...definedEntriesOf(primary) };
}

function definedEntriesOf(messages: Partial<Messages>): Partial<Messages> {
  return Object.fromEntries(
    Object.entries(messages).filter(([, sentence]) => sentence !== undefined && sentence !== ""),
  );
}

const MESSAGES: Record<InterfaceLanguage, Messages> = {
  zh: CHINESE_MESSAGES,
  en: withFallback(ENGLISH_MESSAGES, CHINESE_MESSAGES),
};

export function messagesFor(language: InterfaceLanguage): Messages {
  return MESSAGES[language];
}
