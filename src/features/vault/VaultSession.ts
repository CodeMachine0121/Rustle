import type { ArticleSummary } from "../../ipc/articleSummary";
import type { Channels } from "../../ipc/channels";
import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import type { Settings } from "../../ipc/settings";
import type { WorkspaceSummary } from "../../ipc/workspaceSummary";

export type VaultChannels = Pick<
  Channels,
  "listWorkspaces" | "listArticles" | "createWorkspace" | "readBody" | "readSettings" | "writeSettings"
>;

export type VaultSnapshot = {
  workspaces: WorkspaceSummary[];
  selectedWorkspace: string | null;
  articles: ArticleSummary[];
  selectedArticle: string | null;
  body: string | null;
  indentation: Settings["indentation"];
  workspaceListFailure: string | null;
  articleListFailure: string | null;
  bodyFailure: string | null;
  creationRejection: WorkspaceNameRejection | null;
  creationFailure: string | null;
};

const DEFAULT_SETTINGS: Settings = {
  indentation: { style: "spaces", width: 2 },
  previewPanel: { isOpen: true, widthRatio: 0.5 },
  lastOpened: { workspace: null, article: null },
};

const EMPTY_SNAPSHOT: VaultSnapshot = {
  workspaces: [],
  selectedWorkspace: null,
  articles: [],
  selectedArticle: null,
  body: null,
  indentation: DEFAULT_SETTINGS.indentation,
  workspaceListFailure: null,
  articleListFailure: null,
  bodyFailure: null,
  creationRejection: null,
  creationFailure: null,
};

/**
 * The one owner of what is selected in the vault. Every click goes through
 * here; an answer that arrives after a newer click is dropped, and each
 * selection is remembered in the settings for the next start.
 */
export class VaultSession {
  readonly #channels: VaultChannels;
  readonly #listeners = new Set<() => void>();
  #snapshot = EMPTY_SNAPSHOT;
  #settings: Settings | null = null;
  #latestSelection = 0;

  constructor(channels: VaultChannels) {
    this.#channels = channels;
  }

  get snapshot(): VaultSnapshot {
    return this.#snapshot;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  async start(): Promise<void> {
    const settings = await this.#channels.readSettings();
    if (settings.ok) {
      this.#settings = settings.payload;
      this.#update({ indentation: settings.payload.indentation });
    }
    if (!(await this.#loadWorkspaces())) {
      return;
    }
    const { workspace, article } = (this.#settings ?? DEFAULT_SETTINGS).lastOpened;
    if (workspace === null || !this.#snapshot.workspaces.some(({ name }) => name === workspace)) {
      return;
    }
    const selection = this.#beginSelection();
    if (!(await this.#openWorkspace(workspace, selection))) {
      return;
    }
    if (article !== null && this.#snapshot.articles.some(({ fileName }) => fileName === article)) {
      await this.#openArticle(workspace, article, selection);
    }
  }

  async selectWorkspace(workspace: string): Promise<void> {
    const selection = this.#beginSelection();
    if (await this.#openWorkspace(workspace, selection)) {
      this.#remember(workspace, null);
    }
  }

  async selectArticle(fileName: string): Promise<void> {
    const workspace = this.#snapshot.selectedWorkspace;
    if (workspace === null) {
      return;
    }
    const selection = this.#beginSelection();
    if (await this.#openArticle(workspace, fileName, selection)) {
      this.#remember(workspace, fileName);
    }
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

  async #loadWorkspaces(): Promise<boolean> {
    const result = await this.#channels.listWorkspaces();
    if (!result.ok) {
      this.#update({ workspaceListFailure: result.message });
      return false;
    }
    this.#update({ workspaces: result.payload, workspaceListFailure: null });
    return true;
  }

  async #openWorkspace(workspace: string, selection: number): Promise<boolean> {
    this.#update({
      selectedWorkspace: workspace,
      articles: [],
      selectedArticle: null,
      body: null,
      articleListFailure: null,
      bodyFailure: null,
    });
    const result = await this.#channels.listArticles(workspace);
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

  async #openArticle(workspace: string, fileName: string, selection: number): Promise<boolean> {
    this.#update({ selectedArticle: fileName, bodyFailure: null });
    const result = await this.#channels.readBody(workspace, fileName);
    if (selection !== this.#latestSelection) {
      return false;
    }
    if (!result.ok) {
      this.#update({ body: null, bodyFailure: result.message });
      return false;
    }
    this.#update({ body: result.payload.body });
    return true;
  }

  #beginSelection(): number {
    this.#latestSelection += 1;
    return this.#latestSelection;
  }

  #remember(workspace: string, article: string | null): void {
    // Settings that were never read are not written: that would replace
    // the user's other settings with defaults.
    if (this.#settings === null) {
      return;
    }
    this.#settings = { ...this.#settings, lastOpened: { workspace, article } };
    // Remembering where the user was is a convenience, not their writing: a
    // settings file that cannot be written must not get in the way.
    void this.#channels.writeSettings(this.#settings);
  }

  #update(change: Partial<VaultSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...change };
    this.#listeners.forEach((listener) => listener());
  }
}
