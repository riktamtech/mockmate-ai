const Notification = require("../models/Notification");

/**
 * Notification Trigger Service
 *
 * Creates in-app notifications on application lifecycle events.
 * Each function creates the notification and optionally
 * queues an email notification.
 */

async function createNotification(userId, type, title, body, metadata = {}) {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      body,
      metadata,
      channel: "IN_APP",
    });
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

const notificationTriggers = {
  applicationSubmitted: async (userId, openingTitle, applicationId) => {
    return createNotification(
      userId,
      "APPLICATION_SUBMITTED",
      "Application Submitted",
      `Your application for "${openingTitle}" has been submitted successfully.`,
      { applicationId },
    );
  },

  applicationApproved: async (userId, openingTitle, applicationId) => {
    return createNotification(
      userId,
      "APPLICATION_APPROVED",
      "Application Approved! 🎉",
      `Great news! Your application for "${openingTitle}" has been approved. You can now proceed with the interview.`,
      { applicationId },
    );
  },

  applicationRejected: async (userId, openingTitle, applicationId, reason) => {
    return createNotification(
      userId,
      "APPLICATION_REJECTED",
      "Application Update",
      `Your application for "${openingTitle}" was not selected${reason ? `: ${reason}` : "."}`,
      { applicationId },
    );
  },

  interviewScheduled: async (userId, openingTitle, applicationId, scheduledAt) => {
    return createNotification(
      userId,
      "INTERVIEW_SCHEDULED",
      "Interview Scheduled",
      `Your interview for "${openingTitle}" is scheduled for ${new Date(scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.`,
      { applicationId },
    );
  },

  interviewReminder: async (userId, openingTitle, applicationId) => {
    return createNotification(
      userId,
      "INTERVIEW_REMINDER",
      "Interview Reminder ⏰",
      `Your interview for "${openingTitle}" is starting soon.`,
      { applicationId },
    );
  },

  interviewCompleted: async (userId, openingTitle, applicationId) => {
    return createNotification(
      userId,
      "INTERVIEW_COMPLETED",
      "Interview Completed",
      `Your interview for "${openingTitle}" has been completed. Results will be available soon.`,
      { applicationId },
    );
  },

  newJobMatch: async (userId, openingTitle, openingId) => {
    return createNotification(
      userId,
      "NEW_JOB_MATCH",
      "New Job Match! 🔥",
      `A new opening "${openingTitle}" matches your profile.`,
      { openingId },
    );
  },
};

module.exports = notificationTriggers;
