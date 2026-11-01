import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { DEFAULT_SETTINGS, SettingsSession } from "../settings/SettingsSession";
import { INITIAL_VAULT_SNAPSHOT, type VaultSnapshot } from "../vault/VaultSession";
import { Sidebar } from "./Sidebar";
import { SidebarFilter } from "./SidebarFilter";

function article(status: ArticleSummary["status"], tags: string[] = []): ArticleSummary {
  return {
    workspace: "Blog",
    fileName: `${status ?? "none"}-${tags.join("-")}.md`,
    title: "a",
    createdAt: "",
    updatedAt: "",
    status,
    tags,
    hasIncompleteMetadata: false,
  };
}

const BLOG: VaultSnapshot = {
  ...INITIAL_VAULT_SNAPSHOT,
  selectedWorkspace: "Blog",
  articles: [article("active", ["work"]), article("active", ["work", "bug"]), article(null)],
};

async function settingsSession(
  collapsedSections: Settings["sidebar"]["collapsedSections"] = [],
  write: () => Promise<ChannelResult<null>> = () => Promise.resolve({ ok: true, payload: null }),
) {
  const channels = {
    readSettings: vi.fn(() =>
      Promise.resolve<ChannelResult<Settings>>({
        ok: true,
        payload: { ...DEFAULT_SETTINGS, sidebar: { collapsedSections } },
      }),
    ),
    writeSettings: vi.fn(write),
  };
  const session = new SettingsSession(channels);
  await session.load();
  return { session, channels };
}

function renderSidebar(snapshot: VaultSnapshot, settings: SettingsSession) {
  const handlers = { onSelectAllNotes: vi.fn(), onToggleStatus: vi.fn(), onToggleTag: vi.fn() };
  render(
    <Sidebar snapshot={snapshot} settings={settings} workspaces={<p>workspace 清單</p>} {...handlers} />,
  );
  return handlers;
}

function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

function rowsOf(name: string): HTMLElement[] {
  return within(section(name))
    .getAllByRole("button")
    .filter((button) => button.hasAttribute("aria-pressed"));
}

describe("Sidebar", () => {
  it("puts All Notes above the workspace, status and tag sections, in that order", async () => {
    const { session } = await settingsSession();
    renderSidebar(BLOG, session);

    const titles = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(titles).toEqual(["WORKSPACES▾", "STATUS▾", "TAGS▾"]);
    expect(screen.getAllByRole("button")[0]).toHaveTextContent("All Notes");
    expect(section("WORKSPACES")).toHaveTextContent("workspace 清單");
  });

  it("shows the five statuses with how many articles of the scope have each", async () => {
    const { session } = await settingsSession();
    renderSidebar(BLOG, session);

    expect(rowsOf("STATUS").map((row) => row.textContent)).toEqual([
      "Active2",
      "On Hold0",
      "Completed0",
      "Dropped0",
      "No Status1",
    ]);
  });

  it("keeps the five statuses at zero when the scope has no articles", async () => {
    const { session } = await settingsSession();
    renderSidebar({ ...BLOG, articles: [] }, session);

    expect(rowsOf("STATUS").map((row) => row.textContent)).toEqual([
      "Active0",
      "On Hold0",
      "Completed0",
      "Dropped0",
      "No Status0",
    ]);
    expect(within(section("TAGS")).getByText("還沒有標籤")).toBeInTheDocument();
    expect(rowsOf("TAGS")).toHaveLength(0);
  });

  it("lists the tags most used first with their counts", async () => {
    const { session } = await settingsSession();
    renderSidebar(BLOG, session);

    expect(rowsOf("TAGS").map((row) => row.textContent)).toEqual([
      "work2",
      "bug1",
    ]);
  });

  it("marks what is chosen and keeps every count as it was", async () => {
    const { session } = await settingsSession();
    renderSidebar({ ...BLOG, sidebarFilter: SidebarFilter.NONE.toggleStatus("active").toggleTag("bug") }, session);

    expect(within(section("STATUS")).getByRole("button", { pressed: true })).toHaveTextContent("Active2");
    expect(within(section("STATUS")).getByRole("button", { name: /^No Status/ })).toHaveTextContent("1");
    expect(within(section("TAGS")).getByRole("button", { pressed: true })).toHaveTextContent("bug1");
    expect(within(section("TAGS")).getByRole("button", { name: /^work/ })).toHaveTextContent("2");
  });

  it("asks for the status, the tag and All Notes that were clicked", async () => {
    const { session } = await settingsSession();
    const handlers = renderSidebar(BLOG, session);

    fireEvent.click(within(section("STATUS")).getByRole("button", { name: /^No Status/ }));
    fireEvent.click(within(section("TAGS")).getByRole("button", { name: /^bug/ }));
    fireEvent.click(screen.getByRole("button", { name: "All Notes" }));

    expect(handlers.onToggleStatus).toHaveBeenCalledWith("noStatus");
    expect(handlers.onToggleTag).toHaveBeenCalledWith("bug");
    expect(handlers.onSelectAllNotes).toHaveBeenCalledTimes(1);
  });

  it("marks All Notes while it is the scope", async () => {
    const { session } = await settingsSession();
    renderSidebar({ ...BLOG, selectedWorkspace: null, showsAllNotes: true }, session);

    expect(screen.getByRole("button", { name: "All Notes" })).toHaveAttribute("aria-pressed", "true");
  });

  it("folds a section away on its title and unfolds it on the next click, writing each choice", async () => {
    const { session, channels } = await settingsSession();
    renderSidebar(BLOG, session);
    const title = within(section("TAGS")).getByRole("button", { name: /^TAGS/ });

    act(() => fireEvent.click(title));

    expect(title).toHaveAttribute("aria-expanded", "false");
    expect(within(section("TAGS")).queryByRole("button", { name: /^work/ })).not.toBeInTheDocument();
    expect(channels.writeSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ sidebar: { collapsedSections: ["tags"] } }),
    );

    act(() => fireEvent.click(title));

    expect(title).toHaveAttribute("aria-expanded", "true");
    expect(within(section("TAGS")).getByRole("button", { name: /^work/ })).toBeInTheDocument();
    expect(channels.writeSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ sidebar: { collapsedSections: [] } }),
    );
  });

  it("opens with the sections the settings say were folded", async () => {
    const { session } = await settingsSession(["tags", "workspaces"]);
    renderSidebar(BLOG, session);

    expect(section("TAGS")).not.toHaveTextContent("work");
    expect(section("WORKSPACES")).not.toHaveTextContent("workspace 清單");
    expect(rowsOf("STATUS")).toHaveLength(5);
  });

  it("still folds the section when the settings cannot be written, without a word about it", async () => {
    const { session } = await settingsSession([], () =>
      Promise.resolve({ ok: false, reason: "unexpected", message: "disk full" }),
    );
    renderSidebar(BLOG, session);

    act(() => fireEvent.click(within(section("TAGS")).getByRole("button", { name: /^TAGS/ })));

    expect(section("TAGS")).not.toHaveTextContent("work");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
