import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleBody } from "../../ipc/articleBody";
import type { ChannelResult } from "../../ipc/channelResult";
import type { SaveBodyRequest, SavedBody } from "../../ipc/savedBody";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "./AutosaveSession";
import { SaveStatusBar } from "./SaveStatusBar";

const ARTICLE: ArticleBody = {
  workspace: "Blog",
  fileName: "zen.md",
  body: "正文",
  lastKnownModifiedAt: "2026-08-20T08:00:00.000Z",
};

describe("SaveStatusBar", () => {
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

  it("shows no save status without an open article", () => {
    render(<SaveStatusBar session={session} />);

    expect(screen.getByRole("banner")).toBeEmptyDOMElement();
    expect(screen.queryByText("已儲存")).toBeNull();
    expect(screen.queryByText("未儲存的變更")).toBeNull();
  });

  it("shows the title and unsaved changes as soon as the body changes", async () => {
    render(<SaveStatusBar session={session} />);
    await openArticle();

    act(() => session.changeBody("新的正文"));

    expect(screen.getByText("寫作的禪")).toBeInTheDocument();
    expect(screen.getByText("未儲存的變更")).toBeInTheDocument();
  });

  it("shows the title and saved once the save succeeded", async () => {
    render(<SaveStatusBar session={session} />);
    await openArticle();

    await saveWith({
      ok: true,
      payload: {
        outcome: "saved",
        updatedAt: "2026-08-20T08:04:11.123Z",
        lastKnownModifiedAt: "2026-08-20T08:04:11.200Z",
      },
    });

    expect(screen.getByText("寫作的禪")).toBeInTheDocument();
    expect(screen.getByText("已儲存")).toBeInTheDocument();
  });

  it("shows the failure message and that changes are still unsaved", async () => {
    render(<SaveStatusBar session={session} />);
    await openArticle();

    await saveWith({ ok: false, reason: "unexpected", message: "No space left on device" });

    expect(screen.getByRole("alert")).toHaveTextContent("No space left on device");
    expect(screen.getByText("未儲存的變更")).toBeInTheDocument();
  });

  it("says the file changed outside and offers overwrite and reload", async () => {
    render(<SaveStatusBar session={session} />);
    await openArticle();

    await saveWith({
      ok: true,
      payload: { outcome: "modifiedElsewhere", lastKnownModifiedAt: ARTICLE.lastKnownModifiedAt },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("檔案在外部被改動過");
    expect(screen.getByRole("button", { name: "覆寫" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新載入" })).toBeInTheDocument();
  });

  it("overwrites when 覆寫 is chosen", async () => {
    render(<SaveStatusBar session={session} />);
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
    expect(screen.getByText("已儲存")).toBeInTheDocument();
  });

  it("reloads the body on disk when 重新載入 is chosen", async () => {
    render(<SaveStatusBar session={session} />);
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
    expect(screen.getByText("已儲存")).toBeInTheDocument();
  });
});
