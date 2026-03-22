import { useState, useEffect, useCallback, useRef } from "react";
import { axiosInstance } from "../services/api";

/**
 * useNotifications — Custom hook for notification state management.
 *
 * Handles fetching, polling, mark-as-read, and unread count.
 * Polls every 30 seconds for new notifications.
 */

const POLL_INTERVAL = 30000; // 30 seconds

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(null);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(
    async (isLoadMore = false) => {
      try {
        setLoading(true);
        const params = { limit: 15 };
        if (isLoadMore && cursor) params.cursor = cursor;

        const { data } = await axiosInstance.get("/api/notifications", {
          params,
        });

        if (data.success) {
          const items = data.data || [];
          setNotifications((prev) =>
            isLoadMore ? [...prev, ...items] : items,
          );
          setHasMore(data.meta?.hasMore || false);
          setCursor(data.meta?.nextCursor || null);
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
      } finally {
        setLoading(false);
      }
    },
    [cursor],
  );

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get("/api/notifications/unread-count");
      if (data.success) {
        setUnreadCount(data.data?.count || 0);
      }
    } catch (err) {
      // Silent fail for polling
    }
  }, []);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await axiosInstance.put(`/api/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notificationId
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await axiosInstance.put("/api/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  }, []);

  // Start polling
  useEffect(() => {
    fetchNotifications(false);
    fetchUnreadCount();

    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    hasMore,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    loadMore: () => fetchNotifications(true),
  };
}
