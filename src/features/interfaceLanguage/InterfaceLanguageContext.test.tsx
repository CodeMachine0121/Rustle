import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { EditArticleMetadataDialog } from "../editArticleMetadata/EditArticleMetadataDialog";
import { ArticleColumn } from "../vault/ArticleColumn";
import { OperationFailureNotice } from "../vault/OperationFailureNotice";
import { INITIAL_VAULT_SNAPSHOT, type VaultSnapshot } from "../vault/VaultSession";
import { WorkspaceColumn } from "../vault/WorkspaceColumn";
import type { InterfaceLanguage } from "./interfaceLanguage";
import { InterfaceLanguageProvider } from "./InterfaceLanguageContext";

const MY_TRIP: ArticleSummary = {
  workspace: "Travel",
  fileName: "my-trip.md",
  title: "我的旅行",
  createdAt: "2026-08-21T14:30:00+08:00",
  updatedAt: "",
  status: null,
  tags: ["旅行"],
  hasIncompleteMetadata: true,
};

const TRAVEL: VaultSnapshot = {
  ...INITIAL_VAULT_SNAPSHOT,
  workspaces: [{ name: "Travel", articleCount: 1 }],
  selectedWorkspace: "Travel",
  articles: [MY_TRIP],
};

function inLanguage(language: InterfaceLanguage, children: React.ReactNode) {
  return (
    <CompositionProvider>
      <InterfaceLanguageProvider language={language}>{children}</InterfaceLanguageProvider>
    </CompositionProvider>
  );
}

function columns() {
  return (
    <>
      <WorkspaceColumn
        snapshot={TRAVEL}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
      <ArticleColumn
        snapshot={TRAVEL}
        onSelect={vi.fn()}
        onCreateArticle={vi.fn()}
        onEditMetadata={vi.fn()}
        onDelete={vi.fn()}
      />
    </>
  );
}

afterEach(() => {
  document.documentElement.lang = "";
});

describe("InterfaceLanguageProvider", () => {
  it("speaks English in the lists and keeps the writer's own words", () => {
    render(inLanguage("en", columns()));

    expect(screen.getByRole("button", { name: 'Delete "我的旅行"' })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: 'Rename "Travel"' })).toBeInTheDocument();
    expect(screen.getByText("incomplete metadata")).toBeInTheDocument();
    expect(screen.getByText("Travel")).toBeInTheDocument();
    expect(screen.getByText("旅行")).toBeInTheDocument();
    expect(screen.queryByText(/[一-鿿]/u, { selector: "button:not(.column-row), p, label, option" })).toBeNull();
  });

  it("speaks Chinese in the lists, with the same words the writer typed", () => {
    render(inLanguage("zh", columns()));

    expect(screen.getByRole("button", { name: "刪除 我的旅行" })).toBeInTheDocument();
    expect(screen.getByText("metadata 不完整")).toBeInTheDocument();
    expect(screen.getByText("Travel")).toBeInTheDocument();
    expect(screen.getByText("旅行")).toBeInTheDocument();
  });

  it("re-words a notice already on screen when the language changes", () => {
    const notice = (
      <OperationFailureNotice
        failure={{ operation: "deleteArticle", reason: { kind: "leavingRefused", refusal: "blockedByFailedSave" } }}
        onDismiss={vi.fn()}
      />
    );
    const { rerender } = render(inLanguage("zh", notice));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "刪除文章失敗：上一次儲存失敗。再按一次就會放掉未儲存的變更並繼續。",
    );

    rerender(inLanguage("en", notice));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not delete the article: The last save failed. Press again to discard the unsaved changes and continue.",
    );
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it.each([
    ["zh", "建立於 2026-08-21 14:30", "更新於 （檔案沒有記錄）"],
    ["en", "Created 2026-08-21 14:30", "Updated (not recorded in the file)"],
  ] as const)("shows the file's times as written in %s", (language, created, updated) => {
    render(
      inLanguage(
        language,
        <EditArticleMetadataDialog
          article={MY_TRIP}
          vocabulary={{ tags: [] }}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );

    expect(screen.getByRole("dialog")).toHaveTextContent(created);
    expect(screen.getByRole("dialog")).toHaveTextContent(updated);
  });

  it("tells assistive technology which language the screen speaks", () => {
    const { rerender } = render(inLanguage("en", <p>x</p>));
    expect(document.documentElement.lang).toBe("en");

    rerender(inLanguage("zh", <p>x</p>));

    expect(document.documentElement.lang).toBe("zh-Hant");
  });
});
