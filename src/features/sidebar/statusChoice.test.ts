import { describe, expect, it } from "vitest";

import { statusChoiceNamed, statusChoiceOf, statusOf } from "./statusChoice";

describe("status choices", () => {
  it("turns the absence of a status into No Status and back", () => {
    expect(statusChoiceOf(null)).toBe("noStatus");
    expect(statusOf("noStatus")).toBeNull();
    expect(statusChoiceOf("onHold")).toBe("onHold");
    expect(statusOf("onHold")).toBe("onHold");
  });

  it("reads an unknown choice as No Status", () => {
    expect(statusChoiceNamed("dropped")).toBe("dropped");
    expect(statusChoiceNamed("進行中")).toBe("noStatus");
  });
});
