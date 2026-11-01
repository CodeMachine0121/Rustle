import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
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
  render(<ArticleColumn snapshot={snapshot} onSelect={onSelect} onCreateArticle={onCreateArticle} />);
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
