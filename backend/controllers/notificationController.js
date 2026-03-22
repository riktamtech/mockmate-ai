const Notification = require("../models/Notification");

/**
 * Notification Controller
 *
 * Handles CRUD operations for in-app notifications
 * and read/unread state management.
 */

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user.
 */
const getNotifications = async (req, res) => {
  try {
    const { cursor, limit = 15, unreadOnly } = req.query;
    const pageLimit = Math.min(parseInt(limit) || 15, 50);

    const query = { userId: req.user._id };
    if (cursor) query._id = { $lt: cursor };
    if (unreadOnly === "true") query.isRead = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(pageLimit + 1)
      .lean();

    const hasMore = notifications.length > pageLimit;
    const results = hasMore
      ? notifications.slice(0, pageLimit)
      : notifications;
    const nextCursor =
      hasMore && results.length > 0
        ? results[results.length - 1]._id
        : null;

    res.status(200).json({
      success: true,
      data: results,
      meta: { count: results.length, hasMore, nextCursor },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for the authenticated user.
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });
    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read.
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
    );
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read for the authenticated user.
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
