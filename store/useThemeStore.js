import { create } from "zustand";

/**
 * useThemeStore — Global theme state with localStorage persistence.
 *
 * Manages light/dark mode toggle and applies the `.dark` class
 * to the document root for Tailwind CSS dark mode support.
 *
 * Default: light mode (unless user has stored preference or
 * system prefers dark).
 */

const STORAGE_KEY = "mockmate-theme";

function getInitialTheme() {
  if (typeof window === "undefined") return "light";

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  // Respect system preference as fallback
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  // Default to light mode
  return "light";
}

function applyThemeToDOM(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  }
}

// Apply on load
const initialTheme = getInitialTheme();
applyThemeToDOM(initialTheme);

export const useThemeStore = create((set) => ({
  theme: initialTheme,

  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyThemeToDOM(theme);
    set({ theme });
  },

  toggleTheme: () => {
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyThemeToDOM(next);
      return { theme: next };
    });
  },

  isDark: () => {
    return useThemeStore.getState().theme === "dark";
  },
}));
