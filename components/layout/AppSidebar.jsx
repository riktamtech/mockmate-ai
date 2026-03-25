import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  LogOut,
  User,
  LayoutDashboard,
  PlayCircle,
  Sparkles,
  Briefcase,
  Calendar,
  BarChart3,
  Settings,
  ChartNoAxesCombined,
  Bell,
  PanelLeftClose,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";
import { useThemeStore } from "../../store/useThemeStore";
import { AppState } from "../../types";
import ThemeToggle from "./ThemeToggle";

/**
 * AppSidebar — Left-aligned slide-out sidebar with theme-aware styling.
 * Uses CSS custom properties for all theme colors.
 */

export default function AppSidebar({ isOpen, onClose }) {
  const { user, setUser, resetSession, setAppState } = useAppStore();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    resetSession();
    navigate("/mockmate/login");
  };

  const handleNavigation = (path) => {
    if (path === "/mockmate/candidate/practice") {
      resetSession();
      setAppState(AppState.LANDING);
    }
    navigate(path);
    onClose();
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/mockmate/candidate/dashboard" },
    { icon: PlayCircle, label: "Practice Interview", path: "/mockmate/candidate/practice" },
    { icon: Sparkles, label: "Proctored Interview", path: "/mockmate/candidate/proctored-interview", badge: "NEW" },
    { icon: Briefcase, label: "Active Job Openings", path: "/mockmate/candidate/jobs", badge: "NEW" },
    { icon: Calendar, label: "Events", path: "/mockmate/candidate/events" },
    { icon: BarChart3, label: "Job Analytics", path: "/mockmate/candidate/analytics" },
    { icon: Bell, label: "Notifications", path: "/mockmate/candidate/notifications" },
    { icon: Settings, label: "Profile Settings", path: "/mockmate/candidate/profile" },
  ];

  if (user?.isAdmin) {
    menuItems.push({
      icon: ChartNoAxesCombined,
      label: "Admin Dashboard",
      path: "/mockmate/admin",
    });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-start">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 glass-sm"
            style={{ background: "var(--backdrop)" }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-72 sm:w-80 h-full flex flex-col theme-transition"
            style={{
              background: "var(--bg-surface)",
              borderRight: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Header */}
            <div
              className="p-5 pb-4"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base"
                    style={{ background: "var(--accent-gradient)" }}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="overflow-hidden">
                    <h3
                      className="font-semibold text-sm leading-tight truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {user?.name || user?.email?.split("@")[0]}
                    </h3>
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {user?.email || "user@example.com"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-xl transition-colors duration-200"
                  style={{
                    color: "var(--text-muted)",
                    background: "transparent",
                    border: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--hover-overlay-medium)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle size="sm" />
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {isDark ? "Dark Mode" : "Light Mode"}
                </span>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className="flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 text-left"
                    style={{
                      background: isActive ? "var(--accent-bg)" : "transparent",
                      color: isActive
                        ? "var(--accent-text)"
                        : "var(--text-secondary)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "var(--hover-overlay)";
                        e.currentTarget.style.color = "var(--text-primary)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }
                    }}
                  >
                    <Icon
                      size={18}
                      style={{
                        color: isActive
                          ? "var(--accent-text)"
                          : item.badge
                            ? "var(--warning)"
                            : "inherit",
                        flexShrink: 0,
                      }}
                    />
                    <span className="flex-1 text-sm">{item.label}</span>
                    {item.badge && (
                      <span
                        className="px-1.5 py-0.5 text-[9px] font-bold text-white rounded-full"
                        style={{
                          background: "var(--badge-new-bg)",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Logout */}
            <div
              className="p-3"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 text-left"
                style={{
                  color: "var(--error)",
                  background: "transparent",
                  fontWeight: 500,
                  fontSize: "14px",
                  border: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--error-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
