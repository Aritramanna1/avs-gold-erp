import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = "mtj-app-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    }
    // Default theme must be "light" according to the instructions
    return "light";
  });

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      // Remove both possible classes first to be safe
      root.classList.remove("light", "dark");

      const systemIsDark = mediaQuery.matches;
      let computedDark = false;

      if (theme === "dark") {
        root.classList.add("dark");
        computedDark = true;
      } else if (theme === "light") {
        root.classList.add("light");
        computedDark = false;
      } else {
        // System
        if (systemIsDark) {
          root.classList.add("dark");
          computedDark = true;
        } else {
          root.classList.add("light");
          computedDark = false;
        }
      }

      setIsDark(computedDark);
    };

    applyTheme();

    // Listen for system changes if system is selected
    const handleSystemChange = () => {
      if (theme === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
