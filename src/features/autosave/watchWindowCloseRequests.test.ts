import { describe, expect, it, vi } from "vitest";

import type { ChannelResult } from "../../ipc/channelResult";
import { CompositionState } from "../../shared/composition/CompositionState";
import { AutosaveSession, type WindowCloseDecision } from "./AutosaveSession";
import { watchWindowCloseRequests } from "./watchWindowCloseRequests";

const OK: ChannelResult<null> = { ok: true, payload: null };

function setUp(decision: WindowCloseDecision) {
  let requestClose: () => void = () => undefined;
  const backend = {
    watchCloseRequests: vi.fn((onCloseRequest: () => void) => {
      requestClose = onCloseRequest;
      return Promise.resolve(OK);
    }),
    answerCloseRequest: vi.fn(() => Promise.resolve(OK)),
  };
  const session = new AutosaveSession(new CompositionState(), {
    saveBody: vi.fn(),
    readBody: vi.fn(),
  });
  const prepareToCloseWindow = vi
    .spyOn(session, "prepareToCloseWindow")
    .mockResolvedValue(decision);
  void watchWindowCloseRequests(session, backend);
  return { backend, prepareToCloseWindow, requestClose: () => requestClose() };
}

describe("watchWindowCloseRequests", () => {
  it("asks the session and closes the window when it agrees", async () => {
    const { backend, prepareToCloseWindow, requestClose } = setUp("close");

    requestClose();
    await vi.waitFor(() => expect(backend.answerCloseRequest).toHaveBeenCalled());

    expect(prepareToCloseWindow).toHaveBeenCalledTimes(1);
    expect(backend.answerCloseRequest).toHaveBeenCalledWith(true);
  });

  it("keeps the window open when the session says to stay", async () => {
    const { backend, requestClose } = setUp("stay");

    requestClose();
    await vi.waitFor(() => expect(backend.answerCloseRequest).toHaveBeenCalled());

    expect(backend.answerCloseRequest).toHaveBeenCalledWith(false);
  });
});
