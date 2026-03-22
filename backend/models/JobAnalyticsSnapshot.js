const mongoose = require("mongoose");

/**
 * JobAnalyticsSnapshot — Weekly analytics snapshots per user.
 *
 * Stores aggregated metrics for the job analytics dashboard.
 * Snapshots are generated weekly (or on-demand) to avoid
 * expensive real-time aggregation queries.
 */

const jobAnalyticsSnapshotSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // ISO week string e.g. "2026-W12"
    week: {
      type: String,
      required: true,
    },
    applicationsCount: {
      type: Number,
      default: 0,
    },
    shortlisted: {
      type: Number,
      default: 0,
    },
    rejected: {
      type: Number,
      default: 0,
    },
    interviewsPending: {
      type: Number,
      default: 0,
    },
    interviewsCompleted: {
      type: Number,
      default: 0,
    },
    avgFitnessScore: {
      type: Number,
      default: 0,
    },
    // Percentage of applications that received any recruiter action
    recruiterResponseRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    collection: "job_analytics_snapshots",
  },
);

// Unique constraint: one snapshot per user per week
jobAnalyticsSnapshotSchema.index({ userId: 1, week: 1 }, { unique: true });
jobAnalyticsSnapshotSchema.index({ userId: 1, createdAt: -1 });

const JobAnalyticsSnapshot = mongoose.model(
  "JobAnalyticsSnapshot",
  jobAnalyticsSnapshotSchema,
);

module.exports = JobAnalyticsSnapshot;
