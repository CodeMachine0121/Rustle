import type { ArticleStatus } from "../../ipc/articleStatus";
import type { ArticleLocation, ArticleSummary } from "../../ipc/articleSummary";
import type { Channels } from "../../ipc/channels";
import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import type { Settings } from "../../ipc/settings";
import type { WorkspaceContents } from "../../ipc/workspaceContents";
import type { WorkspaceSummary } from "../../ipc/workspaceSummary";
import type { AutosaveSession } from "../autosave/AutosaveSession";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { SidebarFilter } from "../sidebar/SidebarFilter";
import type { StatusChoice } from "../sidebar/statusChoice";
import { firstArticleIn, type ArticleOrder } from "./articleArrangement";
import { isSameArticle } from "./articleLocation";
import {
  reportedFailure,
  type FailureReason,
  type Operation,
  type OperationFailure,
} from "./operationFailure";

export type VaultChannels = Pick<
  Channels,
  | "listWorkspaces"
  | "listArticles"
  | "listAllArticles"
  | "createWorkspace"
  | "createArticle"
  | "readBody"
  | "readSettings"
  | "writeSettings"
  | "updateMetadata"
  | "deleteArticle"
  | "renameWorkspace"
  | "countWorkspaceContents"
  | "deleteWorkspace"
>;

/** What the user typed into the create article dialog or the metadata form. */
export type ArticleDraft = { title: string; status: ArticleStatus | null; tags: string[] };

export type ArticleCreation = { outcome: "created" } | { outcome: "failed"; reason: FailureReason };

export type MetadataEdit = { outcome: "updated" } | { outcome: "failed"; reason: FailureReason };

export type RenameRejection = { workspace: string; reason: WorkspaceNameRejection };

/** Holds the open article and may refuse to let it go, for example while it cannot be saved. */
export type ArticleHolder = Pick<AutosaveSession, "openArticle" | "closeArticle" | "placeCursor">;

const LETS_EVERY_ARTICLE_GO: ArticleHolder = {
  openArticle: () => Promise.resolve("switched"),
  closeArticle: () => Promise.resolve("switched"),
  placeCursor: () => undefined,
};

export type VaultSnapshot = {
  workspaces: WorkspaceSummary[];
  /** `null` under All Notes, which shows every workspace's articles instead. */
  selectedWorkspace: string | null;
  showsAllNotes: boolean;
  /** The articles of the scope: the selected workspace, or every workspace under All Notes. */
  articles: ArticleSummary[];
  sidebarFilter: SidebarFilter;
  selectedArticle: ArticleLocation | null;
  body: string | null;
  openedDocument: string | null;
  indentation: Settings["indentation"];
  workspaceListFailure: string | null;
  articleListFailure: string | null;
  bodyFailure: string | null;
  creationRejection: WorkspaceNameRejection | null;
  creationFailure: string | null;
  renameRejection: RenameRejection | null;
  operationFailure: OperationFailure | null;
};

/** What the session shows before it has read anything. */
export const INITIAL_VAULT_SNAPSHOT: VaultSnapshot = {
  workspaces: [],
  selectedWorkspace: null,
  showsAllNotes: false,
  articles: [],
  sidebarFilter: SidebarFilter.NONE,
  selectedArticle: null,
  body: null,
  openedDocument: null,
  indentation: DEFAULT_SETTINGS.indentation,
  workspaceListFailure: null,
  articleListFailure: null,
  bodyFailure: null,
  creationRejection: null,
  creationFailure: null,
  renameRejection: null,
  operationFailure: null,
};

/** What the sidebar can have selected: one workspace, or All Notes. */
export type Scope = { kind: "workspace"; workspace: string } | { kind: "allNotes" };

/**
 * The one owner of what is selected in the vault: the scope (one workspace
 * or All Notes), the sidebar filter over it and the open article. Every
 * click goes through here; an answer that arrives after a newer click is
 * dropped, and each opened article is remembered in the settings for the
 * next start. The open article changes only when its holder lets the
 * previous one go. Changing the scope clears the sidebar filter.
 */
export class VaultSession {
  readonly #channels: VaultChannels;
  readonly #articleHolder: ArticleHolder;
  readonly #listeners = new Set<() => void>();
  #snapshot = INITIAL_VAULT_SNAPSHOT;
  readonly #settings: SettingsSession;
  #latestSelection = 0;

  constructor(
    channels: VaultChannels,
    articleHolder: ArticleHolder = LETS_EVERY_ARTICLE_GO,
    settings: SettingsSession = new SettingsSession(channels),
  ) {
    this.#channels = channels;
    this.#articleHolder = articleHolder;
    this.#settings = settings;
  }

  get snapshot(): VaultSnapshot {
    return this.#snapshot;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  async start(): Promise<void> {
    await this.#settings.load();
    this.#update({ indentation: this.#settings.settings.indentation });
    if (!(await this.#loadWorkspaces())) {
      return;
    }
    const { workspace, article } = this.#settings.settings.lastOpened;
    if (workspace === null || !this.#snapshot.workspaces.some(({ name }) => name === workspace)) {
      return;
    }
    const selection = this.#beginSelection();
    if (!(await this.#openScope({ kind: "workspace", workspace }, selection))) {
      return;
    }
    if (article !== null && this.#snapshot.articles.some(({ fileName }) => fileName === article)) {
      await this.#openArticle({ workspace, fileName: article }, selection);
    }
  }

  async selectWorkspace(workspace: string): Promise<void> {
    if ((await this.#articleHolder.closeArticle()) !== "switched") {
      return;
    }
    const selection = this.#beginSelection();
    if (await this.#openScope({ kind: "workspace", workspace }, selection)) {
      this.#remember(workspace, null);
    }
  }

  /** Lists every workspace's articles; not remembered, as it is a way of looking rather than a place. */
  async selectAllNotes(): Promise<void> {
    if ((await this.#articleHolder.closeArticle()) !== "switched") {
      return;
    }
    await this.#openScope({ kind: "allNotes" }, this.#beginSelection());
  }

  /**
   * Goes to a workspace or All Notes rather than looking at it: the newest
   * article (the list's first row in `order`) opens without taking the
   * keyboard. An empty scope, or a newest article that cannot be read,
   * leaves the editor empty.
   */
  async goTo(scope: Scope, order: ArticleOrder): Promise<void> {
    if ((await this.#articleHolder.closeArticle()) !== "switched") {
      return;
    }
    const selection = this.#beginSelection();
    if (!(await this.#openScope(scope, selection))) {
      return;
    }
    const newest = firstArticleIn(this.#snapshot.articles, order);
    if (newest !== null) {
      const { workspace, fileName } = newest;
      if (await this.#openArticle({ workspace, fileName }, selection)) {
        this.#remember(workspace, fileName);
        return;
      }
    }
    if (selection !== this.#latestSelection) {
      return;
    }
    this.#update({ selectedArticle: null, bodyFailure: null });
    if (scope.kind === "workspace") {
      this.#remember(scope.workspace, null);
    }
  }

  /**
   * Opens an article the writer found and hands it the keyboard, with the
   * cursor on `cursorLine` (a body line from 1) when given. The open article
   * only moves its cursor, keeping what has not been saved yet.
   */
  async openFoundArticle(article: ArticleLocation, cursorLine?: number): Promise<void> {
    if (this.#snapshot.openedDocument === documentOf(article)) {
      if (cursorLine !== undefined) {
        this.#articleHolder.placeCursor(cursorLine);
      }
      return;
    }
    const selection = this.#beginSelection();
    if (await this.#openArticle(article, selection, { focusEditor: true, cursorLine })) {
      this.#remember(article.workspace, article.fileName);
    }
  }

  async selectArticle(article: ArticleLocation): Promise<void> {
    if (this.#snapshot.openedDocument === documentOf(article)) {
      return;
    }
    const selection = this.#beginSelection();
    if (await this.#openArticle(article, selection)) {
      this.#remember(article.workspace, article.fileName);
    }
  }

  toggleStatusFilter(choice: StatusChoice): void {
    this.#update({ sidebarFilter: this.#snapshot.sidebarFilter.toggleStatus(choice) });
  }

  toggleTagFilter(tag: string): void {
    this.#update({ sidebarFilter: this.#snapshot.sidebarFilter.toggleTag(tag) });
  }

  /** Resolves to whether the workspace was created. */
  async createWorkspace(typedName: string): Promise<boolean> {
    this.#update({ creationRejection: null, creationFailure: null });
    const result = await this.#channels.createWorkspace(typedName);
    if (!result.ok) {
      this.#update({ creationFailure: result.message });
      return false;
    }
    if (result.payload.outcome === "rejected") {
      this.#update({ creationRejection: result.payload.reason });
      return false;
    }
    await this.#loadWorkspaces();
    await this.selectWorkspace(result.payload.workspace.name);
    return true;
  }

  /**
   * Creates an article in the selected workspace, refreshes both lists and
   * opens it with the cursor in the editor. The article counts as created
   * even when the open article may not be left yet.
   */
  async createArticle(draft: ArticleDraft): Promise<ArticleCreation> {
    const workspace = this.#snapshot.selectedWorkspace;
    if (workspace === null) {
      return { outcome: "failed", reason: { kind: "noWorkspaceSelected" } };
    }
    const selection = this.#beginSelection();
    const result = await this.#channels.createArticle({ workspace, ...draft });
    if (!result.ok) {
      this.#fail("createArticle", reportedFailure(result.message));
      return { outcome: "failed", reason: reportedFailure(result.message) };
    }
    this.dismissOperationFailure();
    await this.#loadWorkspaces();
    await this.#reloadArticles(selection);
    if (selection !== this.#latestSelection) {
      return { outcome: "created" };
    }
    const created = { workspace, fileName: result.payload.fileName };
    if (await this.#openArticle(created, selection, { focusEditor: true })) {
      this.#remember(workspace, created.fileName);
    }
    return { outcome: "created" };
  }

  /**
   * Writes the title, status and tags into the article in its own
   * workspace. The open article is saved and let go first, and opened
   * again afterwards with its new modification time, so our own write is
   * never taken for an outside change.
   */
  async updateMetadata(article: ArticleLocation, draft: ArticleDraft): Promise<MetadataEdit> {
    const wasOpen = this.#snapshot.openedDocument === documentOf(article);
    const selection = this.#selectionFor(wasOpen);
    if (wasOpen && !(await this.#letGoOfOpenArticle("updateMetadata"))) {
      return this.#failedEdit();
    }
    const { workspace, fileName } = article;
    const result = await this.#channels.updateMetadata({ workspace, fileName, ...draft });
    await this.#reloadArticles(selection);
    await this.#openAgain(wasOpen ? article : null, selection);
    if (!result.ok) {
      this.#fail("updateMetadata", reportedFailure(result.message));
      return this.#failedEdit();
    }
    if (result.payload.outcome === "modifiedElsewhere") {
      this.#fail("updateMetadata", { kind: "modifiedElsewhere" });
      return this.#failedEdit();
    }
    this.dismissOperationFailure();
    return { outcome: "updated" };
  }

  /** Moves the article to the system trash; the open one is saved first and nothing is left selected. */
  async deleteArticle(article: ArticleLocation): Promise<void> {
    const wasSelected = isSameArticle(this.#snapshot.selectedArticle, article);
    const selection = this.#selectionFor(wasSelected);
    if (wasSelected && !(await this.#letGoOfOpenArticle("deleteArticle"))) {
      return;
    }
    const result = await this.#channels.deleteArticle(article.workspace, article.fileName);
    if (!result.ok) {
      this.#fail("deleteArticle", reportedFailure(result.message));
      await this.#openAgain(wasSelected ? article : null, selection);
      return;
    }
    this.dismissOperationFailure();
    if (wasSelected) {
      this.#update({ selectedArticle: null });
      this.#remember(article.workspace, null);
    }
    await this.#loadWorkspaces();
    await this.#reloadArticles(selection);
  }

  /** Resolves to whether the workspace was renamed; a selected one stays selected under its new name. */
  async renameWorkspace(workspace: string, typedName: string): Promise<boolean> {
    this.#update({ renameRejection: null });
    const wasSelected = this.#snapshot.selectedWorkspace === workspace;
    const openArticle = this.#openArticleIn(workspace);
    const touchesSelection = wasSelected || openArticle !== null;
    const selection = this.#selectionFor(touchesSelection);
    if (touchesSelection && !(await this.#letGoOfOpenArticle("renameWorkspace"))) {
      return false;
    }
    const result = await this.#channels.renameWorkspace(workspace, typedName);
    if (!result.ok) {
      this.#fail("renameWorkspace", reportedFailure(result.message));
      await this.#openAgain(openArticle, selection);
      return false;
    }
    if (result.payload.outcome === "rejected") {
      this.#update({ renameRejection: { workspace, reason: result.payload.reason } });
      await this.#openAgain(openArticle, selection);
      return false;
    }
    this.dismissOperationFailure();
    const renamed = result.payload.workspace;
    await this.#loadWorkspaces();
    if (wasSelected && selection === this.#latestSelection) {
      if (await this.#openScope({ kind: "workspace", workspace: renamed }, selection)) {
        this.#remember(renamed, null);
      }
    } else if (this.#snapshot.showsAllNotes) {
      await this.#reloadArticles(selection);
      if (openArticle !== null && selection === this.#latestSelection) {
        this.#update({ selectedArticle: null });
        this.#remember(renamed, null);
      }
    }
    return true;
  }

  /** What deleting the workspace would take, counted now; `null` (and a notice) when it cannot be counted. */
  async countWorkspaceContents(workspace: string): Promise<WorkspaceContents | null> {
    const result = await this.#channels.countWorkspaceContents(workspace);
    if (!result.ok) {
      this.#fail("deleteWorkspace", reportedFailure(result.message));
      return null;
    }
    return result.payload;
  }

  /** Moves the whole workspace folder to the system trash; a selected one leaves nothing selected. */
  async deleteWorkspace(workspace: string): Promise<void> {
    const wasSelected = this.#snapshot.selectedWorkspace === workspace;
    const openArticle = this.#openArticleIn(workspace);
    const touchesSelection = wasSelected || openArticle !== null;
    const selection = this.#selectionFor(touchesSelection);
    if (touchesSelection && !(await this.#letGoOfOpenArticle("deleteWorkspace"))) {
      return;
    }
    const result = await this.#channels.deleteWorkspace(workspace);
    if (!result.ok) {
      this.#fail("deleteWorkspace", reportedFailure(result.message));
      await this.#openAgain(openArticle, selection);
      return;
    }
    this.dismissOperationFailure();
    if (wasSelected) {
      this.#update({
        selectedWorkspace: null,
        articles: [],
        sidebarFilter: SidebarFilter.NONE,
        selectedArticle: null,
        articleListFailure: null,
        bodyFailure: null,
      });
      this.#remember(null, null);
    } else if (openArticle !== null) {
      this.#update({ selectedArticle: null });
      this.#remember(null, null);
    }
    await this.#loadWorkspaces();
    if (this.#snapshot.showsAllNotes) {
      await this.#reloadArticles(selection);
    }
  }

  dismissOperationFailure(): void {
    if (this.#snapshot.operationFailure !== null) {
      this.#update({ operationFailure: null });
    }
  }

  async #letGoOfOpenArticle(operation: Operation): Promise<boolean> {
    const outcome = await this.#articleHolder.closeArticle();
    if (outcome !== "switched") {
      this.#fail(operation, { kind: "leavingRefused", refusal: outcome });
      return false;
    }
    this.#update({ body: null, openedDocument: null, bodyFailure: null });
    return true;
  }

  /** Opens the article an operation let go of, unless nothing was open or the user clicked elsewhere since. */
  async #openAgain(article: ArticleLocation | null, selection: number): Promise<void> {
    if (article !== null && selection === this.#latestSelection) {
      await this.#openArticle(article, selection);
    }
  }

  /** The open article when it lives in `workspace`. */
  #openArticleIn(workspace: string): ArticleLocation | null {
    const article = this.#snapshot.selectedArticle;
    return article?.workspace === workspace ? article : null;
  }

  async #reloadArticles(selection: number): Promise<void> {
    const scope = this.#scope();
    if (scope === null) {
      return;
    }
    const articles = await this.#listArticlesOf(scope);
    if (selection !== this.#latestSelection || !isSameScope(this.#scope(), scope)) {
      return;
    }
    this.#update(
      articles.ok
        ? {
            articles: articles.payload,
            articleListFailure: null,
            sidebarFilter: this.#snapshot.sidebarFilter.keepingTagsIn(articles.payload),
          }
        : { articleListFailure: articles.message },
    );
  }

  #scope(): Scope | null {
    if (this.#snapshot.showsAllNotes) {
      return { kind: "allNotes" };
    }
    const workspace = this.#snapshot.selectedWorkspace;
    return workspace === null ? null : { kind: "workspace", workspace };
  }

  #listArticlesOf(scope: Scope) {
    return scope.kind === "allNotes"
      ? this.#channels.listAllArticles()
      : this.#channels.listArticles(scope.workspace);
  }

  #failedEdit(): MetadataEdit {
    return { outcome: "failed", reason: this.#snapshot.operationFailure?.reason ?? reportedFailure("") };
  }

  #fail(operation: Operation, reason: FailureReason): void {
    this.#update({ operationFailure: { operation, reason } });
  }

  async #loadWorkspaces(): Promise<boolean> {
    const result = await this.#channels.listWorkspaces();
    if (!result.ok) {
      this.#update({ workspaceListFailure: result.message });
      return false;
    }
    this.#update({ workspaces: result.payload, workspaceListFailure: null });
    return true;
  }

  async #openScope(scope: Scope, selection: number): Promise<boolean> {
    this.#update({
      selectedWorkspace: scope.kind === "workspace" ? scope.workspace : null,
      showsAllNotes: scope.kind === "allNotes",
      articles: [],
      sidebarFilter: SidebarFilter.NONE,
      selectedArticle: null,
      body: null,
      openedDocument: null,
      articleListFailure: null,
      bodyFailure: null,
    });
    const result = await this.#listArticlesOf(scope);
    if (selection !== this.#latestSelection) {
      return false;
    }
    if (!result.ok) {
      this.#update({ articleListFailure: result.message });
      return false;
    }
    this.#update({ articles: result.payload });
    return true;
  }

  async #openArticle(
    article: ArticleLocation,
    selection: number,
    { focusEditor = false, cursorLine }: { focusEditor?: boolean; cursorLine?: number } = {},
  ): Promise<boolean> {
    const previousArticle = this.#snapshot.selectedArticle;
    this.#update({ selectedArticle: article, bodyFailure: null });
    const result = await this.#channels.readBody(article.workspace, article.fileName);
    if (selection !== this.#latestSelection) {
      return false;
    }
    const title =
      this.#snapshot.articles.find((summary) => isSameArticle(summary, article))?.title ??
      article.fileName;
    const outcome = result.ok
      ? await this.#articleHolder.openArticle({ article: result.payload, title, focusEditor, cursorLine })
      : await this.#articleHolder.closeArticle();
    if (selection !== this.#latestSelection) {
      return false;
    }
    if (outcome !== "switched") {
      this.#update({ selectedArticle: previousArticle });
      return false;
    }
    if (!result.ok) {
      this.#update({ body: null, openedDocument: null, bodyFailure: result.message });
      return false;
    }
    this.#update({ body: result.payload.body, openedDocument: documentOf(article) });
    return true;
  }

  /** An operation on what is selected starts a new selection; one on anything else leaves the user's click alone. */
  #selectionFor(touchesSelection: boolean): number {
    return touchesSelection ? this.#beginSelection() : this.#latestSelection;
  }

  #beginSelection(): number {
    this.#latestSelection += 1;
    return this.#latestSelection;
  }

  #remember(workspace: string | null, article: string | null): void {
    this.#settings.change((settings) => ({ ...settings, lastOpened: { workspace, article } }));
  }

  #update(change: Partial<VaultSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...change };
    this.#listeners.forEach((listener) => listener());
  }
}

function documentOf({ workspace, fileName }: ArticleLocation): string {
  return `${workspace}/${fileName}`;
}

function isSameScope(first: Scope | null, second: Scope): boolean {
  if (first === null || first.kind !== second.kind) {
    return false;
  }
  return first.kind === "allNotes" || (second.kind === "workspace" && first.workspace === second.workspace);
}
