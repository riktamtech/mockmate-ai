const mongoose = require("mongoose");

/**
 * JobApplication — Tracks candidate applications to job openings.
 *
 * Stores the full lifecycle of an application from submission
 * through approval, interview scheduling, and completion.
 */

const APPLICATION_STATUSES = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_IN_PROGRESS",
  "INTERVIEW_COMPLETED",
  "WITHDRAWN",
  "OPENING_CLOSED",
];

const FITNESS_LABELS = [
  "STRONG_MATCH",
  "GOOD_MATCH",
  "FAIR_MATCH",
  "LOW_MATCH",
];

const lifecycleEntrySchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false },
);

const fitnessBreakdownSchema = new mongoose.Schema(
  {
    skillsMatch: { type: Number, default: 0 },
    experienceRelevance: { type: Number, default: 0 },
    educationFit: { type: Number, default: 0 },
    roleAlignment: { type: Number, default: 0 },
    keywordDensity: { type: Number, default: 0 },
  },
  { _id: false },
);

const jobApplicationSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    openingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobOpening",
      required: true,
    },
    zinterviewOpeningId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: "PENDING_APPROVAL",
    },
    // Fitness score data
    fitnessScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    fitnessLabel: {
      type: String,
      enum: [...FITNESS_LABELS, null],
      default: null,
    },
    fitnessBreakdown: {
      type: fitnessBreakdownSchema,
      default: null,
    },
    // Resume reference
    resumeId: {
      type: String,
      default: null,
    },
    resumeS3Key: {
      type: String,
      default: null,
    },
    // Candidate details at time of application
    candidateDetails: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      experience: { type: Number, default: 0 },
      country: { type: String, default: "" },
    },
    // Zinterview integration
    interviewReportId: {
      type: String,
      default: null,
    },
    // Scheduling
    scheduledAt: {
      type: Date,
      default: null,
    },
    schedulingMode: {
      type: String,
      enum: ["TIMEFRAME", "MANUAL", "IMMEDIATE", "ANYTIME", null],
      default: null,
    },
    // Application timestamps
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: String,
      default: null,
    },
    // Lifecycle history
    lifecycleHistory: {
      type: [lifecycleEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "job_applications",
  },
);

// Compound indexes
jobApplicationSchema.index({ candidateId: 1, openingId: 1 }, { unique: true });
jobApplicationSchema.index({ candidateId: 1, status: 1, appliedAt: -1 });
jobApplicationSchema.index({ openingId: 1, status: 1 });
jobApplicationSchema.index({ zinterviewOpeningId: 1 });

// Add lifecycle entry helper
jobApplicationSchema.methods.addLifecycleEntry = function (stage, metadata = {}) {
  this.lifecycleHistory.push({
    stage,
    timestamp: new Date(),
    metadata,
  });
};

// Statics
jobApplicationSchema.statics.APPLICATION_STATUSES = APPLICATION_STATUSES;
jobApplicationSchema.statics.FITNESS_LABELS = FITNESS_LABELS;

const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);

module.exports = JobApplication;
