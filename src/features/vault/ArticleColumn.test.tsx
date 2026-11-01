import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { ArticleColumn } from "./ArticleColumn";
import { INITIAL_VAULT_SNAPSHOT, type VaultSnapshot } from "./VaultSession";

const TAURI: ArticleSummary = {
  fileName: "tauri.md",
  title: "Tauri 與 Electron 的取捨",
  createdAt: "2026-08-20T14:32:05+08:00",
  updatedAt: "2026-08-20T14:32:05+08:00",
  category: ["技術筆記"],
  tags: ["tauri", "electron"],
  hasIncompleteMetadata: false,
};

const NO_TITLE: ArticleSummary = {
  fileName: "no-title.md",
  title: "no-title",
  createdAt: "",
  updatedAt: "",
  category: [],
  tags: [],
  hasIncompleteMetadata: true,
};

const BLOG: VaultSnapshot = {
  ...INITIAL_VAULT_SNAPSHOT,
  workspaces: [{ name: "Blog", articleCount: 2 }],
  selectedWorkspace: "Blog",
  articles: [NO_TITLE, TAURI],
};

function renderColumn(snapshot: VaultSnapshot, onSelect = vi.fn(), onCreateArticle = vi.fn()) {
  render(
    <CompositionProvider>
      <ArticleColumn snapshot={snapshot} onSelect={onSelect} onCreateArticle={onCreateArticle} />
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
  it("shows the title, creation date, category and tags of an article", () => {
    renderColumn(BLOG);

    const row = screen.getByRole("button", { name: /Tauri 與 Electron 的取捨/ });
    expect(row).toHaveTextContent("2026-08-20");
    expect(row).toHaveTextContent("技術筆記");
    expect(row).toHaveTextContent("tauri");
    expect(row).toHaveTextContent("electron");
    expect(row).not.toHaveTextContent("14:32");
    expect(row).not.toHaveTextContent("metadata 不完整");
  });

  it("marks an article whose metadata is incomplete", () => {
    renderColumn(BLOG);

    expect(screen.getByRole("button", { name: /no-title/ })).toHaveTextContent("metadata 不完整");
  });

  it("shows a creation time that does not start with a date as written", () => {
    renderColumn({ ...BLOG, articles: [{ ...TAURI, createdAt: "last summer" }] });

    expect(screen.getByRole("button", { name: /Tauri/ })).toHaveTextContent("last summer");
  });

  it("asks for the article that was clicked", () => {
    const onSelect = renderColumn(BLOG);

    fireEvent.click(screen.getByRole("button", { name: /Tauri/ }));

    expect(onSelect).toHaveBeenCalledWith("tauri.md");
  });

  it("marks only the selected article as selected", () => {
    renderColumn({ ...BLOG, selectedArticle: "tauri.md" });

    expect(screen.getByRole("button", { name: /Tauri/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /no-title/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("invites the user to create a first article in an empty workspace and opens the dialog from there", () => {
    const onCreateArticle = renderColumnForCreating({ ...BLOG, articles: [] });

    fireEvent.click(screen.getByRole("button", { name: "建立第一篇文章" }));

    expect(onCreateArticle).toHaveBeenCalledTimes(1);
  });

  it("offers a new article button in a selected workspace", () => {
    const onCreateArticle = renderColumnForCreating(BLOG);
    const newArticleButton = screen.getByRole("button", { name: "＋ 新文章" });
    expect(newArticleButton).toBeVisible();

    fireEvent.click(newArticleButton);

    expect(onCreateArticle).toHaveBeenCalledTimes(1);
  });

  it("offers no new article button without a selected workspace", () => {
    renderColumn({ ...BLOG, selectedWorkspace: null, articles: [] });

    expect(screen.queryByRole("button", { name: "＋ 新文章" })).not.toBeInTheDocument();
  });

  it("asks for a workspace when none is selected", () => {
    renderColumn({ ...BLOG, selectedWorkspace: null, articles: [] });

    expect(screen.getByText("選一個 workspace")).toBeInTheDocument();
  });

  it("says in one line that the articles could not be read", () => {
    renderColumn({ ...BLOG, articles: [], articleListFailure: "permission denied" });

    expect(screen.getByRole("alert")).toHaveTextContent("讀不到文章");
  });
});

const ZEN: ArticleSummary = {
  fileName: "zen.md",
  title: "Zen of Writing",
  createdAt: "2026-08-18T09:00:00+08:00",
  updatedAt: "2026-08-20T18:00:00+08:00",
  category: ["隨筆"],
  tags: [],
  hasIncompleteMetadata: false,
};

const DAILY: ArticleSummary = {
  fileName: "tauri-note.md",
  title: "日常",
  createdAt: "2026-08-19T22:00:00+08:00",
  updatedAt: "2026-08-19T22:00:00+08:00",
  category: [],
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
      <ArticleColumn snapshot={snapshot} onSelect={onSelect} onCreateArticle={onCreateArticle} />
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

  it("reorders by title without selecting anything and keeps the open article selected", () => {
    const { onSelect } = renderControlledColumn({ ...THREE, selectedArticle: "zen.md" });

    fireEvent.change(screen.getByRole("combobox", { name: "排序" }), { target: { value: "title" } });

    expect(rowTitles()).toEqual(["Tauri 與 Electron 的取捨", "Zen of Writing", "日常"]);
    expect(screen.getByRole("button", { name: /Zen of Writing/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(onSelect).not.toHaveBeenCalled();
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
    const { onSelect } = renderControlledColumn({ ...THREE, selectedArticle: "zen.md" });

    typeIntoFilter("技術");
    act(() => vi.advanceTimersByTime(150));

    expect(rowTitles()).toEqual(["Tauri 與 Electron 的取捨", "Zen of Writing"]);
    const openRow = screen.getByRole("button", { name: /Zen of Writing/ });
    expect(openRow).toHaveAttribute("aria-pressed", "true");
    expect(openRow).toHaveTextContent("開著・不符合篩選");
    expect(screen.getByRole("button", { name: /Tauri/ })).not.toHaveTextContent("不符合篩選");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("filters and orders together", () => {
    renderControlledColumn(THREE);

    fireEvent.change(screen.getByRole("combobox", { name: "排序" }), { target: { value: "title" } });
    typeIntoFilter("e");
    act(() => vi.advanceTimersByTime(150));

    expect(rowTitles()).toEqual(["Tauri 與 Electron 的取捨", "Zen of Writing"]);
  });
});
