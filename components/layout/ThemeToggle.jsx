import React from "react";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../../store/useThemeStore";

/**
 * ThemeToggle — Animated sun/moon toggle button.
 * Uses CSS custom properties for theme-aware styling.
 */

export default function ThemeToggle({ size = "md" }) {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  const sizes = {
    sm: { btn: "w-8 h-8", icon: 14 },
    md: { btn: "w-9 h-9", icon: 16 },
    lg: { btn: "w-10 h-10", icon: 18 },
  };

  const s = sizes[size] || sizes.md;

  return (
    <motion.button
      onClick={toggleTheme}
      className={`${s.btn} rounded-xl flex items-center justify-center transition-colors duration-200`}
      style={{
        background: "var(--hover-overlay)",
        border: "1px solid var(--border-subtle)",
      }}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, scale: 0, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={{ rotate: 90, scale: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {isDark ? (
          <Sun size={s.icon} style={{ color: "#fbbf24" }} />
        ) : (
          <Moon size={s.icon} style={{ color: "#6366f1" }} />
        )}
      </motion.div>
    </motion.button>
  );
}
