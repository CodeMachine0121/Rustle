import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BodySearchResult } from "../../ipc/bodySearch";
import type { ChannelResult } from "../../ipc/channelResult";
import { CompositionState } from "../../shared/composition/CompositionState";
import { BodySearch, BODY_SEARCH_DELAY_MILLISECONDS } from "./BodySearch";
import { FindingText } from "./FindingText";

const DIARY = [
  { workspace: "日記", fileName: "tired.md" },
  { workspace: "日記", fileName: "rain.md" },
];

function found(lineText: string): BodySearchResult {
  return { matches: [{ workspace: "日記", fileName: "tired.md", lineNumber: 3, lineText }], isTruncated: false };
}

function deferred<Value>() {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe("BodySearch", () => {
  let composition: CompositionState;

  beforeEach(() => {
    vi.useFakeTimers();
    composition = new CompositionState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for text before searching", () => {
    const search = new BodySearch(composition, vi.fn());

    expect(search.state).toEqual({ kind: "waitingForText" });
  });

  it("searches the given articles in their order once typing pauses", async () => {
    const searchBodies = vi.fn(() => Promise.resolve<ChannelResult<BodySearchResult>>({ ok: true, payload: found("加班") }));
    const search = new BodySearch(composition, searchBodies);

    search.search(new FindingText(" 加班 "), DIARY);
    expect(searchBodies).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(BODY_SEARCH_DELAY_MILLISECONDS);

    expect(searchBodies).toHaveBeenCalledWith({ text: "加班", articles: DIARY });
    expect(search.state).toEqual({ kind: "found", result: found("加班") });
  });

  it("does not search while an input method is composing", async () => {
    const searchBodies = vi.fn(() => Promise.resolve<ChannelResult<BodySearchResult>>({ ok: true, payload: found("加班") }));
    const search = new BodySearch(composition, searchBodies);

    composition.start();
    search.search(new FindingText("加班"), DIARY);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(searchBodies).not.toHaveBeenCalled();
  });

  it("keeps the previous answer while the next search runs", async () => {
    const next = deferred<ChannelResult<BodySearchResult>>();
    const searchBodies = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, payload: found("加班") })
      .mockReturnValueOnce(next.promise);
    const search = new BodySearch(composition, searchBodies);
    search.search(new FindingText("加"), DIARY);
    await vi.advanceTimersByTimeAsync(BODY_SEARCH_DELAY_MILLISECONDS);

    search.search(new FindingText("加班"), DIARY);
    await vi.advanceTimersByTimeAsync(BODY_SEARCH_DELAY_MILLISECONDS);

    expect(search.state).toEqual({ kind: "found", result: found("加班") });
  });

  it("drops an answer to older text that arrives after the answer to newer text", async () => {
    const older = deferred<ChannelResult<BodySearchResult>>();
    const searchBodies = vi
      .fn()
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce({ ok: true, payload: found("加班到很晚") });
    const search = new BodySearch(composition, searchBodies);
    search.search(new FindingText("加"), DIARY);
    await vi.advanceTimersByTimeAsync(BODY_SEARCH_DELAY_MILLISECONDS);
    search.search(new FindingText("加班"), DIARY);
    await vi.advanceTimersByTimeAsync(BODY_SEARCH_DELAY_MILLISECONDS);

    older.resolve({ ok: true, payload: found("加油") });
    await vi.advanceTimersByTimeAsync(0);

    expect(search.state).toEqual({ kind: "found", result: found("加班到很晚") });
  });

  it("clears the answer at once when the text becomes blank", async () => {
    const searchBodies = vi.fn(() => Promise.resolve<ChannelResult<BodySearchResult>>({ ok: true, payload: found("加班") }));
    const search = new BodySearch(composition, searchBodies);
    search.search(new FindingText("加班"), DIARY);
    await vi.advanceTimersByTimeAsync(BODY_SEARCH_DELAY_MILLISECONDS);

    search.search(new FindingText("   "), DIARY);

    expect(search.state).toEqual({ kind: "waitingForText" });
    expect(searchBodies).toHaveBeenCalledTimes(1);
  });

  it("says the search failed when the backend cannot answer", async () => {
    const searchBodies = vi.fn(() =>
      Promise.resolve<ChannelResult<BodySearchResult>>({ ok: false, reason: "unexpected", message: "disk" }),
    );
    const search = new BodySearch(composition, searchBodies);

    search.search(new FindingText("加班"), DIARY);
    await vi.advanceTimersByTimeAsync(BODY_SEARCH_DELAY_MILLISECONDS);

    expect(search.state).toEqual({ kind: "failed" });
  });

  it("tells subscribers about a new answer", async () => {
    const searchBodies = vi.fn(() => Promise.resolve<ChannelResult<BodySearchResult>>({ ok: true, payload: found("加班") }));
    const search = new BodySearch(composition, searchBodies);
    const listener = vi.fn();
    search.subscribe(listener);

    search.search(new FindingText("加班"), DIARY);
    await vi.advanceTimersByTimeAsync(BODY_SEARCH_DELAY_MILLISECONDS);

    expect(listener).toHaveBeenCalled();
  });
});
