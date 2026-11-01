import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import type { ArticleVocabulary } from "../articleMetadata/articleVocabulary";
import type { ArticleCreation, ArticleDraft } from "../vault/VaultSession";
import { CreateArticleDialog } from "./CreateArticleDialog";

const BLOG_VOCABULARY: ArticleVocabulary = { category: ["技術筆記", "桌面開發"], tags: ["electron"] };

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
  it("has a Title field and two multi-value fields, Category and Tags", () => {
    renderDialog();

    expect(field("Title")).toHaveAttribute("type", "text");
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    for (const label of ["Category", "Tags"]) {
      for (const value of ["一", "二"]) {
        type(label, value);
        fireEvent.keyDown(field(label), { key: "Enter" });
      }
    }
    expect(screen.getAllByRole("button", { name: /^移除/ })).toHaveLength(4);
  });

  it("shows when the article is created as text, with no field to fill in", () => {
    const { container } = renderDialog();

    expect(screen.getByRole("dialog")).toHaveTextContent("建立於 2026-08-20 14:32");
    expect(container.querySelector('input[type="date"], input[type="time"], input[type="datetime-local"]')).toBeNull();
  });

  it("puts the keyboard in the Title field when it opens", () => {
    renderDialog();

    expect(field("Title")).toHaveFocus();
  });

  it("cannot create without a title and says why", () => {
    renderDialog();

    expect(createButton()).toBeDisabled();
    expect(screen.getByText("標題是必填的")).toBeInTheDocument();
  });

  it("treats a title of only spaces as no title", () => {
    renderDialog();

    type("Title", "   ");

    expect(createButton()).toBeDisabled();
  });

  it("can create once a title is typed", () => {
    renderDialog();

    type("Title", "Zen of Writing");

    expect(createButton()).toBeEnabled();
    expect(screen.queryByText("標題是必填的")).not.toBeInTheDocument();
  });

  it("closes on Esc without asking to create anything", () => {
    const { onCreate, onClose } = renderDialog();
    type("Title", "Zen of Writing");

    fireEvent.keyDown(field("Title"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("closes on cancel without asking to create anything", () => {
    const { onCreate, onClose } = renderDialog();
    type("Title", "Zen of Writing");

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("leaves Esc to the input method while it is composing", () => {
    const { onClose } = renderDialog();
    fireEvent.compositionStart(field("Title"));

    fireEvent.keyDown(field("Title"), { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not create on an Enter that picks a word in the title", () => {
    const { onCreate } = renderDialog();
    fireEvent.compositionStart(field("Title"));
    type("Title", "ㄊㄞˊ");

    fireEvent.keyDown(field("Title"), { key: "Enter" });

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("creates once on the Enter after the word is picked", async () => {
    const { onCreate } = renderDialog();
    fireEvent.compositionStart(field("Title"));
    type("Title", "台灣");
    fireEvent.compositionEnd(field("Title"));

    await act(async () => {
      fireEvent.keyDown(field("Title"), { key: "Enter" });
      fireEvent.keyDown(field("Title"), { key: "Enter" });
    });

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({ title: "台灣", category: [], tags: [] });
  });

  it("does not create on an Enter that says it belongs to a composition", () => {
    const { onCreate } = renderDialog();
    type("Title", "台");

    fireEvent.keyDown(field("Title"), { key: "Enter", isComposing: true });

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("adds a chip but does not create on the Enter after a word is picked in Tags", () => {
    const { onCreate } = renderDialog();
    type("Title", "Zen");
    fireEvent.compositionStart(field("Tags"));
    type("Tags", "台灣");
    fireEvent.compositionEnd(field("Tags"));

    fireEvent.keyDown(field("Tags"), { key: "Enter" });

    expect(screen.getByRole("button", { name: "移除 台灣" })).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("tells the shared state about a composition in the title and ends it when the field is left", () => {
    const { composition } = renderDialog();

    fireEvent.compositionStart(field("Title"));
    expect(composition.isComposing).toBe(true);
    fireEvent.compositionEnd(field("Title"));
    expect(composition.isComposing).toBe(false);

    fireEvent.compositionStart(field("Title"));
    fireEvent.blur(field("Title"));
    expect(composition.isComposing).toBe(false);
  });

  it("has no form that could submit by itself", () => {
    const { container } = renderDialog();

    expect(container.querySelector("form")).toBeNull();
  });

  it("keeps the chips of Category and Tags apart", () => {
    renderDialog();
    type("Category", "技術筆記");
    fireEvent.keyDown(field("Category"), { key: "Enter" });

    type("Tags", "electron");
    fireEvent.keyDown(field("Tags"), { key: "Enter" });

    expect(screen.getAllByRole("button", { name: /^移除/ }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "移除 技術筆記",
      "移除 electron",
    ]);
  });

  it("offers the workspace's categories in Category and its tags in Tags", () => {
    renderDialog();

    type("Category", "e");
    type("Tags", "e");

    expect(screen.queryByRole("list", { name: "Category 候選" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Tags 候選" })).toHaveTextContent("electron");

    type("Category", "開");

    expect(screen.getByRole("list", { name: "Category 候選" })).toHaveTextContent("桌面開發");
  });

  it("sends the trimmed title and every chip", async () => {
    const { onCreate } = renderDialog();
    type("Title", "  Zen of Writing  ");
    type("Category", "技術筆記");
    fireEvent.keyDown(field("Category"), { key: "Enter" });
    type("Tags", "electron");
    fireEvent.keyDown(field("Tags"), { key: "Enter" });

    await act(async () => fireEvent.click(createButton()));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Zen of Writing",
      category: ["技術筆記"],
      tags: ["electron"],
    });
  });

  it("sends text not yet turned into a chip as a chip", async () => {
    const { onCreate } = renderDialog();
    type("Title", "Zen of Writing");
    type("Category", "技術筆記");
    type("Tags", "electron");

    await act(async () => fireEvent.click(createButton()));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Zen of Writing",
      category: ["技術筆記"],
      tags: ["electron"],
    });
  });

  it("closes once the article is created", async () => {
    const { onClose } = renderDialog();
    type("Title", "Zen of Writing");

    await act(async () => fireEvent.click(createButton()));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open and says why when the article could not be created", async () => {
    const { onClose } = renderDialog({
      onCreate: vi.fn(() => Promise.resolve<ArticleCreation>({ outcome: "failed", message: "磁碟已滿" })),
    });
    type("Title", "Zen of Writing");

    await act(async () => fireEvent.click(createButton()));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("磁碟已滿");
    expect(createButton()).toBeEnabled();
  });

  it("cannot be cancelled while the article is being created", () => {
    const { onClose } = renderDialog({
      onCreate: vi.fn(() => new Promise<ArticleCreation>(() => undefined)),
    });
    type("Title", "Zen of Writing");

    fireEvent.click(createButton());
    fireEvent.keyDown(field("Title"), { key: "Escape" });

    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
