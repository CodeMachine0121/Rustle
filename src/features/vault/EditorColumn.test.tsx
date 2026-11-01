import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "../autosave/AutosaveSession";
import { SettingsSession } from "../settings/SettingsSession";
import { VimModeSession } from "../vim/VimModeSession";
import { EditorColumn } from "./EditorColumn";
import { INITIAL_VAULT_SNAPSHOT, type VaultSnapshot } from "./VaultSession";

const NOTHING_OPEN: VaultSnapshot = { ...INITIAL_VAULT_SNAPSHOT, selectedWorkspace: "Blog" };

function renderColumn(snapshot: VaultSnapshot, autosave = autosaveSession()) {
  return render(
    <CompositionProvider state={autosave.composition}>
      <EditorColumn snapshot={snapshot} autosave={autosave.session} vimModes={new VimModeSession(new SettingsSession({ readSettings: vi.fn(), writeSettings: vi.fn() }))} />
    </CompositionProvider>,
  );
}

function autosaveSession() {
  const composition = new CompositionState();
  const session = new AutosaveSession(composition, { saveBody: vi.fn(), readBody: vi.fn() });
  return { composition, session };
}

describe("EditorColumn", () => {
  it("offers nowhere to type while no article is open", () => {
    const { container } = renderColumn(NOTHING_OPEN);

    expect(screen.getByText("還沒有選取文章")).toBeInTheDocument();
    expect(container.querySelector("[contenteditable], textarea, input")).toBeNull();
  });

  it("shows the open article's body in an editable editor with its file name below", async () => {
    const autosave = autosaveSession();
    await act(() =>
      autosave.session.openArticle({
        article: { workspace: "Blog", fileName: "zen.md", body: "正文的第一行。", lastKnownModifiedAt: "" },
        title: "寫作的禪",
      }),
    );

    const { container } = renderColumn(
      { ...NOTHING_OPEN, selectedArticle: { workspace: "Blog", fileName: "zen.md" }, body: "正文的第一行。", openedDocument: "Blog/zen.md" },
      autosave,
    );

    const content = container.querySelector(".cm-content");
    expect(content).toHaveAttribute("contenteditable", "true");
    expect(content).toHaveTextContent("正文的第一行。");
    expect(content).not.toHaveTextContent("---");
    expect(screen.getByRole("contentinfo", { name: "儲存狀態列" })).toHaveTextContent("Blog❯zen.md");
  });

  it("says in one line that the article could not be read", () => {
    const { container } = renderColumn({ ...NOTHING_OPEN, bodyFailure: "not text" });

    expect(screen.getByRole("alert")).toHaveTextContent("讀不到這篇文章");
    expect(container.querySelector("[contenteditable]")).toBeNull();
  });
});
