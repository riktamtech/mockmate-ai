import React from "react";
import { Code2 } from "lucide-react";
import { PanelLeft } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { useThemeStore } from "../../store/useThemeStore";
import ThemeToggle from "./ThemeToggle";

/**
 * AppHeader — Global top-bar for all authenticated pages.
 *
 * Contains: sidebar toggle, brand, theme toggle, user avatar.
 * Theme-aware via CSS custom properties.
 */

export default function AppHeader({ onToggleSidebar }) {
  const user = useAppStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);

  return (
    <header
      className="sticky top-0 z-30 glass-sm theme-transition"
      style={{
        background: "color-mix(in srgb, var(--bg-base) 85%, transparent)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left: sidebar toggle + brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl transition-colors duration-200"
              style={{
                color: "var(--text-muted)",
                background: "transparent",
                border: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--hover-overlay-medium)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
              aria-label="Toggle sidebar"
            >
              <PanelLeft size={20} />
            </button>

            <div className="flex items-center gap-2.5">
              <div
                className="p-1.5 rounded-lg"
                style={{ background: "var(--accent-gradient)" }}
              >
                <Code2 size={18} className="text-white" />
              </div>
              <div className="hidden sm:block">
                <h1
                  className="text-base font-bold leading-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  Zi MockMate
                </h1>
                <p
                  className="text-[10px] leading-tight"
                  style={{ color: "var(--text-muted)" }}
                >
                  AI Interview Coach
                </p>
              </div>
            </div>
          </div>

          {/* Right: theme toggle + user */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle size="md" />

            <div
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl transition-colors duration-200 cursor-pointer"
              style={{ background: "transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--hover-overlay)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm"
                style={{ background: "var(--accent-gradient)" }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="hidden sm:block text-left">
                <p
                  className="text-sm font-medium leading-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {user?.name || "User"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
