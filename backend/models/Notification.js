const mongoose = require("mongoose");

/**
 * Notification — In-app and email notification records.
 *
 * Stores notifications for application status changes,
 * recruiter actions, interview scheduling, and new job matches.
 */

const NOTIFICATION_TYPES = [
  "APPLICATION_SUBMITTED",
  "APPLICATION_APPROVED",
  "APPLICATION_REJECTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_REMINDER",
  "INTERVIEW_COMPLETED",
  "NEW_JOB_MATCH",
  "OPENING_CLOSED",
  "GENERAL",
];

const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL"];

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: "GENERAL",
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      default: "",
    },
    metadata: {
      openingId: { type: mongoose.Schema.Types.ObjectId, default: null },
      applicationId: { type: mongoose.Schema.Types.ObjectId, default: null },
      interviewReportId: { type: String, default: null },
      actionUrl: { type: String, default: null },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    channel: {
      type: String,
      enum: NOTIFICATION_CHANNELS,
      default: "IN_APP",
    },
    // For email notifications: track if email was actually sent
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "notifications",
  },
);

// Indexes for efficient notification queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });

// Statics
notificationSchema.statics.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
notificationSchema.statics.NOTIFICATION_CHANNELS = NOTIFICATION_CHANNELS;

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
