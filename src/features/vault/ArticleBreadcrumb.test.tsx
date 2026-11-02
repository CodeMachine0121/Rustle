import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import { ArticleBreadcrumb } from "./ArticleBreadcrumb";
import { INITIAL_VAULT_SNAPSHOT, type VaultSnapshot } from "./VaultSession";

const ZEN: ArticleSummary = {
  workspace: "讀書筆記",
  fileName: "zen.md",
  title: "寫作是修行",
  createdAt: "2026-11-02T09:00:00+08:00",
  updatedAt: "2026-11-02T09:00:00+08:00",
  status: "active",
  tags: [],
  hasIncompleteMetadata: false,
  excerpt: null,
};

const OPEN: VaultSnapshot = {
  ...INITIAL_VAULT_SNAPSHOT,
  selectedWorkspace: "讀書筆記",
  articles: [ZEN],
  selectedArticle: { workspace: "讀書筆記", fileName: "zen.md" },
};

function renderBreadcrumb(snapshot: VaultSnapshot, language: "zh" | "en" = "zh") {
  return render(
    <InterfaceLanguageProvider language={language}>
      <ArticleBreadcrumb snapshot={snapshot} />
    </InterfaceLanguageProvider>,
  );
}

describe("ArticleBreadcrumb", () => {
  it("names the workspace and the title of the open article, then its status", () => {
    renderBreadcrumb(OPEN);

    const breadcrumb = screen.getByRole("navigation", { name: "目前的文章" });
    expect(breadcrumb).toHaveTextContent("讀書筆記/寫作是修行進行中");
    expect(breadcrumb.querySelector(".status-pill .status-dot--active")).not.toBeNull();
  });

  it("speaks the interface language in the pill", () => {
    renderBreadcrumb({ ...OPEN, articles: [{ ...ZEN, status: "onHold" }] }, "en");

    expect(screen.getByRole("navigation", { name: "Current article" })).toHaveTextContent("On Hold");
  });

  it("has no pill for an article without a status", () => {
    renderBreadcrumb({ ...OPEN, articles: [{ ...ZEN, status: null }] });

    const breadcrumb = screen.getByRole("navigation", { name: "目前的文章" });
    expect(breadcrumb.querySelector(".status-pill")).toBeNull();
    expect(breadcrumb).not.toHaveTextContent("未標記");
  });

  it("shows nothing while no article is open", () => {
    const { container } = renderBreadcrumb({ ...OPEN, selectedArticle: null });

    expect(container).toBeEmptyDOMElement();
  });

  it("follows the title the list now gives the open article", () => {
    renderBreadcrumb({ ...OPEN, articles: [{ ...ZEN, title: "新標題" }] });

    expect(screen.getByRole("navigation", { name: "目前的文章" })).toHaveTextContent("新標題");
  });

  it("finds the open article in its own workspace when two share a file name", () => {
    renderBreadcrumb({
      ...OPEN,
      articles: [{ ...ZEN, workspace: "日記", title: "日記那篇" }, ZEN],
    });

    expect(screen.getByRole("navigation", { name: "目前的文章" })).toHaveTextContent("讀書筆記/寫作是修行");
  });
});
