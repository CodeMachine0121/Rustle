import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { ArticleColumn } from "./ArticleColumn";
import { SidebarFilter } from "../sidebar/SidebarFilter";
import { INITIAL_VAULT_SNAPSHOT, type VaultSnapshot } from "./VaultSession";

const TAURI: ArticleSummary = {
  workspace: "Blog",
  fileName: "tauri.md",
  title: "Tauri 與 Electron 的取捨",
  createdAt: "2026-08-20T14:32:05+08:00",
  updatedAt: "2026-08-20T14:32:05+08:00",
  status: "active",
  tags: ["tauri", "electron", "技術筆記"],
  hasIncompleteMetadata: false,
};

const NO_TITLE: ArticleSummary = {
  workspace: "Blog",
  fileName: "no-title.md",
  title: "no-title",
  createdAt: "",
  updatedAt: "",
  status: null,
  tags: [],
  hasIncompleteMetadata: true,
};

const BLOG: VaultSnapshot = {
  ...INITIAL_VAULT_SNAPSHOT,
  workspaces: [{ name: "Blog", articleCount: 2 }],
  selectedWorkspace: "Blog",
  articles: [NO_TITLE, TAURI],
};

function renderColumn(
  snapshot: VaultSnapshot,
  onSelect = vi.fn(),
  onCreateArticle = vi.fn(),
  { onEditMetadata = vi.fn(), onDelete = vi.fn() } = {},
) {
  render(
    <CompositionProvider>
      <ArticleColumn
        snapshot={snapshot}
        onSelect={onSelect}
        onCreateArticle={onCreateArticle}
        onEditMetadata={onEditMetadata}
        onDelete={onDelete}
      />
    </CompositionProvider>,
  );
  return onSelect;
}

function renderColumnForCreating(snapshot: VaultSnapshot) {
  const onCreateArticle = vi.fn();
  renderColumn(snapshot, vi.fn(), onCreateArticle);
  return onCreateArticle;
}

describe("ArticleColumn", () => {
  it("shows the title, creation date, status and tags of an article, but not its workspace", () => {
    renderColumn(BLOG);

    const row = screen.getByRole("button", { name: /^Tauri 與 Electron 的取捨/ });
    expect(row).toHaveTextContent("2026-08-20");
    expect(row).toHaveTextContent("進行中");
    expect(row).not.toHaveTextContent("Blog");
    expect(row).toHaveTextContent("tauri");
    expect(row).toHaveTextContent("electron");
    expect(row).not.toHaveTextContent("14:32");
    expect(row).not.toHaveTextContent("metadata 不完整");
  });

  it("marks an article whose metadata is incomplete", () => {
    renderColumn(BLOG);

    expect(screen.getByRole("button", { name: /^no-title/ })).toHaveTextContent("metadata 不完整");
  });

  it("shows a creation time that does not start with a date as written", () => {
    renderColumn({ ...BLOG, articles: [{ ...TAURI, createdAt: "last summer" }] });

    expect(screen.getByRole("button", { name: /^Tauri/ })).toHaveTextContent("last summer");
  });

  it("asks for the article that was clicked", () => {
    const onSelect = renderColumn(BLOG);

    fireEvent.click(screen.getByRole("button", { name: /^Tauri/ }));

    expect(onSelect).toHaveBeenCalledWith(TAURI);
  });

  it("marks only the selected article as selected", () => {
    renderColumn({ ...BLOG, selectedArticle: { workspace: "Blog", fileName: "tauri.md" } });

    expect(screen.getByRole("button", { name: /^Tauri/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^no-title/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the filter and the new article icon above an empty workspace and only guides below it", () => {
    const onCreateArticle = renderColumnForCreating({ ...BLOG, articles: [] });

    expect(screen.getByRole("textbox", { name: "篩選文章" })).toBeInTheDocument();
    expect(screen.getByText("建立第一篇文章").tagName).toBe("P");
    expect(screen.queryByRole("button", { name: "建立第一篇文章" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "新文章" }));

    expect(onCreateArticle).toHaveBeenCalledTimes(1);
  });

  it("offers a new article icon in a selected workspace", () => {
    const onCreateArticle = renderColumnForCreating(BLOG);
    const newArticleButton = screen.getByRole("button", { name: "新文章" });
    expect(newArticleButton).toBeVisible();
    expect(newArticleButton).toHaveTextContent("");
    expect(newArticleButton.querySelector("svg")).not.toBeNull();
    expect(newArticleButton).toBeVisible();

    fireEvent.click(newArticleButton);

    expect(onCreateArticle).toHaveBeenCalledTimes(1);
  });

  it("offers no new article button without a selected workspace", () => {
    renderColumn({ ...BLOG, selectedWorkspace: null, articles: [] });

    expect(screen.queryByRole("button", { name: "新文章" })).not.toBeInTheDocument();
  });

  it("asks for a workspace when none is selected", () => {
    renderColumn({ ...BLOG, selectedWorkspace: null, articles: [] });

    expect(screen.getByText("先選一個 workspace")).toBeInTheDocument();
  });

  it("says in one line that the articles could not be read", () => {
    renderColumn({ ...BLOG, articles: [], articleListFailure: "permission denied" });

    expect(screen.getByRole("alert")).toHaveTextContent("讀不到這個 workspace");
  });

  it("offers to edit the metadata of and to delete every article", () => {
    const onEditMetadata = vi.fn();
    const onDelete = vi.fn();
    renderColumn(BLOG, vi.fn(), vi.fn(), { onEditMetadata, onDelete });

    fireEvent.click(screen.getByRole("button", { name: "編輯 Tauri 與 Electron 的取捨 的 metadata" }));
    fireEvent.click(screen.getByRole("button", { name: "刪除 no-title" }));

    expect(onEditMetadata).toHaveBeenCalledWith(TAURI);
    expect(onDelete).toHaveBeenCalledWith(NO_TITLE);
  });

  it("puts a pencil in the top corner and a trash can in the bottom corner of each card, as icons only", () => {
    renderColumn(BLOG);

    const pencil = screen.getByRole("button", { name: "編輯 Tauri 與 Electron 的取捨 的 metadata" });
    const trash = screen.getByRole("button", { name: "刪除 Tauri 與 Electron 的取捨" });
    expect(pencil).toHaveClass("card-action--top");
    expect(trash).toHaveClass("card-action--bottom");
    expect(pencil).toHaveTextContent("");
    expect(trash).toHaveTextContent("");
    expect(pencil.closest("li")).toBe(trash.closest("li"));
  });

  it("lets the keyboard reach the card's row, then its pencil, then its trash can", () => {
    renderColumn({ ...BLOG, articles: [TAURI] });

    const reachable = Array.from(document.querySelectorAll<HTMLElement>(".article-card button")).filter(
      (button) => button.tabIndex >= 0,
    );

    expect(reachable.map((button) => button.getAttribute("aria-label") ?? button.className)).toEqual([
      expect.stringContaining("article-row"),
      "編輯 Tauri 與 Electron 的取捨 的 metadata",
      "刪除 Tauri 與 Electron 的取捨",
    ]);
  });

  it("starts the card's detail line with the status, then the date, then the tags", () => {
    renderColumn(BLOG);

    expect(metaOf(/^Tauri/)).toEqual(["進行中", "2026-08-20", "tauri", "electron", "技術筆記"]);
  });

  it("says No Status for an article without one", () => {
    renderColumn({ ...BLOG, articles: [{ ...TAURI, status: null }] });

    expect(metaOf(/^Tauri/)[0]).toBe("未標記");
  });

  it("lines up Active, 2026-08-21, #go and #api from the left, in that order", () => {
    renderInEnglish({
      ...TAURI,
      status: "active",
      createdAt: "2026-08-21T09:00:00+08:00",
      tags: ["go", "api"],
    });

    expect(metaOf(/^Tauri/)).toEqual(["Active", "2026-08-21", "go", "api"]);
    expect(screen.getByRole("button", { name: /^Tauri/ }).querySelectorAll(".row-meta .row-tag")).toHaveLength(2);
  });

  it("says No Status in English, as the sidebar does", () => {
    renderInEnglish({ ...TAURI, status: null });

    expect(metaOf(/^Tauri/)).toEqual(["No Status", "2026-08-20", "tauri", "electron", "技術筆記"]);
  });

  it("shows only the status for an article with no date and no tags", () => {
    renderColumn({ ...BLOG, articles: [{ ...NO_TITLE, hasIncompleteMetadata: false }] });

    expect(metaOf(/^no-title/)).toEqual(["未標記"]);
  });

  it("keeps the status first and the incomplete and open markers last", () => {
    renderColumn({
      ...BLOG,
      articles: [{ ...TAURI, hasIncompleteMetadata: true }, NO_TITLE],
      sidebarFilter: SidebarFilter.NONE.toggleStatus("noStatus"),
      selectedArticle: { workspace: "Blog", fileName: "tauri.md" },
    });

    expect(metaOf(/^Tauri/)).toEqual([
      "進行中",
      "2026-08-20",
      "tauri",
      "electron",
      "技術筆記",
      "metadata 不完整",
      "開著・不符合篩選",
    ]);
  });

  it("offers no sort order and no emoji in the filter", () => {
    renderColumn(BLOG);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: "篩選文章" });
    expect(field).toHaveAttribute("placeholder", "filter");
    expect(field.closest("label")?.querySelector("svg")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/🔍|＋|篩選…/u);
  });
});

function renderInEnglish(article: ArticleSummary) {
  render(
    <InterfaceLanguageProvider language="en">
      <CompositionProvider>
        <ArticleColumn
          snapshot={{ ...BLOG, articles: [article] }}
          onSelect={vi.fn()}
          onCreateArticle={vi.fn()}
          onEditMetadata={vi.fn()}
          onDelete={vi.fn()}
        />
      </CompositionProvider>
    </InterfaceLanguageProvider>,
  );
}

function metaOf(title: RegExp): string[] {
  const meta = screen.getByRole("button", { name: title }).querySelector(".row-meta");
  return Array.from(meta?.children ?? []).map((detail) => detail.textContent ?? "");
}

const ZEN: ArticleSummary = {
  workspace: "Blog",
  fileName: "zen.md",
  title: "Zen of Writing",
  createdAt: "2026-08-18T09:00:00+08:00",
  updatedAt: "2026-08-20T18:00:00+08:00",
  status: null,
  tags: [],
  hasIncompleteMetadata: false,
};

const DAILY: ArticleSummary = {
  workspace: "Blog",
  fileName: "tauri-note.md",
  title: "日常",
  createdAt: "2026-08-19T22:00:00+08:00",
  updatedAt: "2026-08-19T22:00:00+08:00",
  status: null,
  tags: [],
  hasIncompleteMetadata: false,
};

const THREE: VaultSnapshot = { ...BLOG, articles: [TAURI, ZEN, DAILY] };

function renderControlledColumn(snapshot: VaultSnapshot) {
  const composition = new CompositionState();
  const onSelect = vi.fn();
  const onCreateArticle = vi.fn();
  render(
    <CompositionProvider state={composition}>
      <ArticleColumn
        snapshot={snapshot}
        onSelect={onSelect}
        onCreateArticle={onCreateArticle}
        onEditMetadata={vi.fn()}
        onDelete={vi.fn()}
      />
    </CompositionProvider>,
  );
  return { composition, onSelect, onCreateArticle };
}

function rowTitles(): string[] {
  return Array.from(document.querySelectorAll(".article-row .row-title")).map(
    (title) => title.textContent ?? "",
  );
}

function filterField(): HTMLElement {
  return screen.getByRole("textbox", { name: "篩選文章" });
}

function typeIntoFilter(text: string) {
  fireEvent.change(filterField(), { target: { value: text } });
}

describe("ArticleColumn ordering and filtering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the newest article first by default", () => {
    renderControlledColumn(THREE);

    expect(rowTitles()).toEqual(["Tauri 與 Electron 的取捨", "日常", "Zen of Writing"]);
  });

  it("filters once typing has paused for the shared delay", () => {
    renderControlledColumn(THREE);

    typeIntoFilter("z");
    act(() => vi.advanceTimersByTime(50));
    typeIntoFilter("ze");
    act(() => vi.advanceTimersByTime(50));
    typeIntoFilter("zen");
    act(() => vi.advanceTimersByTime(149));
    expect(rowTitles()).toHaveLength(3);

    act(() => vi.advanceTimersByTime(1));
    expect(rowTitles()).toEqual(["Zen of Writing"]);
  });

  it("shows the typed text at once", () => {
    renderControlledColumn(THREE);

    typeIntoFilter("z");

    expect(filterField()).toHaveValue("z");
  });

  it("does not filter while composing and filters once the composition has ended", () => {
    const { composition } = renderControlledColumn(THREE);

    fireEvent.compositionStart(filterField());
    typeIntoFilter("ㄐ");
    typeIntoFilter("技術");
    act(() => vi.advanceTimersByTime(2000));
    expect(composition.isComposing).toBe(true);
    expect(rowTitles()).toHaveLength(3);

    fireEvent.compositionEnd(filterField());
    act(() => vi.advanceTimersByTime(150));
    expect(rowTitles()).toEqual(["Tauri 與 Electron 的取捨"]);
  });

  it("leaves an Enter that confirms a candidate to the input method", () => {
    renderControlledColumn(THREE);
    fireEvent.compositionStart(filterField());
    typeIntoFilter("技術");

    const notCancelled = fireEvent.keyDown(filterField(), { key: "Enter", keyCode: 229 });

    expect(notCancelled).toBe(true);
    expect(rowTitles()).toHaveLength(3);
  });

  it("applies the typed text at once on Enter", () => {
    renderControlledColumn(THREE);
    typeIntoFilter("zen");

    const notCancelled = fireEvent.keyDown(filterField(), { key: "Enter", keyCode: 13 });

    expect(notCancelled).toBe(false);
    expect(filterField().closest("form")).toBeNull();
    expect(rowTitles()).toEqual(["Zen of Writing"]);
  });

  it("does nothing on other keys", () => {
    renderControlledColumn(THREE);
    typeIntoFilter("zen");

    const notCancelled = fireEvent.keyDown(filterField(), { key: "a", keyCode: 65 });

    expect(notCancelled).toBe(true);
    expect(rowTitles()).toHaveLength(3);
  });

  it("clears the filter on Escape", () => {
    renderControlledColumn(THREE);
    typeIntoFilter("zen");
    act(() => vi.advanceTimersByTime(150));

    fireEvent.keyDown(filterField(), { key: "Escape", keyCode: 27 });

    expect(filterField()).toHaveValue("");
    expect(rowTitles()).toHaveLength(3);
  });

  it("leaves an Escape during composition to the input method", () => {
    const { composition } = renderControlledColumn(THREE);
    typeIntoFilter("zen");
    act(() => vi.advanceTimersByTime(150));
    composition.start();

    fireEvent.keyDown(filterField(), { key: "Escape", keyCode: 27 });

    expect(filterField()).toHaveValue("zen");
    expect(rowTitles()).toEqual(["Zen of Writing"]);
  });

  it("ends the shared composition when the field loses focus", () => {
    const { composition } = renderControlledColumn(THREE);
    fireEvent.compositionStart(filterField());

    fireEvent.blur(filterField());

    expect(composition.isComposing).toBe(false);
  });

  it("says that nothing matches instead of inviting a first article", () => {
    renderControlledColumn(THREE);

    typeIntoFilter("xyz");
    act(() => vi.advanceTimersByTime(150));

    expect(rowTitles()).toEqual([]);
    expect(screen.getByText("沒有符合的文章")).toBeInTheDocument();
    expect(screen.queryByText("建立第一篇文章")).not.toBeInTheDocument();
  });

  it("keeps the open article marked when the filter leaves it out, without selecting anything", () => {
    const { onSelect } = renderControlledColumn({ ...THREE, selectedArticle: { workspace: "Blog", fileName: "zen.md" } });

    typeIntoFilter("技術");
    act(() => vi.advanceTimersByTime(150));

    expect(rowTitles()).toEqual(["Tauri 與 Electron 的取捨", "Zen of Writing"]);
    const openRow = screen.getByRole("button", { name: /^Zen of Writing/ });
    expect(openRow).toHaveAttribute("aria-pressed", "true");
    expect(openRow).toHaveTextContent("開著・不符合篩選");
    expect(screen.getByRole("button", { name: /^Tauri/ })).not.toHaveTextContent("不符合篩選");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps the newest first among the filtered articles", () => {
    renderControlledColumn(THREE);

    typeIntoFilter("i");
    act(() => vi.advanceTimersByTime(150));

    expect(rowTitles()).toEqual(["Tauri 與 Electron 的取捨", "Zen of Writing"]);
  });
});

describe("ArticleColumn with the sidebar and All Notes", () => {
  const WORK_TAURI: ArticleSummary = { ...TAURI, workspace: "Work", status: "completed", tags: [] };
  const ALL_NOTES: VaultSnapshot = {
    ...INITIAL_VAULT_SNAPSHOT,
    showsAllNotes: true,
    articles: [TAURI, WORK_TAURI],
  };

  it("lists the scope's articles that match the sidebar filter", () => {
    renderColumn({ ...BLOG, sidebarFilter: SidebarFilter.NONE.toggleStatus("active") });

    expect(rowTitles()).toEqual(["Tauri 與 Electron 的取捨"]);
  });

  it("says that nothing matches when the sidebar filter leaves nothing", () => {
    renderColumn({ ...BLOG, sidebarFilter: SidebarFilter.NONE.toggleStatus("dropped") });

    expect(rowTitles()).toEqual([]);
    expect(screen.getByText("沒有符合的文章")).toBeInTheDocument();
  });

  it("keeps the open article that the sidebar filter leaves out, marked as the open one", () => {
    renderColumn({
      ...BLOG,
      sidebarFilter: SidebarFilter.NONE.toggleStatus("active"),
      selectedArticle: { workspace: "Blog", fileName: "no-title.md" },
    });

    expect(screen.getByRole("button", { name: /^no-title/ })).toHaveTextContent("開著・不符合篩選");
  });

  it("lists two articles with the same file name from two workspaces as two rows, each naming its workspace", () => {
    const onSelect = renderColumn(ALL_NOTES);

    const rows = screen.getAllByRole("button", { name: /^Tauri/ });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.querySelector(".row-workspace")?.textContent).sort()).toEqual(["Blog", "Work"]);

    const workRow = rows.find((row) => row.textContent?.includes("Work"));
    if (workRow === undefined) {
      throw new Error("the Work row is missing");
    }
    fireEvent.click(workRow);
    expect(onSelect).toHaveBeenCalledWith(WORK_TAURI);
  });

  it("marks only the open row of the right workspace", () => {
    renderColumn({ ...ALL_NOTES, selectedArticle: { workspace: "Work", fileName: "tauri.md" } });

    const pressed = screen.getAllByRole("button", { pressed: true });
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent("Work");
  });

  it("refuses a new article under All Notes and asks for a workspace, without opening the dialog", () => {
    const onCreateArticle = vi.fn();
    renderColumn(ALL_NOTES, vi.fn(), onCreateArticle);

    fireEvent.click(screen.getByRole("button", { name: "新文章" }));

    expect(onCreateArticle).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("請先在左邊選一個 workspace");
  });

  it("says the vault has no articles under All Notes instead of inviting a first one", () => {
    renderColumn({ ...ALL_NOTES, articles: [] });

    expect(screen.getByText("vault 裡還沒有文章")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "建立第一篇文章" })).not.toBeInTheDocument();
  });
});
