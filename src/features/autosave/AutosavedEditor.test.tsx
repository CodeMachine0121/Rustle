import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession } from "./AutosaveSession";
import { AutosavedEditor } from "./AutosavedEditor";

function renderEditor() {
  const composition = new CompositionState();
  const saveBody = vi.fn().mockResolvedValue({
    ok: true,
    payload: {
      outcome: "saved",
      updatedAt: "2026-08-20T08:04:11.123Z",
      lastKnownModifiedAt: "2026-08-20T08:04:11.200Z",
    },
  });
  const readBody = vi.fn();
  const session = new AutosaveSession(
    composition,
    { saveBody, readBody },
    { delayMilliseconds: 0 },
  );
  const view = render(
    <CompositionProvider state={composition}>
      <AutosavedEditor session={session} />
    </CompositionProvider>,
  );
  const content = () => {
    const element = view.container.querySelector(".cm-content");
    if (!(element instanceof HTMLElement)) {
      throw new Error("the editor did not render its content area");
    }
    return element;
  };
  return { session, saveBody, readBody, content };
}

const ARTICLE = {
  workspace: "Blog",
  fileName: "zen.md",
  body: "# 寫作的禪",
  lastKnownModifiedAt: "2026-08-20T08:00:00.000Z",
};

describe("AutosavedEditor", () => {
  it("shows the body of the article the session opened", async () => {
    const { session, content } = renderEditor();

    await act(() => session.openArticle({ article: ARTICLE, title: "寫作的禪" }));

    expect(content()).toHaveTextContent("# 寫作的禪");
    expect(screen.getByText("已儲存")).toBeInTheDocument();
  });

  it("turns typing in the editor into unsaved changes of the open article", async () => {
    const { session, saveBody, content } = renderEditor();
    await act(() => session.openArticle({ article: ARTICLE, title: "寫作的禪" }));

    act(() => {
      fireEvent.keyDown(content(), { key: "Tab" });
    });

    expect(screen.getByText("未儲存的變更")).toBeInTheDocument();
    expect(session.status).toMatchObject({ hasUnsavedChanges: true });
    await act(() => vi.waitFor(() => expect(saveBody).toHaveBeenCalled()));
    expect(saveBody).toHaveBeenCalledWith(expect.objectContaining({ body: "  # 寫作的禪" }));
  });

  it("keeps the same editable element when another article is opened", async () => {
    const { session, content } = renderEditor();
    await act(() => session.openArticle({ article: ARTICLE, title: "寫作的禪" }));
    const first = content();

    await act(() =>
      session.openArticle({ article: { ...ARTICLE, fileName: "b.md", body: "另一篇" }, title: "另一篇" }),
    );

    expect(content()).toBe(first);
    expect(first).toHaveTextContent("另一篇");
  });

  it("replaces the editor body with the reloaded one", async () => {
    const { session, readBody, content } = renderEditor();
    await act(() => session.openArticle({ article: ARTICLE, title: "寫作的禪" }));
    readBody.mockResolvedValueOnce({ ok: true, payload: { ...ARTICLE, body: "磁碟上的正文" } });

    await act(() => session.reload());

    expect(content()).toHaveTextContent("磁碟上的正文");
  });
});
