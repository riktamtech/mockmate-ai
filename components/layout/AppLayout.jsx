import React, { useState, useEffect } from "react";
import { useThemeStore } from "../../store/useThemeStore";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";

/**
 * AppLayout — Global layout wrapper for all authenticated pages
 * (except interview/proctored chat sessions).
 *
 * Contains: Left sidebar + Top header + Main content area.
 * Background adapts to the current theme via CSS custom properties.
 */

export default function AppLayout({ children }) {
  const theme = useThemeStore((s) => s.theme);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [sidebarOpen]);

  return (
    <div
      className="min-h-screen theme-transition"
      style={{ background: "var(--bg-base-gradient)" }}
    >
      <AppSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <AppHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
