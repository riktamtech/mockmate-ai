import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Clock, Briefcase, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { notificationService } from "../../services/notificationService";

const TYPE_ICONS = {
  APPLICATION_SUBMITTED: Briefcase,
  APPLICATION_APPROVED: Check,
  APPLICATION_REJECTED: Clock,
  INTERVIEW_SCHEDULED: Clock,
  INTERVIEW_REMINDER: Bell,
  DEFAULT: Bell,
};

const TYPE_COLORS = {
  APPLICATION_SUBMITTED: "#8B5CF6",
  APPLICATION_APPROVED: "#10B981",
  APPLICATION_REJECTED: "#EF4444",
  INTERVIEW_SCHEDULED: "#3B82F6",
  INTERVIEW_REMINDER: "#F59E0B",
  DEFAULT: "#6B7280",
};

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(null);
  const navigate = useNavigate();
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  const fetchNotifications = useCallback(async (nextCursor) => {
    try {
      nextCursor ? setLoadingMore(true) : setLoading(true);
      const res = await notificationService.getNotifications(nextCursor);
      if (res.success) {
        setNotifications(prev => nextCursor ? [...prev, ...(res.data || [])] : (res.data || []));
        setHasMore(res.meta?.hasMore ?? false);
        setCursor(res.meta?.nextCursor ?? null);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchNotifications(null); }, [fetchNotifications]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore) return;
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && cursor) fetchNotifications(cursor);
    }, { threshold: 0.1 });
    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, cursor, loadingMore, fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) { console.error(err); }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) { console.error(err); }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div style={{ padding: "32px 24px", maxWidth: "700px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
            style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: "10px", padding: "8px", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}>
            <ArrowLeft size={18} />
          </motion.button>
          <Bell size={22} color="#8B5CF6" />
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#f1f1f4" }}>Notifications</h1>
          {unreadCount > 0 && (
            <span style={{ padding: "2px 10px", borderRadius: "12px", background: "rgba(139,92,246,0.15)", color: "#8B5CF6", fontSize: "12px", fontWeight: 600 }}>
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleMarkAllRead}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
            <CheckCheck size={14} /> Mark all read
          </motion.button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{ width: "28px", height: "28px", border: "2px solid rgba(139,92,246,0.2)", borderTop: "2px solid #8B5CF6", borderRadius: "50%" }} />
        </div>
      )}

      {/* Empty */}
      {!loading && notifications.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)" }}>
          <Bell size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: "14px" }}>No notifications yet</p>
        </div>
      )}

      {/* Notification List */}
      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <AnimatePresence>
            {notifications.map((notification, index) => {
              const IconComp = TYPE_ICONS[notification.type] || TYPE_ICONS.DEFAULT;
              const color = TYPE_COLORS[notification.type] || TYPE_COLORS.DEFAULT;
              return (
                <motion.div key={notification._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  onClick={() => !notification.isRead && handleMarkAsRead(notification._id)}
                  style={{
                    display: "flex", gap: "12px", padding: "14px 16px", borderRadius: "12px",
                    background: notification.isRead ? "rgba(255,255,255,0.01)" : "rgba(139,92,246,0.04)",
                    border: notification.isRead ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(139,92,246,0.12)",
                    cursor: notification.isRead ? "default" : "pointer",
                    transition: "all 0.2s",
                  }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: `${color}12`, border: `1px solid ${color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <IconComp size={16} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: notification.isRead ? 400 : 600, color: notification.isRead ? "rgba(255,255,255,0.5)" : "#f1f1f4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {notification.title}
                      </p>
                      {!notification.isRead && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#8B5CF6", flexShrink: 0 }} />}
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.35)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {notification.body}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} style={{ height: "1px" }} />

          {loadingMore && (
            <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                style={{ width: "20px", height: "20px", border: "2px solid rgba(139,92,246,0.2)", borderTop: "2px solid #8B5CF6", borderRadius: "50%" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
