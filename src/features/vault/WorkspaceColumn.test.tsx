import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { INITIAL_VAULT_SNAPSHOT, type VaultSnapshot } from "./VaultSession";
import { WorkspaceColumn } from "./WorkspaceColumn";

const EMPTY = INITIAL_VAULT_SNAPSHOT;

const TWO_WORKSPACES: VaultSnapshot = {
  ...EMPTY,
  workspaces: [
    { name: "Blog", articleCount: 2 },
    { name: "Work", articleCount: 0 },
  ],
};

function renderColumn(
  snapshot: VaultSnapshot,
  {
    onSelect = vi.fn(),
    onRename = vi.fn((workspace: string, typedName: string) => {
      void workspace;
      void typedName;
      return Promise.resolve(true);
    }),
    onDelete = vi.fn(),
    state = new CompositionState(),
  } = {},
) {
  const view = render(
    <CompositionProvider state={state}>
      <WorkspaceColumn
        snapshot={snapshot}
        onSelect={onSelect}
        onRename={onRename}
        onDelete={onDelete}
      />
    </CompositionProvider>,
  );
  return {
    onSelect,
    onRename,
    onDelete,
    state,
    rerender: (next: VaultSnapshot) =>
      view.rerender(
        <CompositionProvider state={state}>
          <WorkspaceColumn
            snapshot={next}
            onSelect={onSelect}
                onRename={onRename}
            onDelete={onDelete}
          />
        </CompositionProvider>,
      ),
  };
}

function renameField(workspace: string): HTMLInputElement {
  const input = screen.getByRole("textbox", { name: `${workspace} 的新名稱` });
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("the rename field is not a text input");
  }
  return input;
}

describe("WorkspaceColumn", () => {
  it("shows each workspace with its article count", () => {
    renderColumn(TWO_WORKSPACES);

    expect(screen.getByRole("button", { name: /^Blog/ })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /^Work/ })).toHaveTextContent("0");
    expect(screen.getByLabelText("2 篇文章")).toBeInTheDocument();
  });

  it("marks each workspace with a folder before its name", () => {
    renderColumn(TWO_WORKSPACES);

    const row = screen.getByRole("button", { name: /^Blog/ });
    expect(row.firstElementChild).toHaveClass("lucide-folder");
    expect(row.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("still lists a workspace whose articles could not be counted", () => {
    renderColumn({ ...EMPTY, workspaces: [{ name: "Locked", articleCount: null }] });

    expect(screen.getByRole("button", { name: /^Locked/ })).toBeInTheDocument();
    expect(screen.getByLabelText("讀不到篇數")).toBeInTheDocument();
  });

  it("asks for the workspace that was clicked", () => {
    const { onSelect } = renderColumn(TWO_WORKSPACES);

    fireEvent.click(screen.getByRole("button", { name: /^Work/ }));

    expect(onSelect).toHaveBeenCalledWith("Work");
  });

  it("marks only the selected workspace as selected", () => {
    renderColumn({ ...TWO_WORKSPACES, selectedWorkspace: "Work" });

    expect(screen.getByRole("button", { name: /^Work/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Blog/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("invites the user to create a first workspace in an empty vault", () => {
    renderColumn(EMPTY);

    expect(screen.getByText("建立你的第一個 workspace")).toBeInTheDocument();
  });

  it("says in one line that the workspaces could not be read", () => {
    renderColumn({ ...EMPTY, workspaceListFailure: "permission denied" });

    expect(screen.getByRole("alert")).toHaveTextContent("讀不到 vault");
    expect(screen.queryByText("建立你的第一個 workspace")).not.toBeInTheDocument();
  });

  it("has no name field of its own for a new workspace", () => {
    renderColumn(TWO_WORKSPACES);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("offers to rename and to delete every workspace", () => {
    const { onDelete } = renderColumn(TWO_WORKSPACES);

    expect(screen.getByRole("button", { name: "重新命名 Blog" })).toHaveTextContent("重新命名");
    fireEvent.click(screen.getByRole("button", { name: "刪除 Work" }));

    expect(onDelete).toHaveBeenCalledWith("Work");
  });

  it("renames in place with the current name filled in when Enter is pressed", async () => {
    const { onRename } = renderColumn(TWO_WORKSPACES);
    fireEvent.click(screen.getByRole("button", { name: "重新命名 Blog" }));
    expect(renameField("Blog")).toHaveValue("Blog");

    fireEvent.change(renameField("Blog"), { target: { value: "Writing" } });
    fireEvent.keyDown(renameField("Blog"), { key: "Enter" });

    expect(onRename).toHaveBeenCalledWith("Blog", "Writing");
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Blog 的新名稱" })).not.toBeInTheDocument());
  });

  it("renames with the rename button too", () => {
    const { onRename } = renderColumn(TWO_WORKSPACES);
    fireEvent.click(screen.getByRole("button", { name: "重新命名 Blog" }));
    fireEvent.change(renameField("Blog"), { target: { value: "Writing" } });

    fireEvent.click(screen.getByRole("button", { name: "重新命名" }));

    expect(onRename).toHaveBeenCalledWith("Blog", "Writing");
  });

  it("does not rename on the Enter that picks a candidate during composition", () => {
    const { onRename } = renderColumn(TWO_WORKSPACES);
    fireEvent.click(screen.getByRole("button", { name: "重新命名 Blog" }));

    fireEvent.compositionStart(renameField("Blog"));
    fireEvent.change(renameField("Blog"), { target: { value: "筆記" } });
    fireEvent.keyDown(renameField("Blog"), { key: "Enter" });
    fireEvent.keyDown(renameField("Blog"), { key: "Escape" });

    expect(onRename).not.toHaveBeenCalled();
    expect(renameField("Blog")).toBeInTheDocument();
  });

  it("gives up renaming on Escape", () => {
    const { onRename } = renderColumn(TWO_WORKSPACES);
    fireEvent.click(screen.getByRole("button", { name: "重新命名 Blog" }));

    fireEvent.keyDown(renameField("Blog"), { key: "Escape" });

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Blog 的新名稱" })).not.toBeInTheDocument();
  });

  it("keeps the field open with the reason when the new name is rejected", async () => {
    const onRename = vi.fn(() => Promise.resolve(false));
    const { rerender } = renderColumn(TWO_WORKSPACES, { onRename });
    fireEvent.click(screen.getByRole("button", { name: "重新命名 Blog" }));
    fireEvent.change(renameField("Blog"), { target: { value: "Work" } });
    fireEvent.keyDown(renameField("Blog"), { key: "Enter" });
    await waitFor(() => expect(onRename).toHaveBeenCalled());

    rerender({ ...TWO_WORKSPACES, renameRejection: { workspace: "Blog", reason: "alreadyUsed" } });

    expect(renameField("Blog")).toHaveValue("Work");
    expect(screen.getByRole("alert")).toHaveTextContent("這個名稱已經有人用了，請換一個。");
  });
});
