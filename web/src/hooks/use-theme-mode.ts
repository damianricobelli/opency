import { useCallback, useEffect, useSyncExternalStore } from "react";

export const THEME_MODES = ["light", "dark", "auto"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
type ResolvedTheme = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
};

/** The `localStorage` key that keeps the visitor's choice. */
export const THEME_STORAGE_KEY = "theme";
/** A visitor who never chose follows the system. */
export const DEFAULT_THEME_MODE = "auto" satisfies ThemeMode;

/**
 * The page background per theme (`--background` in `styles.css`), which
 * mobile browsers paint behind the status bar and their own toolbar through `<meta name="theme-color">`.
 */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#faf9f7",
  dark: "#0f0e0d",
};

/**
 * Runs in `<head>` before the first paint (`__root.tsx`): applies the stored
 * choice the way `applyThemeMode` does and adds the one `theme-color` tag
 * `useThemeMode` keeps in sync. Built from the constants above so the first
 * paint and the hook never disagree on the key, the modes or the default.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var mode=${JSON.stringify(THEME_MODES)}.indexOf(stored)>=0?stored:${JSON.stringify(DEFAULT_THEME_MODE)};var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;var themeColor=document.createElement('meta');themeColor.name='theme-color';themeColor.content=resolved==='dark'?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)};document.head.appendChild(themeColor);}catch(e){}})();`;

function isThemeMode(value: string | null): value is ThemeMode {
  return (THEME_MODES as readonly (string | null)[]).includes(value);
}

function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_MODE;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

function getDocumentTheme(): ResolvedTheme | null {
  if (typeof document === "undefined") {
    return null;
  }

  if (document.documentElement.classList.contains("dark")) {
    return "dark";
  }

  if (document.documentElement.classList.contains("light")) {
    return "light";
  }

  return null;
}

function resolveThemeMode(mode: ThemeMode): ResolvedTheme {
  if (mode !== "auto") {
    return mode;
  }

  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getThemeState(): ThemeState {
  const mode = getStoredThemeMode();

  return {
    mode,
    resolvedTheme: getDocumentTheme() ?? resolveThemeMode(mode),
  };
}

function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  const resolved = resolveThemeMode(mode);
  const root = document.documentElement;

  root.classList.remove("light", "dark");
  root.classList.add(resolved);

  if (mode === "auto") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", mode);
  }

  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolved]);
}

const themeListeners = new Set<() => void>();

function notifyTheme() {
  for (const notify of themeListeners) notify();
}

let stopObservingTheme: (() => void) | undefined;

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  stopObservingTheme ??= observeTheme();
  return () => {
    themeListeners.delete(listener);
    if (themeListeners.size === 0) {
      stopObservingTheme?.();
      stopObservingTheme = undefined;
    }
  };
}

/**
 * One set of observers for every `useThemeMode`: the `<html>` classes the
 * init script and `applyThemeMode` write, the system scheme (for `auto`), and
 * other tabs changing the stored choice.
 */
function observeTheme() {
  const observer =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(notifyTheme);
  observer?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });

  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  const onSystemThemeChange = () => {
    if (getStoredThemeMode() === "auto") {
      applyThemeMode("auto");
    }
    notifyTheme();
  };
  media?.addEventListener("change", onSystemThemeChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) {
      return;
    }
    applyThemeMode(getStoredThemeMode());
    notifyTheme();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    observer?.disconnect();
    media?.removeEventListener("change", onSystemThemeChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The server can't read the visitor's choice or their system: it renders,
 * and the page hydrates, as `auto` drawn light; the real theme takes over
 * right after (and the init script has already painted it). */
const SERVER_THEME: ThemeState = {
  mode: DEFAULT_THEME_MODE,
  resolvedTheme: "light",
};
const getServerMode = () => SERVER_THEME.mode;
const getServerResolvedTheme = () => SERVER_THEME.resolvedTheme;
const getMode = () => getThemeState().mode;
const getResolvedTheme = () => getThemeState().resolvedTheme;

/**
 * Subscribes to the document color theme: reads/writes the `"theme"` key in `localStorage`,
 * applies `light`/`dark` classes plus `data-theme` and `colorScheme` on `<html>`, and stays
 * in sync via `MutationObserver`, system `prefers-color-scheme`, and cross-tab `storage` events.
 *
 * Hydration reads the server's default (`auto`, drawn light), never `localStorage`, so the
 * markup matches the server's; anything that must look right from the first
 * paint follows `<html data-theme>` in CSS instead (see `ThemeToggle`).
 */
export function useThemeMode() {
  const mode = useSyncExternalStore(subscribeTheme, getMode, getServerMode);
  const resolvedTheme = useSyncExternalStore(
    subscribeTheme,
    getResolvedTheme,
    getServerResolvedTheme,
  );

  const setThemeMode = useCallback((nextMode: ThemeMode) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch {
      // Blocked storage: the choice lasts for this page only.
    }

    applyThemeMode(nextMode);
    notifyTheme();
  }, []);

  useEffect(() => {
    // The init script already applied the stored theme; this repairs a
    // document it couldn't reach (blocked storage, a script error).
    applyThemeMode(getStoredThemeMode());
  }, []);

  return {
    /** User preference (`light`, `dark`, or `auto` to follow the OS/browser). */
    mode,
    /** Effective palette (`light` or `dark`), including resolution of `auto`
     * from `prefers-color-scheme` when the document does not already encode a theme class. */
    resolvedTheme,
    /** Persists the choice, updates `<html>` (classes / `data-theme` / `colorScheme`),
     * and refreshes hook state so consumers re-render with the new `mode` and `resolvedTheme`. */
    setThemeMode,
    isDark: resolvedTheme === "dark",
    isLight: resolvedTheme === "light",
  };
}
