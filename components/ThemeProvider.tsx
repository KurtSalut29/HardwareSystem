"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; toggle: (t: Theme) => void }>({ theme: "light", toggle: () => {} });

// The public storefront and the sign-in / create-account screen are always shown
// in light mode. A dark preference saved from the dashboard still applies everywhere else.
const LIGHT_ONLY_PATHS = ["/", "/login", "/signup"];
const THEME_EVENT = "theme-change";

// The saved preference lives in localStorage; other tabs report changes through "storage".
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}
const readTheme = (): Theme => (localStorage.getItem("theme") === "dark" ? "dark" : "light");
const serverTheme = (): Theme => "light";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);
  const pathname = usePathname();

  useEffect(() => {
    const shown = LIGHT_ONLY_PATHS.includes(pathname) ? "light" : theme;
    document.documentElement.classList.toggle("dark", shown === "dark");
  }, [pathname, theme]);

  function toggle(t: Theme) {
    localStorage.setItem("theme", t);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
