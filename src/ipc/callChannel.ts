import { invoke, type InvokeArgs } from "@tauri-apps/api/core";

import type { ChannelFailure, ChannelResult, FailureReason } from "./channelResult";

const FAILURE_REASONS: readonly FailureReason[] = [
  "notImplemented",
  "outsideVault",
  "unknownChannel",
  "unexpected",
];

const SILENT_FAILURE_MESSAGE = "the backend failed without giving a reason";

export async function callChannel<Payload>(
  commandName: string,
  args?: InvokeArgs,
): Promise<ChannelResult<Payload>> {
  try {
    return { ok: true, payload: await invoke<Payload>(commandName, args) };
  } catch (thrown: unknown) {
    return toChannelFailure(thrown);
  }
}

function toChannelFailure(thrown: unknown): ChannelFailure {
  if (isChannelFailureShape(thrown)) {
    return { ok: false, reason: thrown.reason, message: thrown.message };
  }
  return { ok: false, reason: "unexpected", message: messageOf(thrown) };
}

function isChannelFailureShape(thrown: unknown): thrown is { reason: FailureReason; message: string } {
  if (typeof thrown !== "object" || thrown === null) {
    return false;
  }
  const { reason, message } = thrown as { reason?: unknown; message?: unknown };
  return FAILURE_REASONS.some((known) => known === reason) && typeof message === "string";
}

function messageOf(thrown: unknown): string {
  if (thrown instanceof Error && thrown.message) {
    return thrown.message;
  }
  if (typeof thrown === "string" && thrown) {
    return thrown;
  }
  return SILENT_FAILURE_MESSAGE;
}
