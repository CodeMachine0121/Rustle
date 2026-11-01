import { describe, expect, it, vi } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import type { ChannelResult } from "../../ipc/channelResult";
import type { CreateWorkspaceOutcome } from "../../ipc/createWorkspaceOutcome";
import type { Settings } from "../../ipc/settings";
import { VaultSession, type VaultChannels } from "./VaultSession";

function ok<Payload>(payload: Payload): Promise<ChannelResult<Payload>> {
  return Promise.resolve({ ok: true, payload });
}

function failed(message: string): Promise<ChannelResult<never>> {
  return Promise.resolve({ ok: false, reason: "unexpected", message });
}

function article(fileName: string): ArticleSummary {
  return {
    fileName,
    title: fileName.replace(/\.md$/, ""),
    createdAt: "",
    category: [],
    tags: [],
    hasIncompleteMetadata: true,
  };
}

const STORED_SETTINGS: Settings = {
  indentation: { style: "tab", width: 4 },
  previewPanel: { isOpen: false, widthRatio: 0.3 },
  lastOpened: { workspace: "Blog", article: "zen-of-writing.md" },
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
    readBody: vi.fn((workspace: string, fileName: string) =>
      ok({ workspace, fileName, body: `${fileName} 的正文`, lastKnownModifiedAt: "2026-08-20T08:04:11.123Z" }),
    ),
    createWorkspace: vi.fn(
      (name: string): Promise<ChannelResult<CreateWorkspaceOutcome>> =>
        ok({ outcome: "created", workspace: { name, articleCount: 0 } }),
    ),
  } satisfies VaultChannels;
}

function settingsWith(lastOpened: Settings["lastOpened"]): Settings {
  return { ...STORED_SETTINGS, lastOpened };
}

describe("VaultSession", () => {
  it("restores the workspace and article opened last time", async () => {
    const session = new VaultSession(vaultChannels());

    await session.start();

    expect(session.snapshot.selectedWorkspace).toBe("Blog");
    expect(session.snapshot.selectedArticle).toBe("zen-of-writing.md");
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

    await session.selectArticle("b.md");

    expect(session.snapshot.selectedArticle).toBe("b.md");
    expect(session.snapshot.body).toBe("b.md 的正文");
  });

  it("reports a body that cannot be read", async () => {
    const channels = vaultChannels();
    channels.readBody.mockReturnValue(failed("not text"));
    const session = new VaultSession(channels);
    await session.selectWorkspace("Blog");

    await session.selectArticle("b.md");

    expect(session.snapshot.body).toBeNull();
    expect(session.snapshot.bodyFailure).toBe("not text");
  });

  it("ignores an article selected while no workspace is", async () => {
    const channels = vaultChannels();
    const session = new VaultSession(channels);

    await session.selectArticle("a.md");

    expect(channels.readBody).not.toHaveBeenCalled();
  });

  it("remembers each selection and keeps the other settings it read", async () => {
    const channels = vaultChannels();
    const session = new VaultSession(channels);
    await session.start();

    await session.selectWorkspace("Blog");
    await session.selectArticle("a.md");

    expect(channels.writeSettings).toHaveBeenNthCalledWith(1, settingsWith({ workspace: "Blog", article: null }));
    expect(channels.writeSettings).toHaveBeenLastCalledWith(settingsWith({ workspace: "Blog", article: "a.md" }));
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

    const slow = session.selectArticle("a.md");
    await session.selectArticle("b.md");
    answerSlowRead();
    await slow;

    expect(session.snapshot.selectedArticle).toBe("b.md");
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
});
