import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "../autosave/AutosaveSession";
import { EditorColumn } from "./EditorColumn";
import { INITIAL_VAULT_SNAPSHOT, type VaultSnapshot } from "./VaultSession";

const NOTHING_OPEN: VaultSnapshot = { ...INITIAL_VAULT_SNAPSHOT, selectedWorkspace: "Blog" };

function renderColumn(snapshot: VaultSnapshot, autosave = autosaveSession()) {
  return render(
    <CompositionProvider state={autosave.composition}>
      <EditorColumn snapshot={snapshot} autosave={autosave.session} />
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

    expect(screen.getByText("選一篇文章開始寫作")).toBeInTheDocument();
    expect(container.querySelector("[contenteditable], textarea, input")).toBeNull();
  });

  it("shows the open article's title and body in an editable editor", async () => {
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
    expect(screen.getByRole("banner")).toHaveTextContent("寫作的禪");
  });

  it("says in one line that the article could not be read", () => {
    const { container } = renderColumn({ ...NOTHING_OPEN, bodyFailure: "not text" });

    expect(screen.getByRole("alert")).toHaveTextContent("讀不到這篇文章");
    expect(container.querySelector("[contenteditable]")).toBeNull();
  });
});
