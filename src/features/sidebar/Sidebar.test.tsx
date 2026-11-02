import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ArticleSummary } from "../../ipc/articleSummary";
import type { ChannelResult } from "../../ipc/channelResult";
import type { Settings } from "../../ipc/settings";
import { InterfaceLanguageProvider } from "../interfaceLanguage/InterfaceLanguageContext";
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
    excerpt: null,
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
  it("puts the search button above All Notes", async () => {
    const { session } = await settingsSession();
    render(
      <Sidebar
        snapshot={BLOG}
        settings={session}
        workspaces={<p>workspace 清單</p>}
        searchButton={<button type="button">搜尋</button>}
        onSelectAllNotes={vi.fn()}
        onToggleStatus={vi.fn()}
        onToggleTag={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("搜尋");
    expect(buttons[1]).toHaveTextContent("所有文章");
  });

  it("puts All Notes above the workspace, status and tag sections, in that order", async () => {
    const { session } = await settingsSession();
    renderSidebar(BLOG, session);

    const titles = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(titles).toEqual(["WORKSPACES", "狀態", "標籤"]);
    expect(screen.getAllByRole("button")[0]).toHaveTextContent("所有文章");
    expect(section("WORKSPACES")).toHaveTextContent("workspace 清單");
  });

  it("speaks English in its entry, titles, statuses and empty tag list when English is in use", async () => {
    const { session } = await settingsSession();
    render(
      <InterfaceLanguageProvider language="en">
        <Sidebar
          snapshot={{ ...BLOG, articles: [article(null)] }}
          settings={session}
          workspaces={<p>workspaces</p>}
          onSelectAllNotes={vi.fn()}
          onToggleStatus={vi.fn()}
          onToggleTag={vi.fn()}
        />
      </InterfaceLanguageProvider>,
    );

    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "WORKSPACES",
      "STATUS",
      "TAGS",
    ]);
    expect(screen.getAllByRole("button")[0]).toHaveTextContent("All Notes");
    expect(rowsOf("STATUS").map((row) => row.textContent)).toEqual([
      "Active0",
      "On Hold0",
      "Completed0",
      "Dropped0",
      "No Status1",
    ]);
    expect(section("TAGS")).toHaveTextContent("No tags yet");
  });

  it("shows the five statuses with how many articles of the scope have each", async () => {
    const { session } = await settingsSession();
    renderSidebar(BLOG, session);

    expect(rowsOf("狀態").map((row) => row.textContent)).toEqual([
      "進行中2",
      "暫停0",
      "已完成0",
      "已放棄0",
      "未標記1",
    ]);
  });

  it("puts each status's own dot before it, and none before No Status", async () => {
    const { session } = await settingsSession();
    renderSidebar(BLOG, session);

    expect(rowsOf("狀態").map((row) => row.querySelector(".status-dot")?.className ?? null)).toEqual([
      "status-dot status-dot--active",
      "status-dot status-dot--onHold",
      "status-dot status-dot--completed",
      "status-dot status-dot--dropped",
      null,
    ]);
    expect(rowsOf("狀態").at(0)?.querySelector(".status-dot")).toHaveAttribute("aria-hidden", "true");
  });

  it("marks each tag row with a hash that is not read out", async () => {
    const { session } = await settingsSession();
    renderSidebar(BLOG, session);

    expect(rowsOf("標籤").map((row) => row.querySelector(".row-hash")?.getAttribute("aria-hidden"))).toEqual([
      "true",
      "true",
    ]);
  });

  it("keeps the five statuses at zero when the scope has no articles", async () => {
    const { session } = await settingsSession();
    renderSidebar({ ...BLOG, articles: [] }, session);

    expect(rowsOf("狀態").map((row) => row.textContent)).toEqual([
      "進行中0",
      "暫停0",
      "已完成0",
      "已放棄0",
      "未標記0",
    ]);
    expect(within(section("標籤")).getByText("還沒有標籤")).toBeInTheDocument();
    expect(rowsOf("標籤")).toHaveLength(0);
  });

  it("lists the tags most used first with their counts", async () => {
    const { session } = await settingsSession();
    renderSidebar(BLOG, session);

    expect(rowsOf("標籤").map((row) => row.textContent)).toEqual([
      "work2",
      "bug1",
    ]);
  });

  it("marks what is chosen and keeps every count as it was", async () => {
    const { session } = await settingsSession();
    renderSidebar({ ...BLOG, sidebarFilter: SidebarFilter.NONE.toggleStatus("active").toggleTag("bug") }, session);

    expect(within(section("狀態")).getByRole("button", { pressed: true })).toHaveTextContent("進行中2");
    expect(within(section("狀態")).getByRole("button", { name: /^未標記/ })).toHaveTextContent("1");
    expect(within(section("標籤")).getByRole("button", { pressed: true })).toHaveTextContent("bug1");
    expect(within(section("標籤")).getByRole("button", { name: /^work/ })).toHaveTextContent("2");
  });

  it("keeps counting Completed while Active is chosen", async () => {
    const { session } = await settingsSession();
    const articles = [article("active"), article("active"), article("active"), article("completed")];
    renderSidebar({ ...BLOG, articles, sidebarFilter: SidebarFilter.NONE.toggleStatus("active") }, session);

    expect(rowsOf("狀態").map((row) => row.textContent)).toEqual([
      "進行中3",
      "暫停0",
      "已完成1",
      "已放棄0",
      "未標記0",
    ]);
  });

  it("asks for the status, the tag and All Notes that were clicked", async () => {
    const { session } = await settingsSession();
    const handlers = renderSidebar(BLOG, session);

    fireEvent.click(within(section("狀態")).getByRole("button", { name: /^未標記/ }));
    fireEvent.click(within(section("標籤")).getByRole("button", { name: /^bug/ }));
    fireEvent.click(screen.getByRole("button", { name: "所有文章" }));

    expect(handlers.onToggleStatus).toHaveBeenCalledWith("noStatus");
    expect(handlers.onToggleTag).toHaveBeenCalledWith("bug");
    expect(handlers.onSelectAllNotes).toHaveBeenCalledTimes(1);
  });

  it("marks All Notes while it is the scope", async () => {
    const { session } = await settingsSession();
    renderSidebar({ ...BLOG, selectedWorkspace: null, showsAllNotes: true }, session);

    expect(screen.getByRole("button", { name: "所有文章" })).toHaveAttribute("aria-pressed", "true");
  });

  it("folds a section away on its title and unfolds it on the next click, writing each choice", async () => {
    const { session, channels } = await settingsSession();
    renderSidebar(BLOG, session);
    const title = within(section("標籤")).getByRole("button", { name: /^標籤/ });

    act(() => fireEvent.click(title));

    expect(title).toHaveAttribute("aria-expanded", "false");
    expect(within(section("標籤")).queryByRole("button", { name: /^work/ })).not.toBeInTheDocument();
    expect(channels.writeSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ sidebar: { collapsedSections: ["tags"] } }),
    );

    act(() => fireEvent.click(title));

    expect(title).toHaveAttribute("aria-expanded", "true");
    expect(within(section("標籤")).getByRole("button", { name: /^work/ })).toBeInTheDocument();
    expect(channels.writeSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ sidebar: { collapsedSections: [] } }),
    );
  });

  it("opens with the sections the settings say were folded", async () => {
    const { session } = await settingsSession(["tags", "workspaces"]);
    renderSidebar(BLOG, session);

    expect(section("標籤")).not.toHaveTextContent("work");
    expect(section("WORKSPACES")).not.toHaveTextContent("workspace 清單");
    expect(rowsOf("狀態")).toHaveLength(5);
  });

  it("still folds the section when the settings cannot be written, without a word about it", async () => {
    const { session } = await settingsSession([], () =>
      Promise.resolve({ ok: false, reason: "unexpected", message: "disk full" }),
    );
    renderSidebar(BLOG, session);

    act(() => fireEvent.click(within(section("標籤")).getByRole("button", { name: /^標籤/ })));

    expect(section("標籤")).not.toHaveTextContent("work");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
