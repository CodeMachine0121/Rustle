import type { SystemAppearance, ThemeCache } from "./ThemeSession";

const CACHE_KEY = "rustle.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The cache lives in the webview's storage; a storage that refuses is treated as empty. */
export function browserThemeCache(storage: () => Storage = () => window.localStorage): ThemeCache {
  return {
    read: () => {
      try {
        return storage().getItem(CACHE_KEY);
      } catch {
        return null;
      }
    },
    write: (choice) => {
      try {
        storage().setItem(CACHE_KEY, choice);
      } catch {
        // Only the next first frame depends on it; the settings file still remembers.
      }
    },
  };
}

export function browserSystemAppearance(): SystemAppearance {
  const query = window.matchMedia(DARK_QUERY);
  return {
    isDark: () => query.matches,
    watch: (listener) => {
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
  };
}
