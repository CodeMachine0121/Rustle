import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceNameRejection } from "../../ipc/createWorkspaceOutcome";
import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { NewWorkspaceEntry } from "./NewWorkspaceEntry";

type Problems = { rejection?: WorkspaceNameRejection | null; failure?: string | null };

function renderEntry(
  onCreate: (typedName: string) => Promise<boolean> = vi.fn(() => Promise.resolve(true)),
  state = new CompositionState(),
  { rejection = null, failure = null }: Problems = {},
) {
  const entry = (problems: Problems) => (
    <CompositionProvider state={state}>
      <NewWorkspaceEntry
        rejection={problems.rejection ?? null}
        failure={problems.failure ?? null}
        onCreate={onCreate}
      />
    </CompositionProvider>
  );
  const view = render(entry({ rejection, failure }));
  return { onCreate, state, rerender: (problems: Problems) => view.rerender(entry(problems)) };
}

function openDialog(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "新增 workspace" }));
  return screen.getByRole("textbox", { name: "新 workspace 名稱" });
}

describe("NewWorkspaceEntry", () => {
  it("shows only a plus icon until it is pressed", () => {
    renderEntry();

    const button = screen.getByRole("button", { name: "新增 workspace" });
    expect(button).toHaveTextContent("");
    expect(button.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a dialog with a name field, 建立 and 取消, the keyboard in the field", () => {
    renderEntry();

    const field = openDialog();

    expect(screen.getByRole("dialog", { name: "新增 workspace" })).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(screen.getByRole("button", { name: "建立" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  it.each([
    ["建立", () => fireEvent.click(screen.getByRole("button", { name: "建立" }))],
    ["Enter", (field: HTMLElement) => fireEvent.keyDown(field, { key: "Enter" })],
  ])("creates the typed name with %s and closes once it exists", async (_way, submit) => {
    const { onCreate } = renderEntry();
    const field = openDialog();
    fireEvent.change(field, { target: { value: "Notes" } });

    submit(field);

    expect(onCreate).toHaveBeenCalledWith("Notes");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "新增 workspace" })).toHaveFocus();
  });

  it.each([
    ["alreadyUsed", "這個名稱已經有人用了，請換一個。"],
    ["containsPathSeparator", "名稱不能包含 / 或 \\，一個 workspace 就是一層資料夾。"],
    ["reserved", "這是保留名稱（images，或以 . 開頭的名稱），請換一個。"],
    ["empty", "請先輸入 workspace 名稱。"],
  ] as const)("stays open with the %s reason and the typed name", async (reason, explanation) => {
    const onCreate = vi.fn(() => Promise.resolve(false));
    const { rerender } = renderEntry(onCreate);
    const field = openDialog();
    fireEvent.change(field, { target: { value: "Blog" } });

    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });
    rerender({ rejection: reason });

    expect(screen.getByRole("dialog")).toContainElement(screen.getByRole("alert"));
    expect(screen.getByRole("alert")).toHaveTextContent(explanation);
    expect(field).toHaveValue("Blog");
  });

  it("shows inside the dialog why a workspace could not be created", async () => {
    const { rerender } = renderEntry(vi.fn(() => Promise.resolve(false)));
    const field = openDialog();

    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });
    rerender({ failure: "disk full" });

    expect(screen.getByRole("alert")).toHaveTextContent("disk full");
  });

  it("does not show an earlier refusal when it is opened again", () => {
    renderEntry(vi.fn(() => Promise.resolve(false)), new CompositionState(), { rejection: "alreadyUsed" });

    openDialog();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["取消", () => fireEvent.click(screen.getByRole("button", { name: "取消" }))],
    ["Esc", () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })],
    ["the backdrop", () => fireEvent.click(screen.getByTestId("new-workspace-backdrop"))],
  ])("drops a half-typed name when closed with %s and opens blank next time", (_way, close) => {
    const { onCreate } = renderEntry();
    fireEvent.change(openDialog(), { target: { value: "半" } });

    close();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
    expect(openDialog()).toHaveValue("");
  });

  it("leaves Enter and Esc that belong to the input method alone", () => {
    const { onCreate, state } = renderEntry();
    const field = openDialog();

    fireEvent.compositionStart(field);
    fireEvent.change(field, { target: { value: "筆記" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });

    expect(state.isComposing).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("submits on the Enter after the composition ended", () => {
    const { onCreate, state } = renderEntry();
    const field = openDialog();

    fireEvent.compositionStart(field);
    fireEvent.change(field, { target: { value: "筆記" } });
    fireEvent.compositionEnd(field);
    fireEvent.keyDown(field, { key: "Enter" });

    expect(state.isComposing).toBe(false);
    expect(onCreate).toHaveBeenCalledWith("筆記");
  });

  it("does not submit on Enter on the 取消 button or on other keys", () => {
    const { onCreate } = renderEntry();
    const field = openDialog();
    fireEvent.change(field, { target: { value: "Notes" } });

    fireEvent.keyDown(field, { key: "a" });
    fireEvent.keyDown(screen.getByRole("button", { name: "取消" }), { key: "Enter" });

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("ends a composition whose end never arrived when the field loses focus", () => {
    const { state } = renderEntry();
    const field = openDialog();

    fireEvent.compositionStart(field);
    fireEvent.blur(field);

    expect(state.isComposing).toBe(false);
  });
});
