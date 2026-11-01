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
          sidebar: { collapsedSections: [] },
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
                { workspace: "Blog", fileName: "tauri.md", title: "Tauri 與 Electron", createdAt: "2026-08-20", status: null, tags: [], hasIncompleteMetadata: false },
                { workspace: "Blog", fileName: "zen-of-writing.md", title: "Zen of Writing", createdAt: "2026-08-18", status: null, tags: [], hasIncompleteMetadata: false },
              ]
            : request.workspace === "Work"
              ? [{ workspace: "Work", fileName: "q3.md", title: "Q3 回顧", createdAt: "", status: null, tags: [], hasIncompleteMetadata: false }]
              : [],
        );
      case "list_all_articles":
        return Promise.resolve([
          { workspace: "Blog", fileName: "tauri.md", title: "Tauri 與 Electron", createdAt: "2026-08-20", status: "active", tags: ["work"], hasIncompleteMetadata: false },
          { workspace: "Work", fileName: "q3.md", title: "Q3 回顧", createdAt: "", status: "completed", tags: ["work"], hasIncompleteMetadata: false },
        ]);
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
      case "read_preferred_locales":
        return Promise.resolve({ locales: ["zh-Hant-TW", "en-US"] });
      case "write_settings":
      case "watch_close_requests":
        return Promise.resolve(null);
      default:
        return Promise.reject({ reason: "unknownChannel", message: String(command) });
    }
  });
}

const CREATED_ARTICLE = {
  workspace: "Blog",
  fileName: "new-article.md",
  title: "New Article",
  createdAt: "2026-08-20T14:32:05+08:00",
  updatedAt: "2026-08-20T14:32:05+08:00",
  status: null,
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
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["zh-TW"]);
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
    expect(within(screen.getByRole("region", { name: "編輯區" })).getByText("還沒有選取文章")).toBeInTheDocument();
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

    const sidebar = screen.getByRole("navigation");
    const columns = [sidebar, ...screen.getAllByRole("region").filter((region) => !sidebar.contains(region))];
    const focusable = columns.map(
      (column) => within(column).queryAllByRole("textbox").length + within(column).queryAllByRole("button").length,
    );
    const order = [...document.querySelectorAll("input, button, [contenteditable='true']")].map(
      (element) => columns.findIndex((column) => column.contains(element)),
    );

    expect(focusable.every((count) => count > 0)).toBe(true);
    expect(order).toEqual([...order].sort((left, right) => left - right));
    expect(document.querySelector("input")).toHaveAccessibleName("新 workspace 名稱");
  });

  it("says in one line that the vault could not be read and stays usable", async () => {
    vi.mocked(invoke).mockImplementation((command) =>
      command === "read_preferred_locales"
        ? Promise.resolve({ locales: ["zh-Hant-TW"] })
        : command === "list_workspaces"
        ? Promise.reject({ reason: "unexpected", message: "permission denied" })
        : Promise.resolve({
            indentation: { style: "spaces", width: 2 },
            previewPanel: { isOpen: true, widthRatio: 0.5 },
            lastOpened: { workspace: null, article: null },
            sidebar: { collapsedSections: [] },
          }),
    );

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("讀不到 vault");
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
      return screen.getByRole("region", { name: "預覽區" });
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

      expect(screen.getAllByText("還沒有選取文章")).toHaveLength(2);
      expect(within(previewRegion()).getByText("還沒有選取文章")).toBeInTheDocument();
      expect(previewRegion().querySelector("[contenteditable], input, textarea")).toBeNull();
    });

    it("replaces the empty state with the article clicked, and returns to it on another workspace", async () => {
      answerFromAVault({ workspace: "Work", article: null });
      render(<App />);
      fireEvent.click(await screen.findByRole("button", { name: /^Q3 回顧/ }));

      expect(
        await within(previewRegion()).findByRole("heading", { name: "Q3 回顧" }),
      ).toBeInTheDocument();
      expect(within(previewRegion()).queryByText("還沒有選取文章")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /^Blog/ }));

      expect(await within(previewRegion()).findByText("還沒有選取文章")).toBeInTheDocument();
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

      expect(screen.queryByRole("region", { name: "預覽區" })).not.toBeInTheDocument();
      expect(screen.queryAllByRole("heading", { name: "Q3 回顧" })).toHaveLength(0);
      expect(invoke).toHaveBeenLastCalledWith("write_settings", {
        settings: {
          indentation: { style: "spaces", width: 2 },
          previewPanel: { isOpen: false, widthRatio: 0.5 },
          lastOpened: { workspace: "Work", article: "q3.md" },
          sidebar: { collapsedSections: [] },
        },
      });

      fireEvent.click(screen.getByRole("button", { name: "開啟預覽" }));

      expect(within(previewRegion()).getByRole("heading", { name: "Q3 回顧" })).toBeInTheDocument();
    });

    it("opens at the width it was left at and remembers a new one with every other setting", async () => {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" }, { isOpen: true, widthRatio: 0.35 });
      render(<App />);
      await waitFor(() => expect(previewRegion().style.flexBasis).toBe("35%"));

      fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight", keyCode: 39 });

      expect(previewRegion().style.flexBasis).toBe("30%");
      expect(invoke).toHaveBeenLastCalledWith("write_settings", {
        settings: {
          indentation: { style: "spaces", width: 2 },
          previewPanel: { isOpen: true, widthRatio: expect.closeTo(0.3) },
          lastOpened: { workspace: "Blog", article: "zen-of-writing.md" },
          sidebar: { collapsedSections: [] },
        },
      });
    });

    it("moves the preview when the editor is scrolled", async () => {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      render(<App />);
      await waitFor(() => expect(within(previewRegion()).getByText("正文的第一行。")).toBeInTheDocument());
      const previewScroller = previewRegion().querySelector(".preview-scroller");
      const editorScroller = document.querySelector(".cm-scroller");
      if (previewScroller === null || editorScroller === null) {
        throw new Error("a scroller is missing");
      }
      let previewPosition = 0;
      Object.defineProperties(previewScroller, {
        scrollHeight: { value: 2000 },
        clientHeight: { value: 300 },
        scrollTop: { get: () => previewPosition, set: (position: number) => (previewPosition = position) },
      });

      Object.defineProperty(editorScroller, "scrollTop", { value: 40 });
      fireEvent.scroll(editorScroller);

      expect(previewPosition).toBe(1700);
    });

    it("starts folded when the settings say it was closed", async () => {
      answerFromAVault({ workspace: null, article: null }, { isOpen: false, widthRatio: 0.5 });
      render(<App />);

      expect(await screen.findByRole("button", { name: "開啟預覽" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "預覽區" })).not.toBeInTheDocument();
    });

    it("toggles with the shortcut written in the settings", async () => {
      answerFromAVault({ workspace: null, article: null }, { isOpen: true, widthRatio: 0.5, toggleShortcut: "Mod+Alt+K" });
      render(<App />);
      await screen.findByRole("button", { name: /^Blog/ });

      fireEvent.keyDown(window, { ctrlKey: true, altKey: true, key: "k", code: "KeyK" });

      expect(screen.queryByRole("region", { name: "預覽區" })).not.toBeInTheDocument();
    });

    it("stays usable when the settings cannot be read, without writing any", async () => {
      vi.mocked(invoke).mockImplementation((command) =>
        command === "read_preferred_locales"
          ? Promise.resolve({ locales: ["zh-Hant-TW"] })
          : command === "read_settings"
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
    fireEvent.change(within(dialog).getByLabelText("標題"), { target: { value: "New Article" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "建立" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith("create_article", {
      workspace: "Blog",
      title: "New Article",
      status: null,
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

    fireEvent.keyDown(screen.getByLabelText("標題"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("create_article", expect.anything());
  });

  describe("sidebar", () => {
    function articlesRegion() {
      return screen.getByRole("region", { name: "文章" });
    }

    it("lists every workspace under All Notes and opens an article from its own workspace", async () => {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      render(<App />);
      await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));

      fireEvent.click(screen.getByRole("button", { name: "所有文章" }));
      const q3 = await within(articlesRegion()).findByRole("button", { name: /^Q3 回顧/ });
      expect(q3).toHaveTextContent("Work");
      expect(screen.getByRole("button", { name: /^Blog/ })).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(q3);

      await waitFor(() => expect(editorContent()).toHaveTextContent("Q3 回顧"));
      expect(invoke).toHaveBeenCalledWith("read_body", { workspace: "Work", fileName: "q3.md" });
    });

    it("narrows the list to the status clicked in the sidebar and clears it on another scope", async () => {
      answerFromAVault({ workspace: null, article: null });
      render(<App />);
      fireEvent.click(await screen.findByRole("button", { name: "所有文章" }));
      await within(articlesRegion()).findByRole("button", { name: /^Q3 回顧/ });
      const statusSection = screen.getByRole("region", { name: "狀態" });
      expect(within(statusSection).getByRole("button", { name: /^已完成/ })).toHaveTextContent("1");

      fireEvent.click(within(statusSection).getByRole("button", { name: /^進行中/ }));

      expect(within(articlesRegion()).queryByRole("button", { name: /^Q3 回顧/ })).not.toBeInTheDocument();
      expect(within(articlesRegion()).getByRole("button", { name: /^Tauri/ })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /^Work/ }));

      expect(await within(articlesRegion()).findByRole("button", { name: /^Q3 回顧/ })).toBeInTheDocument();
      expect(within(statusSection).getByRole("button", { name: /^進行中/ })).toHaveAttribute("aria-pressed", "false");
    });

    it("keeps narrowing the list by a status whose section is folded", async () => {
      answerFromAVault({ workspace: null, article: null });
      render(<App />);
      fireEvent.click(await screen.findByRole("button", { name: "所有文章" }));
      await within(articlesRegion()).findByRole("button", { name: /^Q3 回顧/ });
      fireEvent.click(within(screen.getByRole("region", { name: "狀態" })).getByRole("button", { name: /^進行中/ }));

      fireEvent.click(screen.getByRole("button", { name: /^狀態/ }));

      expect(within(screen.getByRole("region", { name: "狀態" })).queryByRole("button", { name: /^進行中/ })).toBeNull();
      expect(within(articlesRegion()).queryByRole("button", { name: /^Q3 回顧/ })).not.toBeInTheDocument();
      expect(within(articlesRegion()).getByRole("button", { name: /^Tauri/ })).toBeInTheDocument();
    });

    it("keeps the workspace and the list when the workspace section is folded", async () => {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      render(<App />);
      await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));

      fireEvent.click(screen.getByRole("button", { name: /^WORKSPACES/ }));

      expect(screen.queryByRole("button", { name: /^Blog/ })).not.toBeInTheDocument();
      expect(within(articlesRegion()).getAllByRole("button", { name: /^(Tauri|Zen)/ })).toHaveLength(2);
      expect(editorContent()).toHaveTextContent("正文的第一行。");
      expect(invoke).toHaveBeenLastCalledWith("write_settings", {
        settings: expect.objectContaining({ sidebar: { collapsedSections: ["workspaces"] } }),
      });
    });
  });

  describe("article list controls", () => {
    function answerWithCategorizedArticles() {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      const answerFromTheVault = vi.mocked(invoke).getMockImplementation();
      vi.mocked(invoke).mockImplementation((command, args) =>
        command === "list_articles"
          ? Promise.resolve([
              { workspace: "Blog", fileName: "tauri.md", title: "Tauri 與 Electron", createdAt: "2026-08-20", updatedAt: "", status: "active", tags: ["tauri", "技術筆記"], hasIncompleteMetadata: false },
              { workspace: "Blog", fileName: "zen-of-writing.md", title: "Zen of Writing", createdAt: "2026-08-18", updatedAt: "", status: null, tags: ["隨筆"], hasIncompleteMetadata: false },
            ])
          : (answerFromTheVault?.(command, args) ?? Promise.resolve(null)),
      );
    }

    function filterTheList(text: string) {
      const field = screen.getByRole("textbox", { name: "篩選文章" });
      fireEvent.change(field, { target: { value: text } });
      fireEvent.keyDown(field, { key: "Enter", keyCode: 13 });
    }

    it("filters and orders without calling any channel and keeps the open article", async () => {
      answerWithCategorizedArticles();
      render(<App />);
      await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
      vi.mocked(invoke).mockClear();

      filterTheList("技術");
      expect(screen.getByRole("button", { name: /^Zen of Writing/ })).toHaveTextContent("不符合篩選");
      fireEvent.change(screen.getByRole("combobox", { name: "排序" }), { target: { value: "title" } });

      expect(invoke).not.toHaveBeenCalled();
      expect(editorContent()).toHaveTextContent("正文的第一行。");
      expect(screen.getByRole("button", { name: /^Zen of Writing/ })).toHaveAttribute("aria-pressed", "true");
    });

    it("offers the tags of articles the filter hides in the create article dialog", async () => {
      answerWithCategorizedArticles();
      render(<App />);
      await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
      fireEvent.click(screen.getByRole("button", { name: /^Blog/ }));
      await waitFor(() => expect(editorContent()).toBeNull());
      await screen.findByRole("button", { name: /^Zen of Writing/ });

      filterTheList("技術");
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: /^Zen of Writing/ })).not.toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: "＋ 新文章" }));
      const dialog = screen.getByRole("dialog");
      fireEvent.change(within(dialog).getByLabelText("標籤"), { target: { value: "隨" } });

      expect(within(dialog).getByRole("list", { name: "標籤 候選" })).toHaveTextContent("隨筆");
    });
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
          article: { workspace: request.workspace, fileName: request.fileName, title: request.title, createdAt: "", updatedAt: "", status: null, tags: [], hasIncompleteMetadata: false },
        }),
      });
      await startInBlog();

      fireEvent.click(screen.getByRole("button", { name: "編輯 Tauri 與 Electron 的 metadata" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByLabelText("標題")).toHaveValue("Tauri 與 Electron");
      fireEvent.change(within(dialog).getByLabelText("標題"), { target: { value: "新標題" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "儲存" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(invoke).toHaveBeenCalledWith("update_metadata", {
        workspace: "Blog",
        fileName: "tauri.md",
        title: "新標題",
        status: null,
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
            article: { workspace: request.workspace, fileName: request.fileName, title: request.title, createdAt: "", updatedAt: "", status: null, tags: [], hasIncompleteMetadata: false },
          };
        },
        list_articles: () => [
          { workspace: "Blog", fileName: "zen-of-writing.md", title: written ? "新標題" : "Zen of Writing", createdAt: "", status: null, tags: [], hasIncompleteMetadata: false },
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
      fireEvent.change(screen.getByLabelText("標題"), { target: { value: "新標題" } });
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
      fireEvent.change(screen.getByLabelText("標題"), { target: { value: "Zen" } });
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

  describe("interface language", () => {
    function answerInLanguage(interfaceLanguage: string | undefined, systemLocales: string[]) {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      const answerFromTheVault = vi.mocked(invoke).getMockImplementation();
      vi.mocked(invoke).mockImplementation(async (command, args) => {
        if (command === "read_preferred_locales") {
          return { locales: systemLocales };
        }
        const answer = await answerFromTheVault?.(command, args);
        return command === "read_settings" && interfaceLanguage !== undefined
          ? { ...(answer as object), interfaceLanguage }
          : answer;
      });
    }

    function regionTitles() {
      return screen
        .getAllByRole("heading", { level: 2 })
        .filter((heading) => heading.closest("nav") === null)
        .map((heading) => heading.textContent);
    }

    async function openSettings(name = "設定") {
      fireEvent.click(screen.getByRole("button", { name }));
      return screen.findByRole("dialog");
    }

    async function renderWithTheArticleOpen() {
      render(<App />);
      await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
    }

    it("puts the gear at the bottom of the sidebar", async () => {
      answerInLanguage(undefined, ["zh-Hant-TW"]);
      await renderWithTheArticleOpen();

      const sidebar = screen.getByRole("navigation", { name: "側邊欄" });
      const gear = within(sidebar).getByRole("button", { name: "設定" });
      expect(within(sidebar).getAllByRole("button").at(-1)).toBe(gear);
      expect(gear.closest(".region-footer")).not.toBeNull();
    });

    it("speaks Chinese on a Chinese system until anything is chosen", async () => {
      answerInLanguage(undefined, ["zh-Hant-TW"]);
      await renderWithTheArticleOpen();

      expect(regionTitles()).toEqual(["文章", "編輯", "預覽"]);
      expect(document.documentElement.lang).toBe("zh-Hant");
    });

    it("speaks English on a system in a language it does not support", async () => {
      answerInLanguage(undefined, ["ja-JP"]);
      render(<App />);

      await waitFor(() => expect(regionTitles()).toEqual(["ARTICLES", "EDITOR", "PREVIEW"]));
      expect(document.documentElement.lang).toBe("en");
    });

    it("speaks the language chosen before, whatever the system says", async () => {
      answerInLanguage("en", ["zh-Hant-TW"]);
      render(<App />);

      await waitFor(() => expect(regionTitles()).toEqual(["ARTICLES", "EDITOR", "PREVIEW"]));
      expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    });

    it("changes the whole screen at once and remembers it with every other setting", async () => {
      answerInLanguage(undefined, ["zh-Hant-TW"]);
      await renderWithTheArticleOpen();

      const dialog = await openSettings();
      expect(within(dialog).getByRole("heading", { name: "設定" })).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("radio", { name: "English" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(regionTitles()).toEqual(["ARTICLES", "EDITOR", "PREVIEW"]);
      expect(screen.getByRole("textbox", { name: "New workspace name" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: 'Delete "Zen of Writing"' })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Settings" })).toHaveFocus();
      expect(invoke).toHaveBeenCalledWith("write_settings", {
        settings: {
          indentation: { style: "spaces", width: 2 },
          previewPanel: { isOpen: true, widthRatio: 0.5 },
          lastOpened: { workspace: "Blog", article: "zen-of-writing.md" },
          sidebar: { collapsedSections: [] },
          interfaceLanguage: "en",
        },
      });
    });

    it("leaves no Chinese of its own on screen in English, only the writer's words", async () => {
      answerInLanguage("en", ["zh-Hant-TW"]);
      await renderWithTheArticleOpen();
      await waitFor(() => expect(regionTitles()).toContain("ARTICLES"));
      const writersWords = ["正文的第一行。", "Tauri 與 Electron"];

      const elements = [...document.body.querySelectorAll("*")];
      const shown = [
        ...elements.flatMap((element) =>
          [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent ?? ""),
        ),
        ...elements.flatMap((element) =>
          ["aria-label", "placeholder", "title"].map((attribute) => element.getAttribute(attribute) ?? ""),
        ),
      ];
      const rustlesOwnChinese = shown
        .map((text) => writersWords.reduce((rest, words) => rest.replaceAll(words, ""), text))
        .filter((text) => /\p{Script=Han}/u.test(text));

      expect(rustlesOwnChinese).toEqual([]);
    });

    it("keeps the product name as the page title in both languages", async () => {
      document.title = "Rustle";
      answerInLanguage(undefined, ["zh-Hant-TW"]);
      await renderWithTheArticleOpen();

      fireEvent.click(within(await openSettings()).getByRole("radio", { name: "English" }));
      expect(document.title).toBe("Rustle");
      fireEvent.click(within(await openSettings("Settings")).getByRole("radio", { name: "中文" }));

      expect(document.title).toBe("Rustle");
    });

    it("changes nothing on screen when the language in use is chosen", async () => {
      answerInLanguage(undefined, ["zh-Hant-TW"]);
      await renderWithTheArticleOpen();
      const before = document.querySelector(".app-layout")?.textContent;

      fireEvent.click(within(await openSettings()).getByRole("radio", { name: "中文" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.querySelector(".app-layout")?.textContent).toBe(before);
    });

    it.each(["Escape", "a click on the dimmed backdrop"] as const)(
      "closes on %s without changing the language",
      async (way) => {
        answerInLanguage(undefined, ["zh-Hant-TW"]);
        await renderWithTheArticleOpen();
        const dialog = await openSettings();

        if (way === "Escape") {
          fireEvent.keyDown(within(dialog).getByRole("radio", { name: "中文" }), { key: "Escape" });
        } else {
          fireEvent.click(screen.getByTestId("settings-backdrop"));
        }

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(regionTitles()).toEqual(["文章", "編輯", "預覽"]);
        expect(screen.getByRole("button", { name: "設定" })).toHaveFocus();
        expect(invoke).not.toHaveBeenCalledWith("write_settings", expect.anything());
      },
    );

    it("keeps the body, its unsaved change and the cursor when the language changes", async () => {
      answerInLanguage(undefined, ["zh-Hant-TW"]);
      await renderWithTheArticleOpen();
      const content = editorContent();
      const view = content === null ? null : EditorView.findFromDOM(content);
      if (content === null || view === null) {
        throw new Error("the editor did not render");
      }
      act(() => view.dispatch({ changes: { from: 0, insert: "新的" }, selection: { anchor: 2 } }));

      fireEvent.click(within(await openSettings()).getByRole("radio", { name: "English" }));

      expect(EditorView.findFromDOM(content)).toBe(view);
      expect(view.state.doc.toString()).toBe("新的正文的第一行。");
      expect(view.state.selection.main.head).toBe(2);
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
      await waitFor(
        () => expect(invoke).toHaveBeenCalledWith("save_body", expect.objectContaining({ body: "新的正文的第一行。" })),
        { timeout: 2000 },
      );
    });

    it("sends no language with a new article, so the file does not depend on it", async () => {
      answerFromAVaultThatCreatesArticles();
      await renderWithTheArticleOpen();
      fireEvent.click(within(await openSettings()).getByRole("radio", { name: "English" }));

      fireEvent.click(screen.getByRole("button", { name: "＋ New article" }));
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Article" } });
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Create" })));

      expect(invoke).toHaveBeenCalledWith("create_article", {
        workspace: "Blog",
        title: "New Article",
        status: null,
        tags: [],
      });
    });
  });

  describe("finding articles", () => {
    function answerFromAVaultThatSearchesBodies() {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      const answerFromTheVault = vi.mocked(invoke).getMockImplementation();
      vi.mocked(invoke).mockImplementation(async (command, args) => {
        if (command === "search_bodies") {
          return {
            matches: [{ workspace: "Blog", fileName: "tauri.md", lineNumber: 1, lineText: "最近在選桌面框架。" }],
            isTruncated: false,
          };
        }
        return answerFromTheVault?.(command, args);
      });
    }

    async function startWithZenOpen() {
      render(<App />);
      await waitFor(() => expect(editorContent()).toHaveTextContent("正文的第一行。"));
      const content = editorContent();
      if (content === null) {
        throw new Error("no editor");
      }
      return content;
    }

    it("goes to another workspace from the keyboard and opens its newest article", async () => {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      const content = await startWithZenOpen();
      const editorKeys = vi.fn();
      content.addEventListener("keydown", editorKeys);
      content.focus();

      fireEvent.keyDown(content, { code: "KeyP", key: "p", metaKey: true });
      const finder = await screen.findByRole("dialog", { name: "切換 workspace" });

      expect(editorKeys).not.toHaveBeenCalled();
      expect(editorContent()).toHaveTextContent("正文的第一行。");

      fireEvent.change(within(finder).getByRole("textbox"), { target: { value: "work" } });
      fireEvent.keyDown(within(finder).getByRole("textbox"), { key: "Enter" });

      await waitFor(() => expect(editorContent()).toHaveTextContent("# Q3 回顧"));
      expect(screen.getByRole("button", { name: /^Work/ })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("opens an article found by its title", async () => {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      const content = await startWithZenOpen();

      fireEvent.keyDown(content, { code: "KeyT", key: "t", metaKey: true });
      const field = within(await screen.findByRole("dialog", { name: "用標題找文章" })).getByRole("textbox");
      fireEvent.change(field, { target: { value: "tauri" } });
      fireEvent.keyDown(field, { key: "Enter" });

      await waitFor(() => expect(editorContent()).toHaveTextContent("最近在選桌面框架。"));
      expect(screen.getByRole("button", { name: /^Tauri 與 Electron/ })).toHaveAttribute("aria-pressed", "true");
    });

    it("opens the article of a body line found in the saved files", async () => {
      answerFromAVaultThatSearchesBodies();
      const content = await startWithZenOpen();

      fireEvent.keyDown(content, { code: "KeyF", key: "f", metaKey: true, shiftKey: true });
      const finder = await screen.findByRole("dialog", { name: "用內文找文章" });
      fireEvent.change(within(finder).getByRole("textbox"), { target: { value: "桌面" } });
      const row = await within(finder).findByRole("option", { name: /^Tauri 與 Electron第 1 行最近在選桌面框架。/ });
      fireEvent.click(row);

      await waitFor(() => expect(editorContent()).toHaveTextContent("最近在選桌面框架。"));
      expect(invoke).toHaveBeenCalledWith("search_bodies", {
        text: "桌面",
        articles: [
          { workspace: "Blog", fileName: "tauri.md" },
          { workspace: "Blog", fileName: "zen-of-writing.md" },
        ],
      });
    });

    it("leaves everything as it was on Escape", async () => {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      const content = await startWithZenOpen();
      content.focus();

      fireEvent.keyDown(content, { code: "KeyT", key: "t", metaKey: true });
      const field = within(await screen.findByRole("dialog")).getByRole("textbox");
      fireEvent.change(field, { target: { value: "tauri" } });
      fireEvent.keyDown(field, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(editorContent()).toHaveTextContent("正文的第一行。");
      expect(screen.getByRole("button", { name: /^Blog/ })).toHaveAttribute("aria-pressed", "true");
      expect(content).toHaveFocus();
    });

    it("leaves Ctrl with the same letter to the editor", async () => {
      answerFromAVault({ workspace: "Blog", article: "zen-of-writing.md" });
      const content = await startWithZenOpen();
      const editorKeys = vi.fn();
      content.addEventListener("keydown", editorKeys);

      fireEvent.keyDown(content, { code: "KeyP", key: "p", ctrlKey: true });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(editorKeys).toHaveBeenCalledTimes(1);
    });
  });
});
