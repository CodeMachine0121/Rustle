export type FailureReason = "notImplemented" | "outsideVault" | "unknownChannel" | "unexpected";

export type ChannelFailure = {
  ok: false;
  reason: FailureReason;
  message: string;
};

export type ChannelResult<Payload> = { ok: true; payload: Payload } | ChannelFailure;
