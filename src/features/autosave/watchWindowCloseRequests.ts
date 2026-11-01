import type { ChannelResult } from "../../ipc/channelResult";
import type { AutosaveSession } from "./AutosaveSession";

export type WindowCloseBackend = {
  watchCloseRequests: (onCloseRequest: () => void) => Promise<ChannelResult<null>>;
  answerCloseRequest: (close: boolean) => Promise<ChannelResult<null>>;
};

/** Closes the window only after the session has saved what it can. */
export function watchWindowCloseRequests(
  session: AutosaveSession,
  backend: WindowCloseBackend,
): Promise<ChannelResult<null>> {
  return backend.watchCloseRequests(() => {
    void session
      .prepareToCloseWindow()
      .then((decision) => backend.answerCloseRequest(decision === "close"));
  });
}
