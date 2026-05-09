import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getSystemColorScheme,
  isDarkTheme,
  loadSettings,
  resolveThemePreference,
  type ResolvedTheme,
  type SystemColorScheme
} from "../lib/settings";
import { useSettingsStore } from "../stores/settingsStore";

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme;
  systemColorScheme: SystemColorScheme;
};

const ThemeContext = createContext<ThemeContextValue>({
  resolvedTheme: "light-mesh",
  systemColorScheme: "light"
});

function applyTheme(resolvedTheme: ResolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = isDarkTheme(resolvedTheme) ? "dark" : "light";
}

export function initializeThemeOnLoad() {
  const settings = loadSettings();
  const systemColorScheme = getSystemColorScheme();
  applyTheme(resolveThemePreference(settings.themePreference, systemColorScheme));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themePreference = useSettingsStore((state) => state.themePreference);
  const [systemColorScheme, setSystemColorScheme] = useState<SystemColorScheme>(() =>
    getSystemColorScheme()
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (event?: MediaQueryListEvent) => {
      setSystemColorScheme(event?.matches ?? mediaQuery.matches ? "dark" : "light");
    };

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const resolvedTheme = resolveThemePreference(themePreference, systemColorScheme);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const value = useMemo(
    () => ({
      resolvedTheme,
      systemColorScheme
    }),
    [resolvedTheme, systemColorScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
