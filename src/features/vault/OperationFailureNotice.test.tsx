import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Operation } from "./operationFailure";
import { OperationFailureNotice } from "./OperationFailureNotice";

describe("OperationFailureNotice", () => {
  it.each([
    ["createArticle", "建立文章失敗"],
    ["updateMetadata", "更新 metadata 失敗"],
    ["deleteArticle", "刪除文章失敗"],
    ["renameWorkspace", "重新命名 workspace 失敗"],
    ["deleteWorkspace", "刪除 workspace 失敗"],
  ] as const)("names the %s operation and keeps the reason", (operation: Operation, sentence) => {
    render(<OperationFailureNotice failure={{ operation, reason: { kind: "reported", message: "磁碟已滿" } }} onDismiss={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(`${sentence}：磁碟已滿`);
  });

  it("can be dismissed", () => {
    const onDismiss = vi.fn();
    render(<OperationFailureNotice failure={{ operation: "deleteArticle", reason: { kind: "reported", message: "x" } }} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "關閉提示" }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it("shows nothing without a failure", () => {
    const { container } = render(<OperationFailureNotice failure={null} onDismiss={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
