import { describe, expect, it, vi } from "vitest";

import type { ArticleLocation, ArticleSummary } from "../../ipc/articleSummary";
import type { ChannelResult } from "../../ipc/channelResult";
import type { CreateArticleRequest } from "../../ipc/createArticleRequest";
import type { CreateWorkspaceOutcome } from "../../ipc/createWorkspaceOutcome";
import type { MetadataUpdateOutcome, MetadataUpdateRequest } from "../../ipc/metadataUpdate";
import type { RenameWorkspaceOutcome } from "../../ipc/renameWorkspaceOutcome";
import type { WorkspaceContents } from "../../ipc/workspaceContents";
import type { Settings } from "../../ipc/settings";
import type { AutosaveSwitchOutcome } from "../autosave/AutosaveSession";
import { SettingsSession } from "../settings/SettingsSession";
import { VaultSession, type ArticleDraft, type ArticleHolder, type VaultChannels } from "./VaultSession";

function ok<Payload>(payload: Payload): Promise<ChannelResult<Payload>> {
  return Promise.resolve({ ok: true, payload });
}

function failed(message: string): Promise<ChannelResult<never>> {
  return Promise.resolve({ ok: false, reason: "unexpected", message });
}

function blog(fileName: string): ArticleLocation {
  return { workspace: "Blog", fileName };
}

function article(fileName: string, workspace = "Blog"): ArticleSummary {
  return {
    workspace,
    fileName,
    title: fileName.replace(/\.md$/, ""),
    createdAt: "",
    updatedAt: "",
    status: null,
    tags: [],
    hasIncompleteMetadata: true,
  };
}

const STORED_SETTINGS: Settings = {
  indentation: { style: "tab", width: 4 },
  previewPanel: { isOpen: false, widthRatio: 0.3 },
  lastOpened: { workspace: "Blog", article: "zen-of-writing.md" },
  sidebar: { collapsedSections: [] },
};

const ARTICLES: Record<string, ArticleSummary[]> = {
  Blog: [article("a.md"), article("b.md"), article("zen-of-writing.md")],
  Work: [],
};

function vaultChannels(settings: Settings = STORED_SETTINGS) {
  return {
    readSettings: vi.fn(() => ok(settings)),
    writeSettings: vi.fn(() => ok(null)),
    listWorkspaces: vi.fn(() =>
      ok([
        { name: "Blog", articleCount: 3 },
        { name: "Work", articleCount: 0 },
      ]),
    ),
    listArticles: vi.fn((workspace: string) => ok(ARTICLES[workspace] ?? [])),
    listAllArticles: vi.fn(() => ok(Object.values(ARTICLES).flat())),
    readBody: vi.fn((workspace: string, fileName: string) =>
      ok({ workspace, fileName, body: `${fileName} 的正文`, lastKnownModifiedAt: "2026-08-20T08:04:11.123Z" }),
    ),
    createWorkspace: vi.fn(
      (name: string): Promise<ChannelResult<CreateWorkspaceOutcome>> =>
        ok({ outcome: "created", workspace: { name, articleCount: 0 } }),
    ),
    createArticle: vi.fn(
      (request: CreateArticleRequest): Promise<ChannelResult<ArticleSummary>> =>
        ok({ ...article("new-article.md"), title: request.title }),
    ),
    updateMetadata: vi.fn(
      (request: MetadataUpdateRequest): Promise<ChannelResult<MetadataUpdateOutcome>> =>
        ok({ outcome: "updated", article: { ...article(request.fileName), title: request.title } }),
    ),
    deleteArticle: vi.fn((): Promise<ChannelResult<null>> => ok(null)),
    renameWorkspace: vi.fn(
      (_workspace: string, newName: string): Promise<ChannelResult<RenameWorkspaceOutcome>> =>
        ok({ outcome: "renamed", workspace: newName }),
    ),
    countWorkspaceContents: vi.fn(
      (): Promise<ChannelResult<WorkspaceContents>> => ok({ articleCount: 3, imageCount: 2 }),
    ),
    deleteWorkspace: vi.fn(
      (): Promise<ChannelResult<WorkspaceContents>> => ok({ articleCount: 3, imageCount: 2 }),
    ),
  } satisfies VaultChannels;
}

function articleHolder() {
  return {
    openArticle: vi.fn((): Promise<AutosaveSwitchOutcome> => Promise.resolve("switched")),
    closeArticle: vi.fn((): Promise<AutosaveSwitchOutcome> => Promise.resolve("switched")),
    placeCursor: vi.fn(),
  } satisfies ArticleHolder;
}

function settingsWith(lastOpened: Settings["lastOpened"]): Settings {
  return { ...STORED_SETTINGS, lastOpened };
}

describe("VaultSession", () => {
  it("restores the workspace and article opened last time", async () => {
    const session = new VaultSession(vaultChannels());

    await session.start();

    expect(session.snapshot.selectedWorkspace).toBe("Blog");
    expect(session.snapshot.selectedArticle).toEqual(blog("zen-of-writing.md"));
    expect(session.snapshot.body).toBe("zen-of-writing.md 的正文");
    expect(session.snapshot.indentation).toEqual({ style: "tab", width: 4 });
  });

  it("selects only the workspace when the last article is gone", async () => {
    const session = new VaultSession(
      vaultChannels(settingsWith({ workspace: "Blog", article: "gone.md" })),
    );

    await session.start();

    expect(session.snapshot.selectedWorkspace).toBe("Blog");
    expect(session.snapshot.selectedArticle).toBeNull();
    expect(session.snapshot.body).toBeNull();
  });

  it("selects nothing when the last workspace is gone but still lists the others", async () => {
    const channels = vaultChannels(settingsWith({ workspace: "Gone", article: "a.md" }));
    const session = new VaultSession(channels);

    await session.start();

    expect(session.snapshot.selectedWorkspace).toBeNull();
    expect(session.snapshot.workspaces.map(({ name }) => name)).toEqual(["Blog", "Work"]);
    expect(channels.listArticles).not.toHaveBeenCalled();
  });

  it("selects nothing when nothing was opened before", async () => {
    const session = new VaultSession(vaultChannels(settingsWith({ workspace: null, article: null })));

    await session.start();

    expect(session.snapshot.selectedWorkspace).toBeNull();
    expect(session.snapshot.selectedArticle).toBeNull();
  });

  it("starts with default indentation when the settings cannot be read", async () => {
    const channels = vaultChannels();
    channels.readSettings.mockReturnValue(failed("outside the vault"));
    const session = new VaultSession(channels);

    await session.start();

    expect(session.snapshot.indentation).toEqual({ style: "spaces", width: 2 });
    expect(session.snapshot.selectedWorkspace).toBeNull();
  });

  it("does not write the settings back just because it started", async () => {
    const channels = vaultChannels();

    await new VaultSession(channels).start();

    expect(channels.writeSettings).not.toHaveBeenCalled();
  });

  it("reports a workspace list that cannot be read", async () => {
    const channels = vaultChannels();
    channels.listWorkspaces.mockReturnValue(failed("permission denied"));
    const session = new VaultSession(channels);

    await session.start();

    expect(session.snapshot.workspaceListFailure).toBe("permission denied");
    expect(session.snapshot.selectedWorkspace).toBeNull();
  });

  it("lists the articles of a selected workspace and clears the editor", async () => {
    const session = new VaultSession(vaultChannels());
    await session.start();

    await session.selectWorkspace("Work");

    expect(session.snapshot.selectedWorkspace).toBe("Work");
    expect(session.snapshot.articles).toEqual([]);
    expect(session.snapshot.selectedArticle).toBeNull();
    expect(session.snapshot.body).toBeNull();
  });

  it("reports an article list that cannot be read", async () => {
    const channels = vaultChannels();
    channels.listArticles.mockReturnValue(failed("permission denied"));
    const session = new VaultSession(channels);

    await session.selectWorkspace("Blog");

    expect(session.snapshot.articleListFailure).toBe("permission denied");
    expect(channels.writeSettings).not.toHaveBeenCalled();
  });

  it("loads the body of a selected article", async () => {
    const session = new VaultSession(vaultChannels());
    await session.selectWorkspace("Blog");

    await session.selectArticle(blog("b.md"));

    expect(session.snapshot.selectedArticle).toEqual(blog("b.md"));
    expect(session.snapshot.body).toBe("b.md 的正文");
  });

  it("tells two opened articles apart even when their bodies are the same", async () => {
    const channels = vaultChannels();
    channels.readBody.mockImplementation((workspace, fileName) =>
      Promise.resolve({ ok: true, payload: { workspace, fileName, body: "", lastKnownModifiedAt: "" } }),
    );
    const session = new VaultSession(channels);
    await session.selectWorkspace("Blog");

    await session.selectArticle(blog("a.md"));
    const first = session.snapshot.openedDocument;
    await session.selectArticle(blog("b.md"));

    expect(first).not.toBeNull();
    expect(session.snapshot.openedDocument).not.toBeNull();
    expect(session.snapshot.openedDocument).not.toBe(first);
  });

  it("reports a body that cannot be read", async () => {
    const channels = vaultChannels();
    channels.readBody.mockReturnValue(failed("not text"));
    const session = new VaultSession(channels);
    await session.selectWorkspace("Blog");

    await session.selectArticle(blog("b.md"));

    expect(session.snapshot.body).toBeNull();
    expect(session.snapshot.bodyFailure).toBe("not text");
  });

  it("hands the opened article and its title to the article holder without taking the keyboard", async () => {
    const holder = articleHolder();
    const session = new VaultSession(vaultChannels(), holder);
    await session.selectWorkspace("Blog");

    await session.selectArticle(blog("b.md"));

    expect(holder.openArticle).toHaveBeenLastCalledWith({
      article: {
        workspace: "Blog",
        fileName: "b.md",
        body: "b.md 的正文",
        lastKnownModifiedAt: "2026-08-20T08:04:11.123Z",
      },
      title: "b",
      focusEditor: false,
    });
  });

  it("keeps the open article selected when the holder will not let it go", async () => {
    const holder = articleHolder();
    const channels = vaultChannels();
    const session = new VaultSession(channels, holder);
    await session.selectWorkspace("Blog");
    await session.selectArticle(blog("a.md"));
    holder.openArticle.mockResolvedValue("blockedByFailedSave");

    await session.selectArticle(blog("b.md"));

    expect(session.snapshot.selectedArticle).toEqual(blog("a.md"));
    expect(session.snapshot.body).toBe("a.md 的正文");
    expect(channels.writeSettings).not.toHaveBeenCalledWith(settingsWith({ workspace: "Blog", article: "b.md" }));
  });

  it("keeps the open article when the next one cannot be read and the holder will not let go", async () => {
    const holder = articleHolder();
    const channels = vaultChannels();
    const session = new VaultSession(channels, holder);
    await session.selectWorkspace("Blog");
    await session.selectArticle(blog("a.md"));
    channels.readBody.mockReturnValue(failed("not text"));
    holder.closeArticle.mockResolvedValue("blockedByUnansweredWarning");

    await session.selectArticle(blog("b.md"));

    expect(session.snapshot.selectedArticle).toEqual(blog("a.md"));
    expect(session.snapshot.bodyFailure).toBeNull();
  });

  it("stays in the workspace when the holder will not let the open article go", async () => {
    const holder = articleHolder();
    const channels = vaultChannels();
    const session = new VaultSession(channels, holder);
    await session.selectWorkspace("Blog");
    await session.selectArticle(blog("a.md"));
    holder.closeArticle.mockResolvedValue("blockedByFailedSave");

    await session.selectWorkspace("Work");

    expect(session.snapshot.selectedWorkspace).toBe("Blog");
    expect(session.snapshot.selectedArticle).toEqual(blog("a.md"));
    expect(channels.listArticles).not.toHaveBeenCalledWith("Work");
  });

  it("does not read the open article again when it is clicked again", async () => {
    const holder = articleHolder();
    const channels = vaultChannels();
    const session = new VaultSession(channels, holder);
    await session.selectWorkspace("Blog");
    await session.selectArticle(blog("a.md"));

    await session.selectArticle(blog("a.md"));

    expect(channels.readBody).toHaveBeenCalledTimes(1);
    expect(holder.openArticle).toHaveBeenCalledTimes(1);
  });

  it("remembers each selection and keeps the other settings it read", async () => {
    const channels = vaultChannels();
    const session = new VaultSession(channels);
    await session.start();

    await session.selectWorkspace("Blog");
    await session.selectArticle(blog("a.md"));

    expect(channels.writeSettings).toHaveBeenNthCalledWith(1, settingsWith({ workspace: "Blog", article: null }));
    expect(channels.writeSettings).toHaveBeenLastCalledWith(settingsWith({ workspace: "Blog", article: "a.md" }));
  });

  it("keeps a change another feature made to the shared settings when it remembers a selection", async () => {
    const channels = vaultChannels();
    const settings = new SettingsSession(channels);
    const session = new VaultSession(channels, articleHolder(), settings);
    await session.start();

    settings.change((current) => ({ ...current, previewPanel: { ...current.previewPanel, isOpen: true } }));
    await session.selectWorkspace("Work");

    expect(channels.writeSettings).toHaveBeenLastCalledWith({
      ...STORED_SETTINGS,
      previewPanel: { ...STORED_SETTINGS.previewPanel, isOpen: true },
      lastOpened: { workspace: "Work", article: null },
    });
  });

  it("does not write settings it never managed to read", async () => {
    const channels = vaultChannels();
    channels.readSettings.mockReturnValue(failed("permission denied"));
    const session = new VaultSession(channels);
    await session.start();

    await session.selectWorkspace("Blog");

    expect(session.snapshot.selectedWorkspace).toBe("Blog");
    expect(channels.writeSettings).not.toHaveBeenCalled();
  });

  it("drops an answer that arrives after a newer click", async () => {
    const channels = vaultChannels();
    const session = new VaultSession(channels);
    await session.start();
    await session.selectWorkspace("Blog");
    let answerSlowRead: () => void = () => undefined;
    channels.readBody.mockImplementationOnce(
      (workspace, fileName) =>
        new Promise((resolve) => {
          answerSlowRead = () =>
            resolve({
              ok: true,
              payload: { workspace, fileName, body: "慢的那篇", lastKnownModifiedAt: "" },
            });
        }),
    );

    const slow = session.selectArticle(blog("a.md"));
    await session.selectArticle(blog("b.md"));
    answerSlowRead();
    await slow;

    expect(session.snapshot.selectedArticle).toEqual(blog("b.md"));
    expect(session.snapshot.body).toBe("b.md 的正文");
    expect(channels.writeSettings).toHaveBeenLastCalledWith(settingsWith({ workspace: "Blog", article: "b.md" }));
  });

  it("drops an article list that arrives after another workspace was clicked", async () => {
    const channels = vaultChannels();
    let answerSlowList: () => void = () => undefined;
    channels.listArticles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerSlowList = () => resolve({ ok: true, payload: ARTICLES.Blog ?? [] });
        }),
    );
    const session = new VaultSession(channels);

    const slow = session.selectWorkspace("Blog");
    await session.selectWorkspace("Work");
    answerSlowList();
    await slow;

    expect(session.snapshot.selectedWorkspace).toBe("Work");
    expect(session.snapshot.articles).toEqual([]);
  });

  it("lists and selects a workspace it created", async () => {
    const channels = vaultChannels();
    const session = new VaultSession(channels);
    await session.start();
    channels.listWorkspaces.mockReturnValue(
      ok([
        { name: "Blog", articleCount: 3 },
        { name: "Notes", articleCount: 0 },
        { name: "Work", articleCount: 0 },
      ]),
    );

    const created = await session.createWorkspace("Notes");

    expect(created).toBe(true);
    expect(channels.createWorkspace).toHaveBeenCalledWith("Notes");
    expect(session.snapshot.workspaces.map(({ name }) => name)).toEqual(["Blog", "Notes", "Work"]);
    expect(session.snapshot.selectedWorkspace).toBe("Notes");
  });

  it("keeps the list and gives the reason when a name is rejected", async () => {
    const channels = vaultChannels();
    channels.createWorkspace.mockReturnValue(ok({ outcome: "rejected", reason: "alreadyUsed" }));
    const session = new VaultSession(channels);
    await session.start();

    const created = await session.createWorkspace("Blog");

    expect(created).toBe(false);
    expect(session.snapshot.creationRejection).toBe("alreadyUsed");
    expect(session.snapshot.workspaces.map(({ name }) => name)).toEqual(["Blog", "Work"]);
    expect(channels.listWorkspaces).toHaveBeenCalledTimes(1);
  });

  it("reports a workspace that could not be created and clears it on the next try", async () => {
    const channels = vaultChannels();
    channels.createWorkspace.mockReturnValueOnce(failed("disk full"));
    const session = new VaultSession(channels);

    expect(await session.createWorkspace("Notes")).toBe(false);
    expect(session.snapshot.creationFailure).toBe("disk full");

    await session.createWorkspace("Notes");
    expect(session.snapshot.creationFailure).toBeNull();
  });

  it("tells subscribers about every change until they unsubscribe", async () => {
    const session = new VaultSession(vaultChannels());
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    await session.selectWorkspace("Work");
    const notified = listener.mock.calls.length;
    unsubscribe();
    await session.selectWorkspace("Blog");

    expect(notified).toBeGreaterThan(0);
    expect(listener).toHaveBeenCalledTimes(notified);
  });

  describe("creating an article", () => {
    const DRAFT: ArticleDraft = { title: "Zen of Writing", status: "active", tags: ["electron"] };

    function blogAfterCreation() {
      const channels = vaultChannels();
      let created = false;
      channels.createArticle.mockImplementation((request: CreateArticleRequest) => {
        created = true;
        return ok({ ...article("zen-of-writing-2.md"), title: request.title });
      });
      channels.listArticles.mockImplementation((workspace: string) =>
        ok(
          created && workspace === "Blog"
            ? [...(ARTICLES.Blog ?? []), { ...article("zen-of-writing-2.md"), title: "Zen of Writing" }]
            : (ARTICLES[workspace] ?? []),
        ),
      );
      channels.listWorkspaces.mockImplementation(() =>
        ok([
          { name: "Blog", articleCount: created ? 4 : 3 },
          { name: "Work", articleCount: 0 },
        ]),
      );
      return channels;
    }

    it("asks for the article in the selected workspace", async () => {
      const channels = blogAfterCreation();
      const session = new VaultSession(channels);
      await session.start();

      const creation = await session.createArticle(DRAFT);

      expect(creation).toEqual({ outcome: "created" });
      expect(channels.createArticle).toHaveBeenCalledWith({ workspace: "Blog", ...DRAFT });
    });

    it("lists, selects and opens the new article and counts it in its workspace", async () => {
      const session = new VaultSession(blogAfterCreation());
      await session.start();

      await session.createArticle(DRAFT);

      const { articles, selectedArticle, body, workspaces } = session.snapshot;
      expect(articles.map(({ fileName }) => fileName)).toContain("zen-of-writing-2.md");
      expect(selectedArticle).toEqual(blog("zen-of-writing-2.md"));
      expect(body).toBe("zen-of-writing-2.md 的正文");
      expect(workspaces.find(({ name }) => name === "Blog")?.articleCount).toBe(4);
    });

    it("hands the new article to the holder with the keyboard and remembers it", async () => {
      const channels = blogAfterCreation();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();

      await session.createArticle(DRAFT);

      expect(holder.openArticle).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Zen of Writing", focusEditor: true }),
      );
      expect(channels.writeSettings).toHaveBeenLastCalledWith({
        ...STORED_SETTINGS,
        lastOpened: { workspace: "Blog", article: "zen-of-writing-2.md" },
      });
    });

    it("still counts as created when the open article cannot be left yet", async () => {
      const channels = blogAfterCreation();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      holder.openArticle.mockResolvedValue("blockedByUnansweredWarning");

      const creation = await session.createArticle(DRAFT);

      expect(creation).toEqual({ outcome: "created" });
      expect(session.snapshot.selectedArticle).toEqual(blog("zen-of-writing.md"));
      expect(session.snapshot.articles.map(({ fileName }) => fileName)).toContain("zen-of-writing-2.md");
    });

    it("still opens the new article when the refreshed list cannot be read", async () => {
      const channels = blogAfterCreation();
      const session = new VaultSession(channels);
      await session.start();
      channels.listArticles.mockImplementation(() => failed("permission denied"));

      await session.createArticle(DRAFT);

      expect(session.snapshot.selectedArticle).toEqual(blog("zen-of-writing-2.md"));
      expect(session.snapshot.body).toBe("zen-of-writing-2.md 的正文");
    });

    it("gives the reason when the article could not be created", async () => {
      const channels = vaultChannels();
      channels.createArticle.mockImplementation(() => failed("磁碟已滿"));
      const session = new VaultSession(channels);
      await session.start();

      const creation = await session.createArticle(DRAFT);

      expect(creation).toEqual({ outcome: "failed", reason: { kind: "reported", message: "磁碟已滿" } });
      expect(session.snapshot.selectedArticle).toEqual(blog("zen-of-writing.md"));
    });

    it("does not open the new article after another workspace was clicked meanwhile", async () => {
      const channels = blogAfterCreation();
      const session = new VaultSession(channels);
      await session.start();
      let finishCreating: () => void = () => undefined;
      channels.createArticle.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishCreating = () => resolve({ ok: true, payload: article("zen-of-writing-2.md") });
          }),
      );

      const creation = session.createArticle(DRAFT);
      await session.selectWorkspace("Work");
      finishCreating();

      expect(await creation).toEqual({ outcome: "created" });
      expect(session.snapshot.selectedWorkspace).toBe("Work");
      expect(session.snapshot.selectedArticle).toBeNull();
    });
  });

  describe("editing an article's metadata", () => {
    const EDIT: ArticleDraft = { title: "新標題", status: "active", tags: [] };

    function blogAfterEditing() {
      const channels = vaultChannels();
      let titles: Record<string, string> = {};
      channels.updateMetadata.mockImplementation((request: MetadataUpdateRequest) => {
        titles = { ...titles, [request.fileName]: request.title };
        return ok({ outcome: "updated", article: { ...article(request.fileName), title: request.title } });
      });
      channels.listArticles.mockImplementation((workspace: string) =>
        ok(
          (ARTICLES[workspace] ?? []).map((row) => ({
            ...row,
            title: titles[row.fileName] ?? row.title,
          })),
        ),
      );
      return channels;
    }

    it("saves and lets go of the open article before writing, then opens it again under its new title", async () => {
      const channels = blogAfterEditing();
      const holder = articleHolder();
      const steps: string[] = [];
      holder.closeArticle.mockImplementation(() => {
        steps.push("close");
        return Promise.resolve("switched");
      });
      const writeMetadata = channels.updateMetadata.getMockImplementation();
      channels.updateMetadata.mockImplementationOnce((request: MetadataUpdateRequest) => {
        steps.push("write");
        return writeMetadata?.(request) ?? failed("no write");
      });
      const session = new VaultSession(channels, holder);
      await session.start();
      holder.openArticle.mockClear();
      channels.readBody.mockImplementation((workspace: string, fileName: string) => {
        steps.push("read");
        return ok({ workspace, fileName, body: "正文", lastKnownModifiedAt: "2026-08-20T09:00:00.000Z" });
      });

      const edit = await session.updateMetadata(blog("zen-of-writing.md"), EDIT);

      expect(edit).toEqual({ outcome: "updated" });
      expect(steps).toEqual(["close", "write", "read"]);
      expect(channels.updateMetadata).toHaveBeenCalledWith({
        workspace: "Blog",
        fileName: "zen-of-writing.md",
        ...EDIT,
      });
      expect(holder.openArticle).toHaveBeenCalledTimes(1);
      expect(holder.openArticle).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "新標題",
          article: expect.objectContaining({
            fileName: "zen-of-writing.md",
            lastKnownModifiedAt: "2026-08-20T09:00:00.000Z",
          }),
        }),
      );
      expect(channels.readBody).toHaveBeenLastCalledWith("Blog", "zen-of-writing.md");
      expect(session.snapshot.selectedArticle).toEqual(blog("zen-of-writing.md"));
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
    });

    it("refreshes the row of an article that is not open and leaves the open one alone", async () => {
      const channels = blogAfterEditing();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      holder.openArticle.mockClear();

      await session.updateMetadata(blog("a.md"), EDIT);

      expect(holder.closeArticle).not.toHaveBeenCalled();
      expect(holder.openArticle).not.toHaveBeenCalled();
      expect(session.snapshot.articles.find(({ fileName }) => fileName === "a.md")?.title).toBe("新標題");
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
    });

    it.each([
      ["blockedByUnansweredWarning"],
      ["blockedByFailedSave"],
    ] as const)("writes nothing when the open article cannot be left (%s)", async (refusal) => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      holder.closeArticle.mockResolvedValue(refusal);

      const edit = await session.updateMetadata(blog("zen-of-writing.md"), EDIT);

      const reason = { kind: "leavingRefused", refusal };
      expect(edit).toEqual({ outcome: "failed", reason });
      expect(channels.updateMetadata).not.toHaveBeenCalled();
      expect(session.snapshot.operationFailure).toEqual({ operation: "updateMetadata", reason });
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
    });

    it("reports a file another program changed meanwhile and keeps the article open", async () => {
      const channels = vaultChannels();
      channels.updateMetadata.mockImplementation(() => ok({ outcome: "modifiedElsewhere" }));
      const session = new VaultSession(channels);
      await session.start();

      const edit = await session.updateMetadata(blog("zen-of-writing.md"), EDIT);

      expect(edit.outcome).toBe("failed");
      expect(session.snapshot.operationFailure?.operation).toBe("updateMetadata");
      expect(session.snapshot.operationFailure?.reason).toEqual({ kind: "modifiedElsewhere" });
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
    });

    it("reports the backend's reason and opens the article again", async () => {
      const channels = vaultChannels();
      channels.updateMetadata.mockImplementation(() => failed("磁碟已滿"));
      const session = new VaultSession(channels);
      await session.start();

      const edit = await session.updateMetadata(blog("zen-of-writing.md"), EDIT);

      expect(edit).toEqual({ outcome: "failed", reason: { kind: "reported", message: "磁碟已滿" } });
      expect(session.snapshot.operationFailure).toEqual({
        operation: "updateMetadata",
        reason: { kind: "reported", message: "磁碟已滿" },
      });
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
    });

  });

  describe("deleting an article", () => {
    it("saves and lets go of the open article first, then leaves nothing selected", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const steps: string[] = [];
      holder.closeArticle.mockImplementation(() => {
        steps.push("close");
        return Promise.resolve("switched");
      });
      channels.deleteArticle.mockImplementation(() => {
        steps.push("trash");
        return ok(null);
      });
      const session = new VaultSession(channels, holder);
      await session.start();

      await session.deleteArticle(blog("zen-of-writing.md"));

      expect(steps).toEqual(["close", "trash"]);
      expect(channels.deleteArticle).toHaveBeenCalledWith("Blog", "zen-of-writing.md");
      expect(session.snapshot.selectedArticle).toBeNull();
      expect(session.snapshot.openedDocument).toBeNull();
      expect(session.snapshot.body).toBeNull();
      expect(channels.writeSettings).toHaveBeenLastCalledWith({
        ...STORED_SETTINGS,
        lastOpened: { workspace: "Blog", article: null },
      });
    });

    it("leaves the open article alone when another one is deleted", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();

      await session.deleteArticle(blog("a.md"));

      expect(holder.closeArticle).not.toHaveBeenCalled();
      expect(session.snapshot.selectedArticle).toEqual(blog("zen-of-writing.md"));
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
    });

    it("lists both the articles and the workspaces again", async () => {
      const channels = vaultChannels();
      const session = new VaultSession(channels);
      await session.start();
      channels.listArticles.mockClear();
      channels.listWorkspaces.mockClear();

      await session.deleteArticle(blog("a.md"));

      expect(channels.listArticles).toHaveBeenCalledWith("Blog");
      expect(channels.listWorkspaces).toHaveBeenCalled();
    });

    it("says to try again after a failed save, and deletes on that second try", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      holder.closeArticle.mockResolvedValueOnce("blockedByFailedSave");

      await session.deleteArticle(blog("zen-of-writing.md"));

      expect(channels.deleteArticle).not.toHaveBeenCalled();
      expect(session.snapshot.operationFailure).toEqual({
        operation: "deleteArticle",
        reason: { kind: "leavingRefused", refusal: "blockedByFailedSave" },
      });

      await session.deleteArticle(blog("zen-of-writing.md"));

      expect(channels.deleteArticle).toHaveBeenCalledWith("Blog", "zen-of-writing.md");
      expect(session.snapshot.operationFailure).toBeNull();
    });

    it("deletes nothing when the open article cannot be left", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      holder.closeArticle.mockResolvedValue("blockedByUnansweredWarning");

      await session.deleteArticle(blog("zen-of-writing.md"));

      expect(channels.deleteArticle).not.toHaveBeenCalled();
      expect(session.snapshot.operationFailure).toEqual({
        operation: "deleteArticle",
        reason: { kind: "leavingRefused", refusal: "blockedByUnansweredWarning" },
      });
    });

    it("reports the trash's reason and opens the article again", async () => {
      const channels = vaultChannels();
      channels.deleteArticle.mockImplementation(() => failed("磁碟已滿"));
      const session = new VaultSession(channels);
      await session.start();

      await session.deleteArticle(blog("zen-of-writing.md"));

      expect(session.snapshot.operationFailure).toEqual({ operation: "deleteArticle", reason: { kind: "reported", message: "磁碟已滿" } });
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
    });

    it("clears the failure notice when the next operation succeeds", async () => {
      const channels = vaultChannels();
      channels.deleteArticle.mockImplementationOnce(() => failed("磁碟已滿"));
      const session = new VaultSession(channels);
      await session.start();
      await session.deleteArticle(blog("a.md"));

      await session.deleteArticle(blog("b.md"));

      expect(session.snapshot.operationFailure).toBeNull();
    });

  });

  describe("renaming a workspace", () => {
    it("saves and lets go of the open article first, then keeps the workspace selected under its new name", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const steps: string[] = [];
      holder.closeArticle.mockImplementation(() => {
        steps.push("close");
        return Promise.resolve("switched");
      });
      channels.renameWorkspace.mockImplementation((_workspace: string, newName: string) => {
        steps.push("rename");
        return ok({ outcome: "renamed", workspace: newName });
      });
      channels.listArticles.mockImplementation((workspace: string) =>
        ok(workspace === "Writing" ? (ARTICLES.Blog ?? []) : []),
      );
      const session = new VaultSession(channels, holder);
      await session.start();

      const renamed = await session.renameWorkspace("Blog", "Writing");

      expect(renamed).toBe(true);
      expect(steps.slice(0, 2)).toEqual(["close", "rename"]);
      expect(session.snapshot.selectedWorkspace).toBe("Writing");
      expect(session.snapshot.articles).toHaveLength(3);
      expect(session.snapshot.selectedArticle).toBeNull();
      expect(session.snapshot.openedDocument).toBeNull();
      expect(channels.writeSettings).toHaveBeenLastCalledWith({
        ...STORED_SETTINGS,
        lastOpened: { workspace: "Writing", article: null },
      });
    });

    it("keeps the selection when another workspace is renamed", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();

      await session.renameWorkspace("Work", "Job");

      expect(holder.closeArticle).not.toHaveBeenCalled();
      expect(session.snapshot.selectedWorkspace).toBe("Blog");
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
      expect(channels.listWorkspaces).toHaveBeenCalledTimes(2);
    });

    it("keeps the rejection for the field and opens the left article again", async () => {
      const channels = vaultChannels();
      channels.renameWorkspace.mockImplementation(() => ok({ outcome: "rejected", reason: "alreadyUsed" }));
      const session = new VaultSession(channels);
      await session.start();

      const renamed = await session.renameWorkspace("Blog", "work");

      expect(renamed).toBe(false);
      expect(session.snapshot.renameRejection).toEqual({ workspace: "Blog", reason: "alreadyUsed" });
      expect(session.snapshot.selectedWorkspace).toBe("Blog");
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
    });

    it("renames nothing when the open article cannot be left", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      holder.closeArticle.mockResolvedValue("blockedByUnansweredWarning");

      const renamed = await session.renameWorkspace("Blog", "Writing");

      expect(renamed).toBe(false);
      expect(channels.renameWorkspace).not.toHaveBeenCalled();
      expect(session.snapshot.operationFailure).toEqual({
        operation: "renameWorkspace",
        reason: { kind: "leavingRefused", refusal: "blockedByUnansweredWarning" },
      });
    });

    it("reports the backend's reason", async () => {
      const channels = vaultChannels();
      channels.renameWorkspace.mockImplementation(() => failed("磁碟已滿"));
      const session = new VaultSession(channels);
      await session.start();

      expect(await session.renameWorkspace("Work", "Job")).toBe(false);
      expect(session.snapshot.operationFailure).toEqual({ operation: "renameWorkspace", reason: { kind: "reported", message: "磁碟已滿" } });
    });
  });

  describe("deleting a workspace", () => {
    it("counts what deleting a workspace would take", async () => {
      const channels = vaultChannels();
      const session = new VaultSession(channels);

      expect(await session.countWorkspaceContents("Blog")).toEqual({ articleCount: 3, imageCount: 2 });
      expect(channels.countWorkspaceContents).toHaveBeenCalledWith("Blog");
    });

    it("reports a workspace that cannot be counted instead of answering a number", async () => {
      const channels = vaultChannels();
      channels.countWorkspaceContents.mockImplementation(() => failed("permission denied"));
      const session = new VaultSession(channels);

      expect(await session.countWorkspaceContents("Blog")).toBeNull();
      expect(session.snapshot.operationFailure).toEqual({
        operation: "deleteWorkspace",
        reason: { kind: "reported", message: "permission denied" },
      });
    });

    it("saves and lets go of the open article first, then selects nothing", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const steps: string[] = [];
      holder.closeArticle.mockImplementation(() => {
        steps.push("close");
        return Promise.resolve("switched");
      });
      channels.deleteWorkspace.mockImplementation(() => {
        steps.push("trash");
        return ok({ articleCount: 3, imageCount: 2 });
      });
      const session = new VaultSession(channels, holder);
      await session.start();

      await session.deleteWorkspace("Blog");

      expect(steps).toEqual(["close", "trash"]);
      expect(session.snapshot.selectedWorkspace).toBeNull();
      expect(session.snapshot.articles).toEqual([]);
      expect(session.snapshot.selectedArticle).toBeNull();
      expect(session.snapshot.openedDocument).toBeNull();
      expect(channels.writeSettings).toHaveBeenLastCalledWith({
        ...STORED_SETTINGS,
        lastOpened: { workspace: null, article: null },
      });
    });

    it("still opens an article clicked just before another workspace is deleted", async () => {
      const channels = vaultChannels();
      const session = new VaultSession(channels);
      await session.start();
      let finishReading: () => void = () => undefined;
      channels.readBody.mockImplementation(
        (workspace: string, fileName: string) =>
          new Promise((resolve) => {
            finishReading = () =>
              resolve({
                ok: true,
                payload: { workspace, fileName, body: "a 的正文", lastKnownModifiedAt: "2026-08-20T08:04:11.123Z" },
              });
          }),
      );

      const click = session.selectArticle(blog("a.md"));
      await session.deleteWorkspace("Work");
      finishReading();
      await click;

      expect(session.snapshot.selectedWorkspace).toBe("Blog");
      expect(session.snapshot.openedDocument).toBe("Blog/a.md");
    });

    it("keeps the selection and lists the workspaces again when another one is deleted", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      channels.listWorkspaces.mockClear();

      await session.deleteWorkspace("Work");

      expect(holder.closeArticle).not.toHaveBeenCalled();
      expect(session.snapshot.selectedWorkspace).toBe("Blog");
      expect(channels.listWorkspaces).toHaveBeenCalled();
    });

    it.each([
      ["blockedByUnansweredWarning"],
      ["blockedByFailedSave"],
    ] as const)("deletes nothing when the open article cannot be left (%s)", async (refusal) => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      holder.closeArticle.mockResolvedValue(refusal);

      await session.deleteWorkspace("Blog");

      expect(channels.deleteWorkspace).not.toHaveBeenCalled();
      expect(session.snapshot.operationFailure).toEqual({
        operation: "deleteWorkspace",
        reason: { kind: "leavingRefused", refusal },
      });
    });

    it("reports the trash's reason and opens the left article again", async () => {
      const channels = vaultChannels();
      channels.deleteWorkspace.mockImplementation(() => failed("磁碟已滿"));
      const session = new VaultSession(channels);
      await session.start();

      await session.deleteWorkspace("Blog");

      expect(session.snapshot.operationFailure).toEqual({ operation: "deleteWorkspace", reason: { kind: "reported", message: "磁碟已滿" } });
      expect(session.snapshot.selectedWorkspace).toBe("Blog");
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
    });
  });

  describe("the operation failure notice", () => {
    it("records a failed article creation as such, not as a list that cannot be read", async () => {
      const channels = vaultChannels();
      channels.createArticle.mockImplementation(() => failed("'Blog/zen.md' already exists"));
      const session = new VaultSession(channels);
      await session.start();

      await session.createArticle({ title: "Zen", status: null, tags: [] });

      expect(session.snapshot.operationFailure).toEqual({
        operation: "createArticle",
        reason: { kind: "reported", message: "'Blog/zen.md' already exists" },
      });
      expect(session.snapshot.articleListFailure).toBeNull();
    });

    it("can be dismissed", async () => {
      const channels = vaultChannels();
      channels.deleteArticle.mockImplementation(() => failed("磁碟已滿"));
      const session = new VaultSession(channels);
      await session.start();
      await session.deleteArticle(blog("a.md"));

      session.dismissOperationFailure();

      expect(session.snapshot.operationFailure).toBeNull();
    });
  });

  describe("the sidebar filter and All Notes", () => {
    const WORK_ZEN = article("zen-of-writing.md", "Work");

    function channelsWithWork() {
      const channels = vaultChannels();
      channels.listArticles.mockImplementation((workspace: string) =>
        ok(workspace === "Work" ? [WORK_ZEN] : (ARTICLES[workspace] ?? [])),
      );
      channels.listAllArticles.mockImplementation(() => ok([...(ARTICLES.Blog ?? []), WORK_ZEN]));
      return channels;
    }

    it("chooses one status at a time and lets it go when chosen again", async () => {
      const session = new VaultSession(vaultChannels());
      await session.start();

      session.toggleStatusFilter("active");
      session.toggleStatusFilter("completed");
      expect(session.snapshot.sidebarFilter.status).toBe("completed");

      session.toggleStatusFilter("completed");
      expect(session.snapshot.sidebarFilter.status).toBeNull();
    });

    it("chooses several tags and drops one chosen again, without asking the backend anything", async () => {
      const channels = vaultChannels();
      const session = new VaultSession(channels);
      await session.start();
      const callsBefore = channels.listArticles.mock.calls.length;

      session.toggleTagFilter("work");
      session.toggleTagFilter("bug");
      session.toggleTagFilter("bug");

      expect(session.snapshot.sidebarFilter.tags).toEqual(["work"]);
      expect(channels.listArticles).toHaveBeenCalledTimes(callsBefore);
      expect(session.snapshot.openedDocument).toBe("Blog/zen-of-writing.md");
    });

    it("lists every workspace's articles under All Notes, which is no workspace", async () => {
      const channels = channelsWithWork();
      const session = new VaultSession(channels);
      await session.start();

      await session.selectAllNotes();

      expect(session.snapshot.showsAllNotes).toBe(true);
      expect(session.snapshot.selectedWorkspace).toBeNull();
      expect(session.snapshot.articles.map(({ workspace, fileName }) => `${workspace}/${fileName}`)).toEqual([
        "Blog/a.md",
        "Blog/b.md",
        "Blog/zen-of-writing.md",
        "Work/zen-of-writing.md",
      ]);
      expect(session.snapshot.openedDocument).toBeNull();
    });

    it("lets go of a chosen tag once an edit removes it from the last article that carried it", async () => {
      const channels = vaultChannels();
      let tags: readonly string[] = ["work"];
      channels.listArticles.mockImplementation(() => ok([{ ...article("a.md"), tags: [...tags] }]));
      channels.updateMetadata.mockImplementation((request: MetadataUpdateRequest) => {
        tags = request.tags;
        return ok({ outcome: "updated", article: { ...article(request.fileName), tags: [...tags] } });
      });
      const session = new VaultSession(channels);
      await session.start();
      session.toggleStatusFilter("noStatus");
      session.toggleTagFilter("work");

      await session.updateMetadata(blog("a.md"), { title: "a", status: null, tags: [] });

      expect(session.snapshot.sidebarFilter.tags).toEqual([]);
      expect(session.snapshot.sidebarFilter.status).toBe("noStatus");
    });

    it("lets go of a chosen tag once the last article that carried it is deleted", async () => {
      const channels = vaultChannels();
      let articles = [{ ...article("a.md"), tags: ["work"] }, article("b.md")];
      channels.listArticles.mockImplementation(() => ok(articles));
      channels.deleteArticle.mockImplementation(() => {
        articles = [article("b.md")];
        return ok(null);
      });
      const session = new VaultSession(channels);
      await session.start();
      session.toggleTagFilter("work");

      await session.deleteArticle(blog("a.md"));

      expect(session.snapshot.sidebarFilter.tags).toEqual([]);
    });

    it("clears the sidebar filter when All Notes is chosen and when a workspace is chosen", async () => {
      const session = new VaultSession(channelsWithWork());
      await session.start();
      session.toggleTagFilter("work");

      await session.selectAllNotes();
      expect(session.snapshot.sidebarFilter.tags).toEqual([]);

      session.toggleStatusFilter("active");
      await session.selectWorkspace("Blog");

      expect(session.snapshot.sidebarFilter.status).toBeNull();
      expect(session.snapshot.showsAllNotes).toBe(false);
      expect(session.snapshot.selectedWorkspace).toBe("Blog");
      expect(session.snapshot.articles).toHaveLength(3);
    });

    it("opens an article of another workspace from All Notes and remembers it with its workspace", async () => {
      const channels = channelsWithWork();
      const session = new VaultSession(channels);
      await session.start();
      await session.selectAllNotes();

      await session.selectArticle({ workspace: "Work", fileName: "zen-of-writing.md" });

      expect(channels.readBody).toHaveBeenLastCalledWith("Work", "zen-of-writing.md");
      expect(session.snapshot.openedDocument).toBe("Work/zen-of-writing.md");
      expect(session.snapshot.selectedArticle).toEqual({ workspace: "Work", fileName: "zen-of-writing.md" });
      expect(channels.writeSettings).toHaveBeenLastCalledWith({
        ...STORED_SETTINGS,
        lastOpened: { workspace: "Work", article: "zen-of-writing.md" },
      });
    });

    it("does not remember All Notes itself", async () => {
      const channels = channelsWithWork();
      const session = new VaultSession(channels);
      await session.start();
      const writes = channels.writeSettings.mock.calls.length;

      await session.selectAllNotes();

      expect(channels.writeSettings).toHaveBeenCalledTimes(writes);
    });

    it("refuses to create an article under All Notes and asks for a workspace first", async () => {
      const channels = channelsWithWork();
      const session = new VaultSession(channels);
      await session.start();
      await session.selectAllNotes();

      const creation = await session.createArticle({ title: "Zen", status: null, tags: [] });

      expect(creation).toEqual({ outcome: "failed", reason: { kind: "noWorkspaceSelected" } });
      expect(channels.createArticle).not.toHaveBeenCalled();
    });

    it("edits an article under All Notes in its own workspace and lists every workspace again", async () => {
      const channels = channelsWithWork();
      const session = new VaultSession(channels);
      await session.start();
      await session.selectAllNotes();
      const listedBefore = channels.listAllArticles.mock.calls.length;

      const edit = await session.updateMetadata(WORK_ZEN, { title: "新標題", status: "active", tags: [] });

      expect(edit).toEqual({ outcome: "updated" });
      expect(channels.updateMetadata).toHaveBeenCalledWith({
        workspace: "Work",
        fileName: "zen-of-writing.md",
        title: "新標題",
        status: "active",
        tags: [],
      });
      expect(channels.listAllArticles).toHaveBeenCalledTimes(listedBefore + 1);
    });

    it("deletes an article under All Notes from its own workspace", async () => {
      const channels = channelsWithWork();
      const session = new VaultSession(channels);
      await session.start();
      await session.selectAllNotes();

      await session.deleteArticle(WORK_ZEN);

      expect(channels.deleteArticle).toHaveBeenCalledWith("Work", "zen-of-writing.md");
      expect(session.snapshot.showsAllNotes).toBe(true);
    });

    it("lets go of an article open under All Notes when its workspace is deleted", async () => {
      const channels = channelsWithWork();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      await session.selectAllNotes();
      await session.selectArticle(WORK_ZEN);
      holder.closeArticle.mockClear();

      await session.deleteWorkspace("Work");

      expect(holder.closeArticle).toHaveBeenCalledTimes(1);
      expect(session.snapshot.selectedArticle).toBeNull();
      expect(session.snapshot.openedDocument).toBeNull();
      expect(session.snapshot.showsAllNotes).toBe(true);
    });

    it("lets go of an article open under All Notes when its workspace is renamed, and lists the vault again", async () => {
      const channels = channelsWithWork();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      await session.selectAllNotes();
      await session.selectArticle(WORK_ZEN);
      const listedBefore = channels.listAllArticles.mock.calls.length;

      const renamed = await session.renameWorkspace("Work", "Office");

      expect(renamed).toBe(true);
      expect(session.snapshot.selectedArticle).toBeNull();
      expect(session.snapshot.showsAllNotes).toBe(true);
      expect(channels.listAllArticles).toHaveBeenCalledTimes(listedBefore + 1);
      expect(channels.writeSettings).toHaveBeenLastCalledWith({
        ...STORED_SETTINGS,
        lastOpened: { workspace: "Office", article: null },
      });
    });

    it("keeps an article open under All Notes when another workspace is renamed", async () => {
      const channels = channelsWithWork();
      const session = new VaultSession(channels);
      await session.start();
      await session.selectAllNotes();
      await session.selectArticle(WORK_ZEN);

      await session.renameWorkspace("Blog", "Writing");

      expect(session.snapshot.openedDocument).toBe("Work/zen-of-writing.md");
    });
  });

  describe("going to a scope from the workspace finder", () => {
    function dated(fileName: string, workspace: string, createdAt: string): ArticleSummary {
      return { ...article(fileName, workspace), createdAt };
    }

    const WORK = [
      dated("older.md", "Work", "2026-09-01T09:00:00+08:00"),
      dated("standup.md", "Work", "2026-09-07T22:00:00+08:00"),
      dated("oldest.md", "Work", "2026-08-01T09:00:00+08:00"),
    ];
    const DIARY = [dated("tired.md", "Diary", "2026-09-06T21:00:00+08:00")];

    function goingChannels() {
      const channels = vaultChannels(settingsWith({ workspace: null, article: null }));
      const lists: Record<string, ArticleSummary[]> = { Work: WORK, Diary: DIARY, Recipes: [] };
      channels.listArticles.mockImplementation((workspace: string) => ok(lists[workspace] ?? []));
      channels.listAllArticles.mockImplementation(() => ok([...DIARY, ...WORK]));
      return channels;
    }

    it("selects the workspace and opens its newest article without taking the keyboard", async () => {
      const channels = goingChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();

      await session.goToWorkspace("Work", "createdNewestFirst");

      expect(session.snapshot.selectedWorkspace).toBe("Work");
      expect(session.snapshot.articles).toEqual(WORK);
      expect(session.snapshot.selectedArticle).toEqual({ workspace: "Work", fileName: "standup.md" });
      expect(session.snapshot.openedDocument).toBe("Work/standup.md");
      expect(holder.openArticle).toHaveBeenLastCalledWith(
        expect.objectContaining({ focusEditor: false }),
      );
    });

    it("opens the article the list shows first in the order it is given", async () => {
      const session = new VaultSession(goingChannels());
      await session.start();

      await session.goToWorkspace("Work", "title");

      expect(session.snapshot.selectedArticle).toEqual({ workspace: "Work", fileName: "older.md" });
    });

    it("remembers the workspace and the article it opened", async () => {
      const channels = goingChannels();
      const session = new VaultSession(channels);
      await session.start();

      await session.goToWorkspace("Work", "createdNewestFirst");

      expect(channels.writeSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({ lastOpened: { workspace: "Work", article: "standup.md" } }),
      );
    });

    it("leaves the editor empty in a workspace without articles", async () => {
      const session = new VaultSession(goingChannels());
      await session.start();
      await session.goToWorkspace("Work", "createdNewestFirst");

      await session.goToWorkspace("Recipes", "createdNewestFirst");

      expect(session.snapshot.selectedWorkspace).toBe("Recipes");
      expect(session.snapshot.selectedArticle).toBeNull();
      expect(session.snapshot.openedDocument).toBeNull();
    });

    it("still selects the workspace and leaves the editor empty when the newest article cannot be read", async () => {
      const channels = goingChannels();
      channels.readBody.mockImplementation(() => failed("No such file or directory"));
      const session = new VaultSession(channels);
      await session.start();

      await session.goToWorkspace("Work", "createdNewestFirst");

      expect(session.snapshot.selectedWorkspace).toBe("Work");
      expect(session.snapshot.selectedArticle).toBeNull();
      expect(session.snapshot.openedDocument).toBeNull();
      expect(session.snapshot.bodyFailure).toBeNull();
      expect(channels.writeSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({ lastOpened: { workspace: "Work", article: null } }),
      );
    });

    it("goes to All Notes and opens the newest article of the whole vault", async () => {
      const session = new VaultSession(goingChannels());
      await session.start();
      await session.goToWorkspace("Diary", "createdNewestFirst");

      await session.goToAllNotes("createdNewestFirst");

      expect(session.snapshot.showsAllNotes).toBe(true);
      expect(session.snapshot.selectedWorkspace).toBeNull();
      expect(session.snapshot.articles).toHaveLength(4);
      expect(session.snapshot.openedDocument).toBe("Work/standup.md");
    });

    it("stays where it is when the open article may not be left", async () => {
      const holder = articleHolder();
      const session = new VaultSession(goingChannels(), holder);
      await session.start();
      await session.goToWorkspace("Diary", "createdNewestFirst");
      holder.closeArticle.mockResolvedValueOnce("blockedByFailedSave");

      await session.goToWorkspace("Work", "createdNewestFirst");

      expect(session.snapshot.selectedWorkspace).toBe("Diary");
      expect(session.snapshot.openedDocument).toBe("Diary/tired.md");
    });

    it("leaves a click on the sidebar only looking: the editor stays empty", async () => {
      const session = new VaultSession(goingChannels());
      await session.start();

      await session.selectWorkspace("Work");

      expect(session.snapshot.selectedArticle).toBeNull();
      expect(session.snapshot.openedDocument).toBeNull();
    });
  });

  describe("opening a found article", () => {
    it("opens the article with the keyboard and the cursor on the found line", async () => {
      const holder = articleHolder();
      const session = new VaultSession(vaultChannels(), holder);
      await session.start();

      await session.openFoundArticle(blog("a.md"), 7);

      expect(session.snapshot.openedDocument).toBe("Blog/a.md");
      expect(holder.openArticle).toHaveBeenLastCalledWith(
        expect.objectContaining({ focusEditor: true, cursorLine: 7 }),
      );
    });

    it("opens an article found by its title with the keyboard and no line", async () => {
      const holder = articleHolder();
      const session = new VaultSession(vaultChannels(), holder);
      await session.start();

      await session.openFoundArticle(blog("b.md"));

      expect(session.snapshot.openedDocument).toBe("Blog/b.md");
      expect(holder.openArticle).toHaveBeenLastCalledWith(
        expect.objectContaining({ focusEditor: true, cursorLine: undefined }),
      );
    });

    it("only moves the cursor when the found line is in the open article", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      channels.readBody.mockClear();

      await session.openFoundArticle(blog("zen-of-writing.md"), 12);

      expect(holder.placeCursor).toHaveBeenCalledWith(12);
      expect(channels.readBody).not.toHaveBeenCalled();
    });

    it("does nothing when the found title is the open article", async () => {
      const channels = vaultChannels();
      const holder = articleHolder();
      const session = new VaultSession(channels, holder);
      await session.start();
      channels.readBody.mockClear();

      await session.openFoundArticle(blog("zen-of-writing.md"));

      expect(holder.placeCursor).not.toHaveBeenCalled();
      expect(channels.readBody).not.toHaveBeenCalled();
    });
  });
});
