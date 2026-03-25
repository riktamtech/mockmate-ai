import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, ExternalLink, X } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";

/**
 * NotificationBell — Bell icon with animated unread count badge.
 * Click to reveal the NotificationPanel dropdown.
 * All colors use CSS custom properties for theme awareness.
 */

export function NotificationBell() {
  const { unreadCount, notifications, markAsRead, markAllAsRead, loading } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {/* Bell button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "relative",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px",
          borderRadius: "12px",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Bell size={20} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                width: unreadCount > 9 ? "20px" : "16px",
                height: "16px",
                borderRadius: "8px",
                background: "var(--error)",
                color: "#fff",
                fontSize: "10px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setIsOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 40,
              }}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="glass"
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                width: "360px",
                maxHeight: "440px",
                borderRadius: "16px",
                background: "var(--bg-glass)",
                border: "1px solid var(--bg-glass-border)",
                boxShadow: "var(--bg-glass-shadow)",
                zIndex: 50,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Notifications
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--accent-text)",
                        fontSize: "11px",
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <CheckCheck size={12} />
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {/* Notification list */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  maxHeight: "340px",
                }}
              >
                {notifications.length === 0 ? (
                  <div
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: "13px",
                    }}
                  >
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 10).map((notification) => (
                    <motion.div
                      key={notification._id}
                      whileHover={{
                        background: "var(--hover-overlay-medium)",
                      }}
                      onClick={() => {
                        if (!notification.isRead) {
                          markAsRead(notification._id);
                        }
                      }}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                      }}
                    >
                      {/* Unread dot */}
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: notification.isRead
                            ? "transparent"
                            : "var(--accent)",
                          marginTop: "6px",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            fontWeight: notification.isRead ? 400 : 600,
                            color: notification.isRead
                              ? "var(--text-secondary)"
                              : "var(--text-primary)",
                            lineHeight: 1.4,
                          }}
                        >
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p
                            style={{
                              margin: "2px 0 0",
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {notification.body}
                          </p>
                        )}
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: "10px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {new Date(notification.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div
                  style={{
                    padding: "10px 16px",
                    borderTop: "1px solid var(--border-subtle)",
                    textAlign: "center",
                  }}
                >
                  <a
                    href="/mockmate/candidate/notifications"
                    style={{
                      color: "var(--accent-text)",
                      fontSize: "12px",
                      fontWeight: 500,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    View all notifications
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
