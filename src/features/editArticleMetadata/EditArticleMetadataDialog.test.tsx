import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import type { ArticleDraft, MetadataEdit } from "../vault/VaultSession";
import { EditArticleMetadataDialog } from "./EditArticleMetadataDialog";

const TAURI: ArticleSummary = {
  workspace: "Blog",
  fileName: "tauri.md",
  title: "舊標題",
  createdAt: "2026-08-20T14:32:05+08:00",
  updatedAt: "2026-08-21T09:10:00+08:00",
  status: "active",
  tags: ["electron"],
  hasIncompleteMetadata: false,
};

function renderDialog({
  article = TAURI,
  onSave = vi.fn((draft: ArticleDraft): Promise<MetadataEdit> => {
    void draft;
    return Promise.resolve({ outcome: "updated" });
  }),
  onClose = vi.fn(),
  composition = new CompositionState(),
} = {}) {
  const view = render(
    <CompositionProvider state={composition}>
      <EditArticleMetadataDialog
        article={article}
        vocabulary={{ tags: ["electron", "技術筆記"] }}
        onSave={onSave}
        onClose={onClose}
      />
    </CompositionProvider>,
  );
  return { onSave, onClose, composition, container: view.container };
}

function field(label: string): HTMLInputElement {
  const input = screen.getByLabelText(label);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`${label} is not a text input`);
  }
  return input;
}

function saveButton() {
  return screen.getByRole("button", { name: "儲存" });
}

describe("EditArticleMetadataDialog", () => {
  it("opens with the article's title, status and tags filled in, and no Category field", () => {
    renderDialog();

    expect(field("標題")).toHaveValue("舊標題");
    expect(screen.getByRole("combobox", { name: "狀態" })).toHaveValue("active");
    expect(screen.queryByLabelText("分類")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移除 electron" })).toBeInTheDocument();
    expect(field("標題")).toHaveFocus();
  });

  it("shows both times as text in the file's own time zone, with no field to fill in", () => {
    const { container } = renderDialog();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("建立於 2026-08-20 14:32");
    expect(dialog).toHaveTextContent("更新於 2026-08-21 09:10");
    expect(dialog).toHaveTextContent("不能編輯");
    expect(container.querySelector('input[type="date"], input[type="time"], input[type="datetime-local"]')).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("keeps the time a file wrote after midnight in its own zone on its own date", () => {
    renderDialog({ article: { ...TAURI, createdAt: "2026-08-20T00:30:00+08:00" } });

    expect(screen.getByRole("dialog")).toHaveTextContent("建立於 2026-08-20 00:30");
  });

  it("says when the file does not record a time and shows an unusual one as written", () => {
    renderDialog({ article: { ...TAURI, createdAt: "", updatedAt: "last summer" } });

    expect(screen.getByRole("dialog")).toHaveTextContent("建立於 （檔案沒有記錄）");
    expect(screen.getByRole("dialog")).toHaveTextContent("更新於 last summer");
  });

  it("cannot save a blank title and says why", () => {
    const { onSave } = renderDialog();

    fireEvent.change(field("標題"), { target: { value: "   " } });
    fireEvent.click(saveButton());
    fireEvent.keyDown(field("標題"), { key: "Enter" });

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("請先輸入標題，「儲存」才會啟用。")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows No Status for an article without one and offers only the five choices", () => {
    renderDialog({ article: { ...TAURI, status: null } });

    expect(screen.getByRole("combobox", { name: "狀態" })).toHaveValue("noStatus");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "進行中",
      "暫停",
      "已完成",
      "已放棄",
      "未標記",
    ]);
  });

  it("saves the status chosen in place of the old one", () => {
    const { onSave } = renderDialog();

    fireEvent.change(screen.getByRole("combobox", { name: "狀態" }), { target: { value: "completed" } });
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({ title: "舊標題", status: "completed", tags: ["electron"] });
  });

  it("saves no status when No Status is chosen", () => {
    const { onSave } = renderDialog();

    fireEvent.change(screen.getByRole("combobox", { name: "狀態" }), { target: { value: "noStatus" } });
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({ title: "舊標題", status: null, tags: ["electron"] });
  });

  it("offers the scope's tags while typing a tag", () => {
    renderDialog({ article: { ...TAURI, tags: [] } });

    fireEvent.change(field("標籤"), { target: { value: "技" } });

    expect(screen.getByRole("button", { name: "技術筆記" })).toBeInTheDocument();
  });

  it("closes on Escape without saving", () => {
    const { onSave, onClose } = renderDialog();
    fireEvent.change(field("標題"), { target: { value: "新標題" } });

    fireEvent.keyDown(field("標題"), { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each([
    ["while the composition is going on", { key: "Enter" }, true],
    ["that the input method reports with its own key code", { key: "Enter", keyCode: 229 }, false],
  ])("does not save on an Enter %s", (_case, enter, composing) => {
    const { onSave } = renderDialog();
    if (composing) {
      fireEvent.compositionStart(field("標題"));
    }
    fireEvent.change(field("標題"), { target: { value: "新標題" } });

    fireEvent.keyDown(field("標題"), enter);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("neither saves on Enter nor closes on Escape while composing", () => {
    const { onSave, onClose } = renderDialog();

    fireEvent.compositionStart(field("標題"));
    fireEvent.change(field("標題"), { target: { value: "新標題" } });
    fireEvent.keyDown(field("標題"), { key: "Enter" });
    fireEvent.keyDown(field("標題"), { key: "Escape" });

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("saves the trimmed title and every chip, the unfinished one too, on Enter after composing", async () => {
    const { onSave, onClose } = renderDialog();
    fireEvent.compositionStart(field("標題"));
    fireEvent.change(field("標題"), { target: { value: "  新標題  " } });
    fireEvent.compositionEnd(field("標題"));
    fireEvent.change(field("標籤"), { target: { value: "tauri" } });

    fireEvent.keyDown(field("標題"), { key: "Enter" });

    expect(onSave).toHaveBeenCalledWith({ title: "新標題", status: "active", tags: ["electron", "tauri"] });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("stays open and says why when the update failed", async () => {
    const onSave = vi.fn((): Promise<MetadataEdit> => Promise.resolve({ outcome: "failed", reason: { kind: "reported", message: "磁碟已滿" } }));
    const { onClose } = renderDialog({ onSave });

    fireEvent.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("更新 metadata 失敗：磁碟已滿");
    expect(onClose).not.toHaveBeenCalled();
    expect(saveButton()).toBeEnabled();
  });
});
