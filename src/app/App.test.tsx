// @vitest-environment jsdom
import { undo } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  "q3.md": "# Q3 回顧",
  "tauri.md": "最近在選桌面框架。",
};

type StoredPreviewPanel = { isOpen: boolean; widthRatio: number; toggleShortcut?: string };

function answerFromAVault(
  lastOpened: { workspace: string | null; article: string | null },
  previewPanel: StoredPreviewPanel = { isOpen: true, widthRatio: 0.5 },
) {
  vi.mocked(invoke).mockImplementation((command, args) => {
    const request = (args ?? {}) as Record<string, string>;
    switch (command) {
      case "read_settings":
        return Promise.resolve({
          indentation: { style: "spaces", width: 2 },
          previewPanel,
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
  updatedAt: "2026-08-20T14:32:05+08:00",
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
    expect(screen.getByRole("button", { name: /^Zen of Writing/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("starts with nothing to type in when nothing was opened before", async () => {
    answerFromAVault({ workspace: null, article: null });

    render(<App />);

    await screen.findByRole("button", { name: /^Blog/ });
    expect(within(screen.getByRole("region", { name: "EDITOR" })).getByText("選一篇文章開始寫作")).toBeInTheDocument();
    expect(editorContent()).toBeNull();
  });

  it("loads an article into the same editor and clears it when another workspace is picked", async () => {
    answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
    render(<App />);
    await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
    const firstEditor = editorContent();

    fireEvent.click(screen.getByRole("button", { name: /^Tauri 與 Electron/ }));
    await waitFor(() => expect(editorContent()).toHaveTextContent("最近在選桌面框架。"));
    expect(editorContent()).toBe(firstEditor);

    fireEvent.click(screen.getByRole("button", { name: /^Work/ }));
    await screen.findByRole("button", { name: /^Q3 回顧/ });
    expect(screen.queryByRole("button", { name: /^Zen of Writing/ })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /^Tauri 與 Electron/ }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Tauri 與 Electron/ })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByRole("button", { name: /^Zen of Writing/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("remembers the article the user opened", async () => {
    answerFromAVault({ workspace: null, article: null });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^Blog/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^Zen of Writing/ }));

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

    fireEvent.click(screen.getByRole("button", { name: /^Tauri 與 Electron/ }));

    expect(await screen.findByText("儲存失敗：No space left on device")).toBeInTheDocument();
    expect(editorContent()).toHaveTextContent("正文的第一行。");
    expect(screen.getByRole("button", { name: /^Zen of Writing/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("pastes an image into the open article, saves the relative path and previews it", async () => {
    answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
    const answerFromTheVault = vi.mocked(invoke).getMockImplementation();
    vi.mocked(invoke).mockImplementation((command, args) =>
      command === "save_clipboard_image"
        ? Promise.resolve({ images: [{ relativePath: "images/8f3c.png" }] })
        : (answerFromTheVault?.(command, args) ?? Promise.resolve(null)),
    );
    // jsdom has no layout; the editor measures text ranges to scroll the pasted line into view.
    Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect ??= () => new DOMRect();
    const { container } = render(<App />);
    await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
    const content = editorContent();
    if (content === null) {
      throw new Error("the editor did not render its content area");
    }

    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { items: [{ kind: "file", type: "image/png" }], files: [], getData: () => "" },
    });
    act(() => {
      content.dispatchEvent(paste);
    });

    expect(invoke).toHaveBeenCalledWith("save_clipboard_image", { workspace: "Blog" });
    await waitFor(
      () =>
        expect(invoke).toHaveBeenCalledWith(
          "save_body",
          expect.objectContaining({ body: "![](images/8f3c.png)正文的第一行。" }),
        ),
      { timeout: 2000 },
    );
    await waitFor(() =>
      expect(container.querySelector(".preview-content img")?.getAttribute("src")).toBe(
        "rustle://vault/Blog/images/8f3c.png",
      ),
    );

    const view = EditorView.findFromDOM(content);
    if (view === null) {
      throw new Error("the editor view is not reachable");
    }
    act(() => {
      undo(view);
    });

    expect(view.state.doc.toString()).toBe("正文的第一行。");
    const commands = vi.mocked(invoke).mock.calls.map(([command]) => command);
    expect(commands.filter((command) => command === "save_clipboard_image")).toHaveLength(1);
    expect(commands.filter((command) => /delete|trash|remove/.test(command))).toEqual([]);
  });

  it("starts watching window close requests", () => {
    answerFromAVault({ workspace: null, article: null });

    render(<App />);

    expect(invoke).toHaveBeenCalledWith("watch_close_requests", expect.anything());
  });

  describe("preview panel", () => {
    function previewRegion(): HTMLElement {
      return screen.getByRole("region", { name: "PREVIEW" });
    }

    function typeAtTheEnd(text: string) {
      const editor = document.querySelector<HTMLElement>(".cm-editor");
      const view = editor === null ? null : EditorView.findFromDOM(editor);
      if (view === null) {
        throw new Error("the editor did not render");
      }
      act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: text } }));
    }

    it("shows the open article rendered in the fourth column with a close button", async () => {
      answerFromAVault({ workspace: "Work", article: "q3.md" });
      render(<App />);

      expect(
        await within(previewRegion()).findByRole("heading", { level: 1, name: "Q3 回顧" }),
      ).toBeInTheDocument();
      expect(within(previewRegion()).getByRole("button", { name: "關閉預覽" })).toBeInTheDocument();
      expect(within(previewRegion()).queryByText(/title:/)).not.toBeInTheDocument();
    });

    it("says the same as the editor while no article is open, with nothing to type into", async () => {
      answerFromAVault({ workspace: null, article: null });
      render(<App />);
      await screen.findByRole("button", { name: /^Blog/ });

      expect(screen.getAllByText("選一篇文章開始寫作")).toHaveLength(2);
      expect(within(previewRegion()).getByText("選一篇文章開始寫作")).toBeInTheDocument();
      expect(previewRegion().querySelector("[contenteditable], input, textarea")).toBeNull();
    });

    it("replaces the empty state with the article clicked, and returns to it on another workspace", async () => {
      answerFromAVault({ workspace: "Work", article: null });
      render(<App />);
      fireEvent.click(await screen.findByRole("button", { name: /^Q3 回顧/ }));

      expect(
        await within(previewRegion()).findByRole("heading", { name: "Q3 回顧" }),
      ).toBeInTheDocument();
      expect(within(previewRegion()).queryByText("選一篇文章開始寫作")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /^Blog/ }));

      expect(await within(previewRegion()).findByText("選一篇文章開始寫作")).toBeInTheDocument();
    });

    it("follows what is typed in the editor, not what is on disk", async () => {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      render(<App />);
      await waitFor(() => expect(previewRegion()).toHaveTextContent("正文的第一行。"));

      typeAtTheEnd("\n\n## 新的一節");

      expect(within(previewRegion()).queryByRole("heading", { name: "新的一節" })).not.toBeInTheDocument();
      expect(
        await within(previewRegion()).findByRole("heading", { level: 2, name: "新的一節" }),
      ).toBeInTheDocument();
    });

    it("folds into a handle, remembers it, and comes back showing the current body", async () => {
      answerFromAVault({ workspace: "Work", article: "q3.md" });
      render(<App />);
      await within(previewRegion()).findByRole("heading", { name: "Q3 回顧" });

      fireEvent.click(screen.getByRole("button", { name: "關閉預覽" }));

      expect(screen.queryByRole("region", { name: "PREVIEW" })).not.toBeInTheDocument();
      expect(screen.queryAllByRole("heading", { name: "Q3 回顧" })).toHaveLength(0);
      expect(invoke).toHaveBeenLastCalledWith("write_settings", {
        settings: {
          indentation: { style: "spaces", width: 2 },
          previewPanel: { isOpen: false, widthRatio: 0.5 },
          lastOpened: { workspace: "Work", article: "q3.md" },
        },
      });

      fireEvent.click(screen.getByRole("button", { name: "開啟預覽" }));

      expect(within(previewRegion()).getByRole("heading", { name: "Q3 回顧" })).toBeInTheDocument();
    });

    it("starts folded when the settings say it was closed", async () => {
      answerFromAVault({ workspace: null, article: null }, { isOpen: false, widthRatio: 0.5 });
      render(<App />);

      expect(await screen.findByRole("button", { name: "開啟預覽" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "PREVIEW" })).not.toBeInTheDocument();
    });

    it("toggles with the shortcut written in the settings", async () => {
      answerFromAVault({ workspace: null, article: null }, { isOpen: true, widthRatio: 0.5, toggleShortcut: "Mod+Alt+K" });
      render(<App />);
      await screen.findByRole("button", { name: /^Blog/ });

      fireEvent.keyDown(window, { ctrlKey: true, altKey: true, key: "k", code: "KeyK" });

      expect(screen.queryByRole("region", { name: "PREVIEW" })).not.toBeInTheDocument();
    });

    it("stays usable when the settings cannot be read, without writing any", async () => {
      vi.mocked(invoke).mockImplementation((command) =>
        command === "read_settings"
          ? Promise.reject({ reason: "unexpected", message: "permission denied" })
          : Promise.resolve([]),
      );
      render(<App />);
      await waitFor(() => expect(invoke).toHaveBeenCalledWith("list_workspaces", undefined));

      expect(previewRegion()).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "關閉預覽" }));

      expect(screen.getByRole("button", { name: "開啟預覽" })).toBeInTheDocument();
      expect(invoke).not.toHaveBeenCalledWith("write_settings", expect.anything());
    });
  });

  it("creates an article from the dialog and leaves the cursor in the editor", async () => {
    answerFromAVaultThatCreatesArticles();
    render(<App />);
    await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(screen.getByLabelText("2 篇文章")).toBeInTheDocument();

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
      expect(screen.getByRole("button", { name: /^New Article/ })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByLabelText("3 篇文章")).toBeInTheDocument();
    await waitFor(() => expect(editorContent()).toHaveFocus());
    expect(editorContent()?.textContent).toBe("");
  });

  it("opens the dialog from an empty workspace's invitation", async () => {
    answerFromAVault({ workspace: null, article: null });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /^Empty/ }));

    fireEvent.click(await screen.findByRole("button", { name: "建立第一篇文章" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the dialog on Esc without creating anything", async () => {
    answerFromAVaultThatCreatesArticles();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "＋ 新文章" }));

    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("create_article", expect.anything());
  });

  describe("metadata editing and deletion", () => {
    function answerFromAVaultWith(answers: Record<string, (args: Record<string, string>) => unknown>) {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      const answerFromTheVault = vi.mocked(invoke).getMockImplementation();
      vi.mocked(invoke).mockImplementation(async (command, args) => {
        const answer = answers[command];
        return answer === undefined
          ? answerFromTheVault?.(command, args)
          : answer((args ?? {}) as Record<string, string>);
      });
    }

    async function startInBlog() {
      render(<App />);
      await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
    }

    it("opens the metadata form of the row and writes what was saved", async () => {
      answerFromAVaultWith({
        update_metadata: (request) => ({
          outcome: "updated",
          article: { fileName: request.fileName, title: request.title, createdAt: "", updatedAt: "", category: [], tags: [], hasIncompleteMetadata: false },
        }),
      });
      await startInBlog();

      fireEvent.click(screen.getByRole("button", { name: "編輯 Tauri 與 Electron 的 metadata" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByLabelText("Title")).toHaveValue("Tauri 與 Electron");
      fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "新標題" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "儲存" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(invoke).toHaveBeenCalledWith("update_metadata", {
        workspace: "Blog",
        fileName: "tauri.md",
        title: "新標題",
        category: [],
        tags: [],
      });
    });

    it("keeps the open article after editing its metadata, under its new title, and saves after it without a warning", async () => {
      let written = false;
      answerFromAVaultWith({
        update_metadata: (request) => {
          written = true;
          return {
            outcome: "updated",
            article: { fileName: request.fileName, title: request.title, createdAt: "", updatedAt: "", category: [], tags: [], hasIncompleteMetadata: false },
          };
        },
        list_articles: () => [
          { fileName: "zen-of-writing.md", title: written ? "新標題" : "Zen of Writing", createdAt: "", category: [], tags: [], hasIncompleteMetadata: false },
        ],
        read_body: (request) => ({
          workspace: request.workspace,
          fileName: request.fileName,
          body: BODIES[request.fileName ?? ""] ?? "",
          lastKnownModifiedAt: written ? "2026-08-20T09:00:00.000Z" : "2026-08-20T08:04:11.123Z",
        }),
        save_body: (request) => ({
          outcome: request.lastKnownModifiedAt === "2026-08-20T09:00:00.000Z" ? "saved" : "modifiedElsewhere",
          updatedAt: "2026-08-20T09:01:00.000Z",
          lastKnownModifiedAt: "2026-08-20T09:01:00.100Z",
        }),
      });
      await startInBlog();

      fireEvent.click(screen.getByRole("button", { name: "編輯 Zen of Writing 的 metadata" }));
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "新標題" } });
      fireEvent.click(screen.getByRole("button", { name: "儲存" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await waitFor(() => expect(screen.getByRole("banner")).toHaveTextContent("新標題"));
      expect(editorContent()).toHaveTextContent("正文的第一行。");
      const content = editorContent();
      if (content === null) {
        throw new Error("the editor did not render its content area");
      }
      fireEvent.keyDown(content, { key: "Tab" });

      await waitFor(
        () =>
          expect(invoke).toHaveBeenCalledWith(
            "save_body",
            expect.objectContaining({ lastKnownModifiedAt: "2026-08-20T09:00:00.000Z" }),
          ),
        { timeout: 2000 },
      );
      expect(await screen.findByText("已儲存")).toBeInTheDocument();
    });

    it("asks before moving an article to the trash, saying where it goes and that images stay", async () => {
      answerFromAVaultWith({ delete_article: () => null });
      await startInBlog();

      fireEvent.click(screen.getByRole("button", { name: "刪除 Tauri 與 Electron" }));

      const confirmation = screen.getByRole("alertdialog");
      expect(confirmation).toHaveTextContent("系統垃圾桶");
      expect(confirmation).toHaveTextContent("圖片一張都不會被刪除");
      expect(invoke).not.toHaveBeenCalledWith("delete_article", expect.anything());

      fireEvent.click(within(confirmation).getByRole("button", { name: "刪除文章" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(invoke).toHaveBeenCalledWith("delete_article", { workspace: "Blog", fileName: "tauri.md" });
    });

    it("deletes no article when its confirmation is cancelled or dismissed with Esc", async () => {
      answerFromAVaultWith({ delete_article: () => null });
      await startInBlog();

      fireEvent.click(screen.getByRole("button", { name: "刪除 Tauri 與 Electron" }));
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "取消" }));
      fireEvent.click(screen.getByRole("button", { name: "刪除 Tauri 與 Electron" }));
      fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(invoke).not.toHaveBeenCalledWith("delete_article", expect.anything());
    });

    it("says how many articles and images deleting a workspace takes, counted when asked", async () => {
      answerFromAVaultWith({
        count_workspace_contents: () => ({ articleCount: 2, imageCount: 2 }),
        delete_workspace: () => ({ articleCount: 2, imageCount: 2 }),
      });
      await startInBlog();

      fireEvent.click(screen.getByRole("button", { name: "刪除 Work" }));

      const confirmation = await screen.findByRole("alertdialog");
      expect(invoke).toHaveBeenCalledWith("count_workspace_contents", { workspace: "Work" });
      expect(confirmation).toHaveTextContent("將刪除 2 篇文章與 2 張圖片。");
      expect(confirmation).toHaveTextContent("整個 Work 資料夾會移到系統垃圾桶");

      fireEvent.keyDown(confirmation, { key: "Escape" });

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(invoke).not.toHaveBeenCalledWith("delete_workspace", expect.anything());
    });

    it("does not ask about a workspace it cannot count and says why instead", async () => {
      answerFromAVaultWith({
        count_workspace_contents: () => Promise.reject({ reason: "unexpected", message: "Permission denied" }),
      });
      await startInBlog();

      fireEvent.click(screen.getByRole("button", { name: "刪除 Work" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("刪除 workspace 失敗：Permission denied");
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("reports a failed article creation as such, not as an unreadable workspace, and lets it be dismissed", async () => {
      answerFromAVaultWith({
        create_article: () => Promise.reject({ reason: "unexpected", message: "'Blog/zen.md' already exists" }),
      });
      await startInBlog();
      fireEvent.click(screen.getByRole("button", { name: "＋ 新文章" }));
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Zen" } });
      fireEvent.click(screen.getByRole("button", { name: "建立" }));
      await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
      fireEvent.click(screen.getByRole("button", { name: "取消" }));

      const notice = screen.getByRole("alert");
      expect(notice).toHaveTextContent("建立文章失敗：'Blog/zen.md' already exists");
      expect(screen.queryByText(/讀不到/)).not.toBeInTheDocument();

      fireEvent.click(within(notice).getByRole("button", { name: "關閉提示" }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});

