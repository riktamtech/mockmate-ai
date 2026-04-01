const mongoose = require("mongoose");

/**
 * Event — Upcoming and past events for candidates.
 *
 * Created via webhook events from Zinterview-backend when
 * interviews are scheduled, rescheduled, or completed.
 * Consumed by the MockMate-AI Events page and dashboard widgets.
 */

const EVENT_TYPES = ["INTERVIEW", "APPLICATION_REVIEW", "DEADLINE"];
const EVENT_STATUSES = ["UPCOMING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const eventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
    },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: "UPCOMING",
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      openingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "JobOpening",
        default: null,
      },
      applicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "JobApplication",
        default: null,
      },
      interviewReportId: { type: String, default: null },
      interviewUrl: { type: String, default: null },
      orgName: { type: String, default: null },
      zinterviewOpeningId: { type: String, default: null },
    },
    // Idempotency key to prevent duplicate events from webhook retries
    idempotencyKey: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
    },
  },
  {
    timestamps: true,
    collection: "events",
  },
);

// ── Indexes ────────────────────────────────────────────────────────────

// Primary query pattern: upcoming/past events for a user
eventSchema.index({ userId: 1, status: 1, scheduledAt: -1 });
// For auto-transition of UPCOMING → IN_PROGRESS/COMPLETED
eventSchema.index({ status: 1, scheduledAt: 1 });

// ── Statics ────────────────────────────────────────────────────────────

eventSchema.statics.EVENT_TYPES = EVENT_TYPES;
eventSchema.statics.EVENT_STATUSES = EVENT_STATUSES;

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;
