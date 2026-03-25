import React from "react";
import {
  X,
  LogOut,
  User,
  LayoutDashboard,
  PlayCircle,
  FileText,
  Settings,
  ChartNoAxesCombined,
  Sparkles,
  Briefcase,
  Calendar,
  BarChart3,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { AppState } from "../types";

/**
 * SideDrawer — Right-aligned slide-out drawer (legacy, may be unused).
 * Theme-aware via CSS custom properties.
 */
export const SideDrawer = ({ isOpen, onClose }) => {
  const { user, setUser, resetSession, setAppState } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 glass-sm transition-opacity"
        style={{ background: "var(--backdrop)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="relative w-80 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300 theme-transition"
        style={{
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="p-6"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
            >
              <User size={24} />
            </div>
            <div className="overflow-hidden">
              <h3
                className="font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {user?.name || user?.email.split("@")[0]}
              </h3>
              <p
                className="text-xs truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {user?.email || "user@example.com"}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className="flex items-center gap-3 w-full p-3 rounded-xl transition-all text-left"
                style={{
                  background: isActive ? "var(--accent-bg)" : "transparent",
                  color: isActive ? "var(--accent-text)" : "var(--text-secondary)",
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
                <item.icon
                  size={20}
                  style={{
                    color: isActive
                      ? "var(--accent-text)"
                      : item.badge
                        ? "var(--warning)"
                        : "var(--text-muted)",
                  }}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div
          className="p-4"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full p-3 rounded-xl transition-colors text-left font-medium"
            style={{ color: "var(--error)", background: "transparent" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--error-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
