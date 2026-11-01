import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppLayout } from "./AppLayout";

describe("AppLayout", () => {
  it("has a titled region for workspaces, articles and the editor", () => {
    render(<AppLayout workspaces="w" articles="a" editor="e" />);

    const titles = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(titles).toEqual(["WORKSPACES", "ARTICLES", "EDITOR"]);
  });

  it("puts a preview it was given in the rightmost region", () => {
    render(<AppLayout workspaces="w" articles="a" editor="e" preview={<p>預覽內容</p>} />);

    const regions = screen.getAllByRole("region");
    expect(regions).toHaveLength(4);
    expect(regions.at(-1)).toHaveAccessibleName("PREVIEW");
    expect(regions.at(-1)).toHaveTextContent("預覽內容");
  });

  it("leaves the preview region out when there is no preview", () => {
    render(<AppLayout workspaces="w" articles="a" editor="e" />);

    expect(screen.queryByRole("region", { name: "PREVIEW" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("region").at(-1)).toHaveAccessibleName("EDITOR");
  });
});
