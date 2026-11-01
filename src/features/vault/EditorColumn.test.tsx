import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { EditorColumn } from "./EditorColumn";
import { INITIAL_VAULT_SNAPSHOT, type VaultSnapshot } from "./VaultSession";

const NOTHING_OPEN: VaultSnapshot = { ...INITIAL_VAULT_SNAPSHOT, selectedWorkspace: "Blog" };

function renderColumn(snapshot: VaultSnapshot) {
  return render(
    <CompositionProvider>
      <EditorColumn snapshot={snapshot} />
    </CompositionProvider>,
  );
}

describe("EditorColumn", () => {
  it("offers nowhere to type while no article is open", () => {
    const { container } = renderColumn(NOTHING_OPEN);

    expect(screen.getByText("選一篇文章開始寫作")).toBeInTheDocument();
    expect(container.querySelector("[contenteditable], textarea, input")).toBeNull();
  });

  it("shows the body of the open article in an editable editor", () => {
    const { container } = renderColumn({ ...NOTHING_OPEN, selectedArticle: "zen.md", body: "正文的第一行。" });

    const content = container.querySelector(".cm-content");
    expect(content).toHaveAttribute("contenteditable", "true");
    expect(content).toHaveTextContent("正文的第一行。");
    expect(content).not.toHaveTextContent("---");
  });

  it("says in one line that the article could not be read", () => {
    const { container } = renderColumn({ ...NOTHING_OPEN, bodyFailure: "not text" });

    expect(screen.getByRole("alert")).toHaveTextContent("讀不到這篇文章");
    expect(container.querySelector("[contenteditable]")).toBeNull();
  });
});
