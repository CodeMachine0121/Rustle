import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import type { BodyMatch, BodySearchResult } from "../../ipc/bodySearch";
import type { ChannelResult } from "../../ipc/channelResult";
import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
import type { ArticleOrder } from "../vault/articleArrangement";
import { INITIAL_VAULT_SNAPSHOT, type VaultSnapshot } from "../vault/VaultSession";
import { BODY_SEARCH_DELAY_MILLISECONDS } from "./BodySearch";
import { Finders } from "./Finders";

function article(workspace: string, fileName: string, title: string, createdAt: string, tags: string[] = []): ArticleSummary {
  return {
    workspace,
    fileName,
    title,
    createdAt,
    updatedAt: createdAt,
    status: null,
    tags,
    hasIncompleteMetadata: false,
  };
}

const TIRED = article("日記", "tired.md", "今天很累", "2026-09-06T21:00:00+08:00");
const RAIN = article("日記", "rain.md", "昨天下雨", "2026-09-05T21:00:00+08:00");
const INPUT_METHOD = article("日記", "input.md", "Input Method 筆記", "2026-09-01T21:00:00+08:00");
const TYPING = article("日記", "typing.md", "組字紀錄", "2026-08-01T21:00:00+08:00", ["input"]);
const MEETING = article("工作", "meeting.md", "很累的會議", "2026-09-07T21:00:00+08:00");

const WORKSPACES = [
  { name: "日記", articleCount: 4 },
  { name: "工作", articleCount: 1 },
  { name: "食譜", articleCount: 0 },
];

const DIARY: VaultSnapshot = {
  ...INITIAL_VAULT_SNAPSHOT,
  workspaces: WORKSPACES,
  selectedWorkspace: "日記",
  articles: [RAIN, INPUT_METHOD, TIRED, TYPING],
};

const ALL_NOTES: VaultSnapshot = {
  ...INITIAL_VAULT_SNAPSHOT,
  workspaces: WORKSPACES,
  showsAllNotes: true,
  articles: [RAIN, TIRED, MEETING],
};

const NO_SCOPE: VaultSnapshot = { ...INITIAL_VAULT_SNAPSHOT, workspaces: WORKSPACES };

type Rendered = {
  onOpenFoundArticle: ReturnType<typeof vi.fn>;
  onGoTo: ReturnType<typeof vi.fn>;
  searchBodies: ReturnType<typeof vi.fn>;
  composition: CompositionState;
  editorKeys: ReturnType<typeof vi.fn>;
};

function renderFinders(
  snapshot: VaultSnapshot,
  {
    order = "createdNewestFirst" as ArticleOrder,
    bodyResult = { matches: [], isTruncated: false } as BodySearchResult,
    language = "zh" as const,
  }: { order?: ArticleOrder; bodyResult?: BodySearchResult; language?: "zh" | "en" } = {},
): Rendered {
  const composition = new CompositionState();
  const onOpenFoundArticle = vi.fn();
  const onGoTo = vi.fn();
  const editorKeys = vi.fn();
  const searchBodies = vi.fn(() => Promise.resolve<ChannelResult<BodySearchResult>>({ ok: true, payload: bodyResult }));
  render(
    <InterfaceLanguageProvider language={language}>
      <CompositionProvider state={composition}>
        <div role="textbox" aria-label="寫作區" tabIndex={0} onKeyDown={editorKeys} />
        <Finders
          snapshot={snapshot}
          order={order}
          searchBodies={searchBodies}
          onOpenFoundArticle={onOpenFoundArticle}
          onGoTo={onGoTo}
        />
      </CompositionProvider>
    </InterfaceLanguageProvider>,
  );
  return { onOpenFoundArticle, onGoTo, searchBodies, composition, editorKeys };
}

function editor(): HTMLElement {
  return screen.getByRole("textbox", { name: "寫作區" });
}

function press(
  code: string,
  modifiers: { metaKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean; repeat?: boolean } = {},
) {
  const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  fireEvent.keyDown(target, { code, key: code.replace(/^Key/, "").toLowerCase(), ...modifiers });
}

const openTitleFinder = () => press("KeyT", { metaKey: true });
const openBodyFinder = () => press("KeyF", { metaKey: true, shiftKey: true });
const openWorkspaceFinder = () => press("KeyP", { metaKey: true });

function field(): HTMLElement {
  return screen.getByRole("textbox", { name: /用標題找文章|用內文找文章|切換 workspace/ });
}

function type(text: string) {
  fireEvent.change(field(), { target: { value: text } });
}

function keyInField(key: string) {
  fireEvent.keyDown(field(), { key });
}

function rowTexts(): string[] {
  return screen.queryAllByRole("option").map((row) => row.textContent ?? "");
}

function selectedRowText(): string | null {
  return screen.queryAllByRole("option").find((row) => row.getAttribute("aria-selected") === "true")?.textContent ?? null;
}

function status(): string | null {
  return screen.queryByRole("status")?.textContent ?? null;
}

function hit(fileName: string, lineNumber: number, lineText: string, workspace = "日記"): BodyMatch {
  return { workspace, fileName, lineNumber, lineText };
}

async function typeAndWaitForSearch(text: string) {
  type(text);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(BODY_SEARCH_DELAY_MILLISECONDS);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Finders", () => {
  describe("finding articles by title", () => {
    it("keeps only the articles whose title holds the typed text", () => {
      renderFinders(DIARY);
      openTitleFinder();

      type("累");

      expect(rowTexts()).toEqual(["今天很累"]);
    });

    it("never lists another workspace's articles, and names no workspace in a single one", () => {
      renderFinders(DIARY);
      openTitleFinder();

      type("累");

      expect(screen.queryByText("很累的會議")).toBeNull();
      expect(rowTexts()[0]).not.toContain("日記");
    });

    it("lists every workspace's articles under All Notes, each naming its workspace", () => {
      renderFinders(ALL_NOTES);
      openTitleFinder();

      type("累");

      expect(rowTexts()).toEqual(["很累的會議工作", "今天很累日記"]);
    });

    it("lists the whole scope before anything is typed, newest first, the first row selected", () => {
      renderFinders(DIARY);
      openTitleFinder();

      expect(rowTexts()).toEqual(["今天很累", "昨天下雨", "Input Method 筆記", "組字紀錄"]);
      expect(selectedRowText()).toBe("今天很累");
    });

    it("follows the order the article list is in", () => {
      renderFinders(DIARY, { order: "title" });
      openTitleFinder();

      expect(rowTexts()[0]).toBe("Input Method 筆記");
    });

    it("takes blanks as nothing typed", () => {
      renderFinders(DIARY);
      openTitleFinder();

      type("   ");

      expect(rowTexts()).toHaveLength(4);
    });

    it.each([
      ["input", ["Input Method 筆記"]],
      ["input method", ["Input Method 筆記"]],
      ["inpmet", []],
    ])("matches %j as one piece of the title in any case, never the tags", (typed, expected) => {
      renderFinders(DIARY);
      openTitleFinder();

      type(typed);

      expect(rowTexts()).toEqual(expected);
    });

    it("says when no title matches", () => {
      renderFinders(DIARY);
      openTitleFinder();

      type("貓");

      expect(rowTexts()).toEqual([]);
      expect(status()).toBe("沒有符合的文章");
    });

    it("says when the workspace has no articles", () => {
      renderFinders({ ...DIARY, selectedWorkspace: "食譜", articles: [] });
      openTitleFinder();

      expect(rowTexts()).toEqual([]);
      expect(status()).toBe("這個 workspace 還沒有文章");
    });

    it("does not open without a scope", () => {
      renderFinders(NO_SCOPE);

      openTitleFinder();

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("opens the chosen article and closes", () => {
      const { onOpenFoundArticle } = renderFinders(DIARY);
      openTitleFinder();
      type("累");

      keyInField("Enter");

      expect(onOpenFoundArticle).toHaveBeenCalledWith(TIRED);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("opens an article that is clicked", () => {
      const { onOpenFoundArticle } = renderFinders(DIARY);
      openTitleFinder();

      fireEvent.click(screen.getByRole("option", { name: "昨天下雨" }));

      expect(onOpenFoundArticle).toHaveBeenCalledWith(RAIN);
    });
  });

  describe("finding articles by body text", () => {
    it("asks for text before searching and lists nothing", () => {
      const { searchBodies } = renderFinders(DIARY);
      openBodyFinder();

      expect(rowTexts()).toEqual([]);
      expect(status()).toBe("打字開始搜尋正文");
      expect(searchBodies).not.toHaveBeenCalled();
    });

    it("searches the scope's articles in the list's order and shows title, line and text", async () => {
      vi.useFakeTimers();
      const { searchBodies } = renderFinders(DIARY, {
        bodyResult: { matches: [hit("tired.md", 3, "今天加班到很晚")], isTruncated: false },
      });
      openBodyFinder();

      await typeAndWaitForSearch("加班");

      expect(searchBodies).toHaveBeenCalledWith({
        text: "加班",
        articles: [TIRED, RAIN, INPUT_METHOD, TYPING].map(({ workspace, fileName }) => ({ workspace, fileName })),
      });
      expect(rowTexts()).toEqual(["今天很累第 3 行今天加班到很晚"]);
      expect(status()).toBeNull();
    });

    it("puts the cursor on the chosen line", async () => {
      vi.useFakeTimers();
      const { onOpenFoundArticle } = renderFinders(DIARY, {
        bodyResult: {
          matches: [hit("tired.md", 3, "加班"), hit("tired.md", 7, "又加班"), hit("tired.md", 12, "還在加班")],
          isTruncated: false,
        },
      });
      openBodyFinder();
      await typeAndWaitForSearch("加班");

      keyInField("ArrowDown");
      keyInField("Enter");

      expect(onOpenFoundArticle).toHaveBeenCalledWith({ workspace: "日記", fileName: "tired.md" }, 7);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("names a line of an article no longer listed by its file name", async () => {
      vi.useFakeTimers();
      renderFinders(DIARY, { bodyResult: { matches: [hit("gone.md", 1, "加班")], isTruncated: false } });
      openBodyFinder();

      await typeAndWaitForSearch("加班");

      expect(rowTexts()).toEqual(["gone.md第 1 行加班"]);
    });

    it("names each line's workspace under All Notes", async () => {
      vi.useFakeTimers();
      renderFinders(ALL_NOTES, {
        bodyResult: { matches: [hit("meeting.md", 1, "加班", "工作"), hit("tired.md", 3, "加班")], isTruncated: false },
      });
      openBodyFinder();

      await typeAndWaitForSearch("加班");

      expect(rowTexts()).toEqual(["很累的會議工作第 1 行加班", "今天很累日記第 3 行加班"]);
    });

    it("says when nothing matches", async () => {
      vi.useFakeTimers();
      renderFinders(DIARY);
      openBodyFinder();

      await typeAndWaitForSearch("貓");

      expect(status()).toBe("沒有符合的內容");
    });

    it("lists the first lines and says there were too many", async () => {
      vi.useFakeTimers();
      const matches = Array.from({ length: 200 }, (_, index) => hit("tired.md", index + 1, "的"));
      renderFinders(DIARY, { bodyResult: { matches, isTruncated: true } });
      openBodyFinder();

      await typeAndWaitForSearch("的");

      expect(rowTexts()).toHaveLength(200);
      expect(status()).toBe("符合的內容太多，請再多打幾個字");
    });

    it("does not say too many for exactly as many as can be listed", async () => {
      vi.useFakeTimers();
      const matches = Array.from({ length: 200 }, (_, index) => hit("tired.md", index + 1, "的"));
      renderFinders(DIARY, { bodyResult: { matches, isTruncated: false } });
      openBodyFinder();

      await typeAndWaitForSearch("的");

      expect(rowTexts()).toHaveLength(200);
      expect(status()).toBeNull();
    });

    it("says the search did not get through when it fails", async () => {
      vi.useFakeTimers();
      const { searchBodies } = renderFinders(DIARY);
      searchBodies.mockResolvedValue({ ok: false, reason: "unexpected", message: "disk" });
      openBodyFinder();

      await typeAndWaitForSearch("加班");

      expect(status()).toBe("這次找不動，請再試一次");
    });

    it("lists nothing again once the text is blank", async () => {
      vi.useFakeTimers();
      renderFinders(DIARY, { bodyResult: { matches: [hit("tired.md", 3, "加班")], isTruncated: false } });
      openBodyFinder();
      await typeAndWaitForSearch("加班");

      type("   ");

      expect(rowTexts()).toEqual([]);
      expect(status()).toBe("打字開始搜尋正文");
    });

    it("does not open without a scope", () => {
      renderFinders(NO_SCOPE);

      openBodyFinder();

      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("switching workspace", () => {
    it("lists All Notes first, then every workspace with its article count", () => {
      renderFinders(DIARY);
      openWorkspaceFinder();

      expect(rowTexts()).toEqual(["所有文章5 篇文章", "日記4 篇文章", "工作1 篇文章", "食譜0 篇文章"]);
    });

    it("says when a workspace's articles cannot be counted, and counts the rest for All Notes", () => {
      renderFinders({ ...DIARY, workspaces: [{ name: "日記", articleCount: 4 }, { name: "壞掉", articleCount: null }] });
      openWorkspaceFinder();

      expect(rowTexts()).toEqual(["所有文章4 篇文章", "日記4 篇文章", "壞掉讀不到篇數"]);
    });

    it("narrows the list by name", () => {
      renderFinders(DIARY);
      openWorkspaceFinder();

      type("工");

      expect(rowTexts()).toEqual(["工作1 篇文章"]);
    });

    it("goes to the chosen workspace", () => {
      const { onGoTo } = renderFinders(DIARY);
      openWorkspaceFinder();
      type("工");

      keyInField("Enter");

      expect(onGoTo).toHaveBeenCalledWith({ kind: "workspace", workspace: "工作" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("goes to All Notes", () => {
      const { onGoTo } = renderFinders(DIARY);
      openWorkspaceFinder();

      keyInField("Enter");

      expect(onGoTo).toHaveBeenCalledWith({ kind: "allNotes" });
    });

    it("opens without a scope", () => {
      renderFinders(NO_SCOPE);

      openWorkspaceFinder();

      expect(screen.getByRole("dialog", { name: "切換 workspace" })).toBeInTheDocument();
    });

    it("lists only All Notes and says there are no workspaces in an empty vault", () => {
      renderFinders({ ...INITIAL_VAULT_SNAPSHOT });
      openWorkspaceFinder();

      expect(rowTexts()).toEqual(["所有文章0 篇文章"]);
      expect(status()).toBe("還沒有 workspace");
    });

    it("says when no name matches", () => {
      renderFinders(DIARY);
      openWorkspaceFinder();

      type("貓");

      expect(rowTexts()).toEqual([]);
      expect(status()).toBe("沒有符合的 workspace");
    });

    it("speaks English, keeping the word workspace", () => {
      renderFinders({ ...INITIAL_VAULT_SNAPSHOT }, { language: "en" });
      openWorkspaceFinder();

      expect(screen.getByRole("dialog", { name: "Switch workspace" })).toBeInTheDocument();
      expect(rowTexts()).toEqual(["All Notes0 articles"]);
      expect(status()).toBe("No workspaces yet");
    });
  });

  describe("one way to use every finder", () => {
    it("moves the selection down and stops at the last row", () => {
      renderFinders(DIARY);
      openTitleFinder();

      keyInField("ArrowDown");
      keyInField("ArrowDown");
      expect(selectedRowText()).toBe("Input Method 筆記");

      keyInField("ArrowDown");
      keyInField("ArrowDown");
      expect(selectedRowText()).toBe("組字紀錄");
    });

    it("stops at the first row going up", () => {
      renderFinders(DIARY);
      openTitleFinder();

      keyInField("ArrowUp");

      expect(selectedRowText()).toBe("今天很累");
    });

    it("selects the first row again after more typing", () => {
      renderFinders(DIARY);
      openTitleFinder();
      keyInField("ArrowDown");
      keyInField("ArrowDown");

      type("天");

      expect(selectedRowText()).toBe("今天很累");
    });

    it("closes on Escape without changing anything and gives the keyboard back", () => {
      const { onOpenFoundArticle, onGoTo, editorKeys } = renderFinders(DIARY);
      editor().focus();
      openTitleFinder();
      type("累");

      keyInField("Escape");

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(onOpenFoundArticle).not.toHaveBeenCalled();
      expect(onGoTo).not.toHaveBeenCalled();
      expect(editor()).toHaveFocus();
      expect(editorKeys).not.toHaveBeenCalled();
    });

    it("closes on a click outside the list", () => {
      renderFinders(DIARY);
      openTitleFinder();

      fireEvent.mouseDown(screen.getByRole("dialog").parentElement ?? document.body);

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes when the same key is pressed again", () => {
      renderFinders(DIARY);
      openTitleFinder();

      openTitleFinder();

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("swaps one finder for another with an empty field", () => {
      renderFinders(DIARY);
      openTitleFinder();
      type("累");

      openBodyFinder();

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(screen.getByRole("dialog", { name: "用內文找文章" })).toBeInTheDocument();
      expect(field()).toHaveValue("");
    });

    it("opens empty again after being left", () => {
      renderFinders(DIARY);
      openTitleFinder();
      type("累");
      keyInField("Escape");

      openTitleFinder();

      expect(field()).toHaveValue("");
      expect(rowTexts()).toHaveLength(4);
    });

    it("keeps the rows while an input method is composing and updates them once it ends", () => {
      renderFinders(DIARY);
      openTitleFinder();

      fireEvent.compositionStart(field());
      fireEvent.change(field(), { target: { value: "lei" } });
      expect(rowTexts()).toHaveLength(4);

      fireEvent.change(field(), { target: { value: "累" } });
      fireEvent.compositionEnd(field());
      expect(rowTexts()).toEqual(["今天很累"]);
    });

    it("does not search the body while an input method is composing", async () => {
      vi.useFakeTimers();
      const { searchBodies } = renderFinders(DIARY);
      openBodyFinder();

      fireEvent.compositionStart(field());
      await typeAndWaitForSearch("jia");

      expect(searchBodies).not.toHaveBeenCalled();
    });

    it("searches the body once the input method has chosen the words", async () => {
      vi.useFakeTimers();
      const { searchBodies } = renderFinders(DIARY);
      openBodyFinder();
      fireEvent.compositionStart(field());
      fireEvent.change(field(), { target: { value: "加班" } });

      fireEvent.compositionEnd(field());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(BODY_SEARCH_DELAY_MILLISECONDS);
      });

      expect(searchBodies).toHaveBeenCalledTimes(1);
      expect(searchBodies).toHaveBeenCalledWith(expect.objectContaining({ text: "加班" }));
    });

    it("leaves Enter and the arrows to the input method while it composes", () => {
      const { onOpenFoundArticle } = renderFinders(DIARY);
      openTitleFinder();

      fireEvent.compositionStart(field());
      keyInField("ArrowDown");
      keyInField("Enter");

      expect(onOpenFoundArticle).not.toHaveBeenCalled();
      expect(selectedRowText()).toBe("今天很累");
    });

    it("does nothing on Enter without rows and stays open", () => {
      const { onOpenFoundArticle } = renderFinders(DIARY);
      openTitleFinder();
      type("貓");

      keyInField("Enter");

      expect(onOpenFoundArticle).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("the keys", () => {
    it.each([
      ["Cmd+P", "KeyP", { metaKey: true }, "切換 workspace"],
      ["Cmd+T", "KeyT", { metaKey: true }, "用標題找文章"],
      ["Shift+Cmd+F", "KeyF", { metaKey: true, shiftKey: true }, "用內文找文章"],
    ])("%s opens its finder and never reaches the writing area", (_name, code, modifiers, label) => {
      const { editorKeys } = renderFinders(DIARY);
      editor().focus();

      press(code, modifiers);

      expect(screen.getByRole("dialog", { name: label })).toBeInTheDocument();
      expect(editorKeys).not.toHaveBeenCalled();
    });

    it.each([
      ["Ctrl+P", "KeyP", { ctrlKey: true }],
      ["Ctrl+T", "KeyT", { ctrlKey: true }],
      ["Shift+Ctrl+F", "KeyF", { ctrlKey: true, shiftKey: true }],
    ])("leaves %s to the writing area and opens nothing", (_name, code, modifiers) => {
      const { editorKeys } = renderFinders(DIARY);
      editor().focus();

      press(code, modifiers);

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(editorKeys).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["Cmd+P", "KeyP", { metaKey: true }, "切換 workspace"],
      ["Cmd+T", "KeyT", { metaKey: true }, "用標題找文章"],
      ["Shift+Cmd+F", "KeyF", { metaKey: true, shiftKey: true }, "用內文找文章"],
    ])("keeps its finder open while %s is held down", (_name, code, modifiers, label) => {
      const { editorKeys } = renderFinders(DIARY);
      editor().focus();

      press(code, modifiers);
      press(code, { ...modifiers, repeat: true });

      expect(screen.getByRole("dialog", { name: label })).toBeInTheDocument();
      expect(editorKeys).not.toHaveBeenCalled();
    });

    it("types into the field as plain text once open", () => {
      renderFinders(DIARY);
      editor().focus();
      openTitleFinder();

      expect(field()).toHaveFocus();
      type("累");
      expect(field()).toHaveValue("累");
    });

    it("lets the writing area keep its key while it is composing", () => {
      const { composition } = renderFinders(DIARY);
      editor().focus();
      composition.start();

      openTitleFinder();

      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
