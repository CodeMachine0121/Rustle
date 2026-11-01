import { fireEvent, render, screen } from "@testing-library/react";
import { Pencil } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("is named and titled by its label but draws only its icon", () => {
    const onClick = vi.fn();
    render(<IconButton label="編輯 metadata" icon={Pencil} className="card-action" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "編輯 metadata" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("title", "編輯 metadata");
    expect(button).toHaveTextContent("");
    expect(button).toHaveClass("icon-button", "card-action");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(button.querySelector("svg")).toHaveAttribute("stroke", "currentColor");
    expect(button.querySelector("svg")).toHaveAttribute("fill", "none");
  });

  it("never submits a form", () => {
    render(<IconButton label="新文章" icon={Pencil} />);

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
