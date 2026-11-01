import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleBody } from "../../ipc/articleBody";
import type { ChannelResult } from "../../ipc/channelResult";
import type { SaveBodyRequest, SavedBody } from "../../ipc/savedBody";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "./AutosaveSession";
import { SaveStatusLine } from "./SaveStatusLine";

const ARTICLE: ArticleBody = {
  workspace: "Blog",
  fileName: "zen.md",
  body: "正文",
  lastKnownModifiedAt: "2026-08-20T08:00:00.000Z",
};

describe("SaveStatusLine", () => {
  let saveBody: ReturnType<
    typeof vi.fn<(request: SaveBodyRequest) => Promise<ChannelResult<SavedBody>>>
  >;
  let readBody: ReturnType<
    typeof vi.fn<(workspace: string, fileName: string) => Promise<ChannelResult<ArticleBody>>>
  >;
  let session: AutosaveSession;

  beforeEach(() => {
    saveBody = vi.fn();
    readBody = vi.fn();
    session = new AutosaveSession(
      new CompositionState(),
      { saveBody, readBody },
      { delayMilliseconds: 0 },
    );
  });

  async function openArticle(): Promise<void> {
    await act(() =>
      session.openArticle({ article: ARTICLE, title: "寫作的禪" }).then(() => undefined),
    );
  }

  async function saveWith(result: ChannelResult<SavedBody>): Promise<void> {
    saveBody.mockResolvedValueOnce(result);
    await act(async () => {
      session.changeBody("新的正文");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function indicator(): string | null {
    return document.querySelector(".save-indicator")?.getAttribute("data-indicator") ?? null;
  }

  function statusLine(): HTMLElement {
    return screen.getByRole("contentinfo", { name: "儲存狀態列" });
  }

  it("shows no breadcrumb and no indicator without an open article", () => {
    const { container } = render(<SaveStatusLine session={session} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("reads Blog ❯ my-first-post.md with a green check for a saved article", async () => {
    render(<SaveStatusLine session={session} />);

    await act(() =>
      session
        .openArticle({ article: { ...ARTICLE, fileName: "my-first-post.md" }, title: "My first post" })
        .then(() => undefined),
    );

    expect(statusLine().querySelector(".article-path")?.textContent).toBe("Blog❯my-first-post.md");
    expect(statusLine().querySelector(".article-path__separator")).toHaveTextContent("❯");
    expect(statusLine().textContent).toBe("Blog❯my-first-post.md");
    expect(document.querySelector(".save-indicator--saved svg")).toHaveClass("lucide-check");
  });

  it("shows the workspace and the file name with an arrow and a saved check, and no words", async () => {
    render(<SaveStatusLine session={session} />);
    await openArticle();

    expect(statusLine()).toHaveTextContent(/^Blog❯zen\.md$/u);
    expect(statusLine()).not.toHaveTextContent("寫作的禪");
    expect(indicator()).toBe("saved");
    expect(screen.getByRole("img", { name: "已存進檔案" }).querySelector("svg")).toHaveClass("lucide-check");
  });

  it("spins as soon as the body changes, before anything is written", async () => {
    render(<SaveStatusLine session={session} />);
    await openArticle();

    act(() => session.changeBody("新的正文"));

    expect(indicator()).toBe("saving");
    expect(screen.getByRole("img", { name: "還沒存進檔案" }).querySelector("svg")).toHaveClass("lucide-loader-circle");
    expect(saveBody).not.toHaveBeenCalled();
  });

  it("shows the check once the save succeeded and keeps it", async () => {
    render(<SaveStatusLine session={session} />);
    await openArticle();

    await saveWith({
      ok: true,
      payload: {
        outcome: "saved",
        updatedAt: "2026-08-20T08:04:11.123Z",
        lastKnownModifiedAt: "2026-08-20T08:04:11.200Z",
      },
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(indicator()).toBe("saved");
    expect(document.body).not.toHaveTextContent("已儲存");
  });

  it("explains a failed save on the same line and stops spinning", async () => {
    render(<SaveStatusLine session={session} />);
    await openArticle();

    await saveWith({ ok: false, reason: "unexpected", message: "No space left on device" });

    expect(statusLine()).toContainElement(screen.getByRole("alert"));
    expect(screen.getByRole("alert")).toHaveTextContent("No space left on device");
    expect(indicator()).toBe("failed");
    expect(screen.getByRole("img", { name: "存不進檔案" }).querySelector("svg")).toHaveClass("lucide-circle-alert");
  });

  it("says the file changed outside and offers overwrite and reload", async () => {
    render(<SaveStatusLine session={session} />);
    await openArticle();

    await saveWith({
      ok: true,
      payload: { outcome: "modifiedElsewhere", lastKnownModifiedAt: ARTICLE.lastKnownModifiedAt },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("這個檔案在 Rustle 之外被改動過");
    expect(statusLine()).toContainElement(screen.getByRole("button", { name: "覆寫" }));
    expect(statusLine()).toContainElement(screen.getByRole("button", { name: "重新載入" }));
    expect(indicator()).toBe("saving");
  });

  it("overwrites when 覆寫 is chosen", async () => {
    render(<SaveStatusLine session={session} />);
    await openArticle();
    await saveWith({
      ok: true,
      payload: { outcome: "modifiedElsewhere", lastKnownModifiedAt: ARTICLE.lastKnownModifiedAt },
    });
    saveBody.mockResolvedValueOnce({
      ok: true,
      payload: {
        outcome: "saved",
        updatedAt: "2026-08-20T08:04:11.123Z",
        lastKnownModifiedAt: "2026-08-20T08:04:11.200Z",
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "覆寫" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(saveBody).toHaveBeenLastCalledWith(expect.objectContaining({ overwrite: true }));
    expect(indicator()).toBe("saved");
  });

  it("reloads the body on disk when 重新載入 is chosen", async () => {
    render(<SaveStatusLine session={session} />);
    await openArticle();
    await saveWith({
      ok: true,
      payload: { outcome: "modifiedElsewhere", lastKnownModifiedAt: ARTICLE.lastKnownModifiedAt },
    });
    readBody.mockResolvedValueOnce({ ok: true, payload: { ...ARTICLE, body: "磁碟上的正文" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重新載入" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(readBody).toHaveBeenCalledWith("Blog", "zen.md");
    expect(session.document.body).toBe("磁碟上的正文");
    expect(indicator()).toBe("saved");
  });

  it("shows why 覆寫 failed alongside the outside change warning", async () => {
    render(<SaveStatusLine session={session} />);
    await openArticle();
    await saveWith({
      ok: true,
      payload: { outcome: "modifiedElsewhere", lastKnownModifiedAt: ARTICLE.lastKnownModifiedAt },
    });
    saveBody.mockResolvedValueOnce({
      ok: false,
      reason: "unexpected",
      message: "No space left on device",
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "覆寫" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText("儲存失敗：No space left on device")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "覆寫" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新載入" })).toBeInTheDocument();
  });

  it("shows why 重新載入 failed alongside the outside change warning", async () => {
    render(<SaveStatusLine session={session} />);
    await openArticle();
    await saveWith({
      ok: true,
      payload: { outcome: "modifiedElsewhere", lastKnownModifiedAt: ARTICLE.lastKnownModifiedAt },
    });
    readBody.mockResolvedValueOnce({ ok: false, reason: "unexpected", message: "gone" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重新載入" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText("儲存失敗：gone")).toBeInTheDocument();
    expect(screen.getByText("這個檔案在 Rustle 之外被改動過")).toBeInTheDocument();
  });

  it("keeps the warning and both choices after a switch is refused", async () => {
    render(<SaveStatusLine session={session} />);
    await openArticle();
    await saveWith({
      ok: true,
      payload: { outcome: "modifiedElsewhere", lastKnownModifiedAt: ARTICLE.lastKnownModifiedAt },
    });

    const outcome = await act(() =>
      session.openArticle({ article: { ...ARTICLE, fileName: "other.md" }, title: "另一篇" }),
    );

    expect(outcome).toBe("blockedByUnansweredWarning");
    expect(statusLine()).toHaveTextContent("zen.md");
    expect(screen.getByRole("alert")).toHaveTextContent("這個檔案在 Rustle 之外被改動過");
    expect(screen.getByRole("button", { name: "覆寫" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新載入" })).toBeInTheDocument();
    expect(saveBody).toHaveBeenCalledTimes(1);
  });
});
