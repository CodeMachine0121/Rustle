import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  Channel: class {
    onmessage: (message: null) => void = () => undefined;
  },
}));

const BODIES: Record<string, string> = {
  "zen-of-writing.md": "正文的第一行。",
  "tauri.md": "最近在選桌面框架。",
};

function answerFromAVault(lastOpened: { workspace: string | null; article: string | null }) {
  vi.mocked(invoke).mockImplementation((command, args) => {
    const request = (args ?? {}) as Record<string, string>;
    switch (command) {
      case "read_settings":
        return Promise.resolve({
          indentation: { style: "spaces", width: 2 },
          previewPanel: { isOpen: true, widthRatio: 0.5 },
          lastOpened,
        });
      case "list_workspaces":
        return Promise.resolve([
          { name: "Blog", articleCount: 2 },
          { name: "Empty", articleCount: 0 },
          { name: "Work", articleCount: 1 },
        ]);
      case "list_articles":
        return Promise.resolve(
          request.workspace === "Blog"
            ? [
                { fileName: "tauri.md", title: "Tauri 與 Electron", createdAt: "2026-08-20", category: [], tags: [], hasIncompleteMetadata: false },
                { fileName: "zen-of-writing.md", title: "Zen of Writing", createdAt: "2026-08-18", category: [], tags: [], hasIncompleteMetadata: false },
              ]
            : request.workspace === "Work"
              ? [{ fileName: "q3.md", title: "Q3 回顧", createdAt: "", category: [], tags: [], hasIncompleteMetadata: false }]
              : [],
        );
      case "read_body":
        return Promise.resolve({
          workspace: request.workspace,
          fileName: request.fileName,
          body: BODIES[request.fileName ?? ""] ?? "",
          lastKnownModifiedAt: "2026-08-20T08:04:11.123Z",
        });
      case "save_body":
        return Promise.resolve({
          outcome: "saved",
          updatedAt: "2026-08-20T08:05:00.000Z",
          lastKnownModifiedAt: "2026-08-20T08:05:00.100Z",
        });
      case "write_settings":
      case "watch_close_requests":
        return Promise.resolve(null);
      default:
        return Promise.reject({ reason: "unknownChannel", message: String(command) });
    }
  });
}

const CREATED_ARTICLE = {
  fileName: "new-article.md",
  title: "New Article",
  createdAt: "2026-08-20T14:32:05+08:00",
  category: [],
  tags: [],
  hasIncompleteMetadata: false,
};

function answerFromAVaultThatCreatesArticles() {
  answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
  const answerFromTheVault = vi.mocked(invoke).getMockImplementation();
  let created = false;
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "create_article") {
      created = true;
      return CREATED_ARTICLE;
    }
    const answer = await answerFromTheVault?.(command, args);
    if (created && command === "list_articles") {
      return [...(answer as unknown[]), CREATED_ARTICLE];
    }
    if (created && command === "list_workspaces") {
      return (answer as { name: string; articleCount: number }[]).map((workspace) =>
        workspace.name === "Blog" ? { ...workspace, articleCount: 3 } : workspace,
      );
    }
    return answer;
  });
}

function editorContent(): HTMLElement | null {
  const content = document.querySelector(".cm-content");
  return content instanceof HTMLElement ? content : null;
}

describe("App", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(invoke).mockReset();
  });

  it("opens where the user left off", async () => {
    answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });

    render(<App />);

    await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
    expect(screen.getByRole("button", { name: /^Blog/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Zen of Writing/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("starts with nothing to type in when nothing was opened before", async () => {
    answerFromAVault({ workspace: null, article: null });

    render(<App />);

    await screen.findByRole("button", { name: /^Blog/ });
    expect(screen.getByText("選一篇文章開始寫作")).toBeInTheDocument();
    expect(editorContent()).toBeNull();
  });

  it("loads an article into the same editor and clears it when another workspace is picked", async () => {
    answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
    render(<App />);
    await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
    const firstEditor = editorContent();

    fireEvent.click(screen.getByRole("button", { name: /Tauri 與 Electron/ }));
    await waitFor(() => expect(editorContent()).toHaveTextContent("最近在選桌面框架。"));
    expect(editorContent()).toBe(firstEditor);

    fireEvent.click(screen.getByRole("button", { name: /^Work/ }));
    await screen.findByRole("button", { name: /Q3 回顧/ });
    expect(screen.queryByRole("button", { name: /Zen of Writing/ })).not.toBeInTheDocument();
    expect(editorContent()).toBeNull();
    expect(screen.getByRole("button", { name: /^Work/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Blog/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the first-article invitation for a workspace without articles", async () => {
    answerFromAVault({ workspace: null, article: null });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^Empty/ }));

    expect(await screen.findByText("建立第一篇文章")).toBeInTheDocument();
  });

  it("moves the article selection to the one clicked last", async () => {
    answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
    render(<App />);
    await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));

    fireEvent.click(screen.getByRole("button", { name: /Tauri 與 Electron/ }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Tauri 與 Electron/ })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByRole("button", { name: /Zen of Writing/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("remembers the article the user opened", async () => {
    answerFromAVault({ workspace: null, article: null });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^Blog/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Zen of Writing/ }));

    await waitFor(() =>
      expect(invoke).toHaveBeenLastCalledWith("write_settings", {
        settings: expect.objectContaining({
          lastOpened: { workspace: "Blog", article: "zen-of-writing.md" },
        }),
      }),
    );
  });

  it("orders what Tab reaches column by column", async () => {
    answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
    render(<App />);
    await waitFor(() => expect(editorContent()).not.toBeNull());

    const regions = screen.getAllByRole("region");
    const focusable = regions.map(
      (region) => within(region).queryAllByRole("textbox").length + within(region).queryAllByRole("button").length,
    );
    const order = [...document.querySelectorAll("input, button, [contenteditable='true']")].map(
      (element) => regions.findIndex((region) => region.contains(element)),
    );

    expect(focusable.every((count) => count > 0)).toBe(true);
    expect(order).toEqual([...order].sort((left, right) => left - right));
    expect(document.querySelector("input")).toHaveAccessibleName("新 workspace 名稱");
  });

  it("says in one line that the vault could not be read and stays usable", async () => {
    vi.mocked(invoke).mockImplementation((command) =>
      command === "list_workspaces"
        ? Promise.reject({ reason: "unexpected", message: "permission denied" })
        : Promise.resolve({
            indentation: { style: "spaces", width: 2 },
            previewPanel: { isOpen: true, widthRatio: 0.5 },
            lastOpened: { workspace: null, article: null },
          }),
    );

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("讀不到 workspace");
    expect(screen.getByRole("textbox", { name: "新 workspace 名稱" })).toBeEnabled();
  });

  it("saves what is typed into the open article and says so in its title bar", async () => {
    answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
    render(<App />);
    await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
    expect(screen.getByRole("banner")).toHaveTextContent("Zen of Writing");

    const content = editorContent();
    if (content === null) {
      throw new Error("the editor did not render its content area");
    }
    fireEvent.keyDown(content, { key: "Tab" });

    expect(screen.getByText("未儲存的變更")).toBeInTheDocument();
    await waitFor(
      () =>
        expect(invoke).toHaveBeenCalledWith("save_body", {
          workspace: "Blog",
          fileName: "zen-of-writing.md",
          body: "  正文的第一行。",
          lastKnownModifiedAt: "2026-08-20T08:04:11.123Z",
          overwrite: false,
        }),
      { timeout: 2000 },
    );
    expect(await screen.findByText("已儲存")).toBeInTheDocument();
  });

  it("keeps the article open while its changes cannot be saved", async () => {
    answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
    const answer = vi.mocked(invoke).getMockImplementation();
    vi.mocked(invoke).mockImplementation((command, args, options) =>
      command === "save_body"
        ? Promise.reject({ reason: "unexpected", message: "No space left on device" })
        : (answer?.(command, args, options) ?? Promise.resolve(null)),
    );
    render(<App />);
    await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
    const content = editorContent();
    if (content === null) {
      throw new Error("the editor did not render its content area");
    }
    fireEvent.keyDown(content, { key: "Tab" });

    fireEvent.click(screen.getByRole("button", { name: /Tauri 與 Electron/ }));

    expect(await screen.findByText("儲存失敗：No space left on device")).toBeInTheDocument();
    expect(editorContent()).toHaveTextContent("正文的第一行。");
    expect(screen.getByRole("button", { name: /Zen of Writing/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("starts watching window close requests", () => {
    answerFromAVault({ workspace: null, article: null });

    render(<App />);

    expect(invoke).toHaveBeenCalledWith("watch_close_requests", expect.anything());
  });

  it("creates an article from the dialog and leaves the cursor in the editor", async () => {
    answerFromAVaultThatCreatesArticles();
    render(<App />);
    await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "＋ 新文章" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "New Article" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "建立" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith("create_article", {
      workspace: "Blog",
      title: "New Article",
      category: [],
      tags: [],
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /New Article/ })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByLabelText("3 篇文章")).toBeInTheDocument();
    await waitFor(() => expect(editorContent()).toHaveFocus());
    expect(editorContent()?.textContent).toBe("");
  });

  it("closes the dialog on Esc without creating anything", async () => {
    answerFromAVaultThatCreatesArticles();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "＋ 新文章" }));

    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("create_article", expect.anything());
  });
});
