import { describe, expect, it, vi } from "vitest";

import { browserSystemAppearance, browserThemeCache } from "./browserThemeEnvironment";

function refusingStorage(): Storage {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  } as unknown as Storage;
}

describe("browserThemeCache", () => {
  it("reads back what it wrote", () => {
    window.localStorage.clear();
    const cache = browserThemeCache();

    cache.write("forest");

    expect(browserThemeCache().read()).toBe("forest");
  });

  it("reads nothing before anything is written", () => {
    window.localStorage.clear();

    expect(browserThemeCache().read()).toBeNull();
  });

  it("treats a storage that refuses as empty and never throws", () => {
    const cache = browserThemeCache(refusingStorage);

    expect(() => cache.write("forest")).not.toThrow();
    expect(cache.read()).toBeNull();
  });
});

describe("browserSystemAppearance", () => {
  it("answers from the dark colour scheme query and stops listening on request", () => {
    const query = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue(query as unknown as MediaQueryList);
    const listener = vi.fn();

    const system = browserSystemAppearance();
    const stop = system.watch(listener);
    stop();

    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(system.isDark()).toBe(true);
    expect(query.addEventListener).toHaveBeenCalledWith("change", listener);
    expect(query.removeEventListener).toHaveBeenCalledWith("change", listener);
    matchMedia.mockRestore();
  });
});
