import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { ConfirmDeletionDialog } from "./ConfirmDeletionDialog";

function renderDialog(composition = new CompositionState()) {
  const onConfirm = vi.fn(() => Promise.resolve());
  const onCancel = vi.fn();
  render(
    <CompositionProvider state={composition}>
      <ConfirmDeletionDialog heading="刪除「Zen」？" confirmLabel="刪除文章" onConfirm={onConfirm} onCancel={onCancel}>
        <p>這篇文章會移到系統垃圾桶。</p>
      </ConfirmDeletionDialog>
    </CompositionProvider>,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDeletionDialog", () => {
  it("asks first, with the keyboard on cancel, and deletes nothing yet", () => {
    const { onConfirm } = renderDialog();

    expect(screen.getByRole("alertdialog", { name: "刪除「Zen」？" })).toHaveAccessibleDescription(
      "這篇文章會移到系統垃圾桶。",
    );
    expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("deletes nothing when cancelled", () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("deletes nothing on Escape or Enter", () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: "取消" }), { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("stays open on an Escape the input method owns", () => {
    const composition = new CompositionState();
    const { onCancel } = renderDialog(composition);
    composition.start();

    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("deletes once when confirmed and cannot be cancelled meanwhile", async () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "刪除文章" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "刪除文章" })).toBeDisabled());
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
