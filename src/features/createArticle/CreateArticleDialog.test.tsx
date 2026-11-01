import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import type { ArticleVocabulary } from "../articleMetadata/articleVocabulary";
import type { ArticleCreation, ArticleDraft } from "../vault/VaultSession";
import { CreateArticleDialog } from "./CreateArticleDialog";

const BLOG_VOCABULARY: ArticleVocabulary = { tags: ["electron"] };

function renderDialog({
  onCreate = vi.fn((draft: ArticleDraft): Promise<ArticleCreation> => {
    void draft;
    return Promise.resolve({ outcome: "created" });
  }),
  onClose = vi.fn(),
  composition = new CompositionState(),
  openedAt = new Date(2026, 7, 20, 14, 32, 5),
} = {}) {
  const view = render(
    <CompositionProvider state={composition}>
      <CreateArticleDialog
        workspace="Blog"
        openedAt={openedAt}
        vocabulary={BLOG_VOCABULARY}
        onCreate={onCreate}
        onClose={onClose}
      />
    </CompositionProvider>,
  );
  return { onCreate, onClose, composition, container: view.container };
}

function field(label: string): HTMLInputElement {
  const input = screen.getByLabelText(label);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`${label} is not a text input`);
  }
  return input;
}

function type(label: string, text: string) {
  fireEvent.change(field(label), { target: { value: text } });
}

function createButton() {
  return screen.getByRole("button", { name: "建立" });
}

describe("CreateArticleDialog", () => {
  it("has a Title field, a Status choice and a multi-value Tags field, and no Category field", () => {
    renderDialog();

    expect(field("標題")).toHaveAttribute("type", "text");
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.queryByLabelText("分類")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "狀態" })).toHaveValue("noStatus");
    for (const value of ["一", "二"]) {
      type("標籤", value);
      fireEvent.keyDown(field("標籤"), { key: "Enter" });
    }
    expect(screen.getAllByRole("button", { name: /^移除/ })).toHaveLength(2);
  });

  it("offers only the four statuses and No Status, with nothing to type a status into", () => {
    renderDialog();

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Active", "On Hold", "Completed", "Dropped", "No Status"]);
  });

  it("shows when the article is created as text, with no field to fill in", () => {
    const { container } = renderDialog();

    expect(screen.getByRole("dialog")).toHaveTextContent("建立於 2026-08-20 14:32");
    expect(container.querySelector('input[type="date"], input[type="time"], input[type="datetime-local"]')).toBeNull();
  });

  it("puts the keyboard in the Title field when it opens", () => {
    renderDialog();

    expect(field("標題")).toHaveFocus();
  });

  it("cannot create without a title and says why", () => {
    renderDialog();

    expect(createButton()).toBeDisabled();
    expect(screen.getByText("請先輸入標題，「建立」才會啟用。")).toBeInTheDocument();
  });

  it("treats a title of only spaces as no title", () => {
    renderDialog();

    type("標題", "   ");

    expect(createButton()).toBeDisabled();
  });

  it("can create once a title is typed", () => {
    renderDialog();

    type("標題", "Zen of Writing");

    expect(createButton()).toBeEnabled();
    expect(screen.queryByText("請先輸入標題，「建立」才會啟用。")).not.toBeInTheDocument();
  });

  it("closes on Esc without asking to create anything", () => {
    const { onCreate, onClose } = renderDialog();
    type("標題", "Zen of Writing");

    fireEvent.keyDown(field("標題"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("closes on cancel without asking to create anything", () => {
    const { onCreate, onClose } = renderDialog();
    type("標題", "Zen of Writing");

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("leaves Esc to the input method while it is composing", () => {
    const { onClose } = renderDialog();
    fireEvent.compositionStart(field("標題"));

    fireEvent.keyDown(field("標題"), { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not create on an Enter that picks a word in the title", () => {
    const { onCreate } = renderDialog();
    fireEvent.compositionStart(field("標題"));
    type("標題", "ㄊㄞˊ");

    fireEvent.keyDown(field("標題"), { key: "Enter" });

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("creates once on the Enter after the word is picked", async () => {
    const { onCreate } = renderDialog();
    fireEvent.compositionStart(field("標題"));
    type("標題", "台灣");
    fireEvent.compositionEnd(field("標題"));

    await act(async () => {
      fireEvent.keyDown(field("標題"), { key: "Enter" });
      fireEvent.keyDown(field("標題"), { key: "Enter" });
    });

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({ title: "台灣", status: null, tags: [] });
  });

  it("does not create on an Enter that says it belongs to a composition", () => {
    const { onCreate } = renderDialog();
    type("標題", "台");

    fireEvent.keyDown(field("標題"), { key: "Enter", isComposing: true });

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("adds a chip but does not create on the Enter after a word is picked in Tags", () => {
    const { onCreate } = renderDialog();
    type("標題", "Zen");
    fireEvent.compositionStart(field("標籤"));
    type("標籤", "台灣");
    fireEvent.compositionEnd(field("標籤"));

    fireEvent.keyDown(field("標籤"), { key: "Enter" });

    expect(screen.getByRole("button", { name: "移除 台灣" })).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("tells the shared state about a composition in the title and ends it when the field is left", () => {
    const { composition } = renderDialog();

    fireEvent.compositionStart(field("標題"));
    expect(composition.isComposing).toBe(true);
    fireEvent.compositionEnd(field("標題"));
    expect(composition.isComposing).toBe(false);

    fireEvent.compositionStart(field("標題"));
    fireEvent.blur(field("標題"));
    expect(composition.isComposing).toBe(false);
  });

  it("has no form that could submit by itself", () => {
    const { container } = renderDialog();

    expect(container.querySelector("form")).toBeNull();
  });

  it("offers the tags the scope already uses while typing in Tags", () => {
    renderDialog();

    type("標籤", "e");

    expect(screen.getByRole("list", { name: "標籤 候選" })).toHaveTextContent("electron");
  });

  it("sends the trimmed title and every chip", async () => {
    const { onCreate } = renderDialog();
    type("標題", "  Zen of Writing  ");
    fireEvent.change(screen.getByRole("combobox", { name: "狀態" }), { target: { value: "active" } });
    type("標籤", "electron");
    fireEvent.keyDown(field("標籤"), { key: "Enter" });

    await act(async () => fireEvent.click(createButton()));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Zen of Writing",
      status: "active",
      tags: ["electron"],
    });
  });

  it("sends text not yet turned into a chip as a chip", async () => {
    const { onCreate } = renderDialog();
    type("標題", "Zen of Writing");
    type("標籤", "electron");

    await act(async () => fireEvent.click(createButton()));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Zen of Writing",
      status: null,
      tags: ["electron"],
    });
  });

  it("closes once the article is created", async () => {
    const { onClose } = renderDialog();
    type("標題", "Zen of Writing");

    await act(async () => fireEvent.click(createButton()));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open and says why when the article could not be created", async () => {
    const { onClose } = renderDialog({
      onCreate: vi.fn(() => Promise.resolve<ArticleCreation>({ outcome: "failed", reason: { kind: "reported", message: "磁碟已滿" } })),
    });
    type("標題", "Zen of Writing");

    await act(async () => fireEvent.click(createButton()));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("磁碟已滿");
    expect(createButton()).toBeEnabled();
  });

  it("cannot be cancelled while the article is being created", () => {
    const { onClose } = renderDialog({
      onCreate: vi.fn(() => new Promise<ArticleCreation>(() => undefined)),
    });
    type("標題", "Zen of Writing");

    fireEvent.click(createButton());
    fireEvent.keyDown(field("標題"), { key: "Escape" });

    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
