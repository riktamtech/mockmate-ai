import { axiosInstance } from "./api";

/**
 * Notification API service
 */
export const notificationService = {
  getNotifications: async (cursor) => {
    const params = { limit: 15 };
    if (cursor) params.cursor = cursor;
    const { data } = await axiosInstance.get("/api/notifications", { params });
    return data;
  },
  getUnreadCount: async () => {
    const { data } = await axiosInstance.get("/api/notifications/unread-count");
    return data;
  },
  markAsRead: async (id) => {
    const { data } = await axiosInstance.put(`/api/notifications/${id}/read`);
    return data;
  },
  markAllAsRead: async () => {
    const { data } = await axiosInstance.put("/api/notifications/read-all");
    return data;
  },
};
