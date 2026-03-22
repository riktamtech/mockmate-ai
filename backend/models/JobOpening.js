const mongoose = require("mongoose");

/**
 * JobOpening — Synced job openings from Zinterview platform.
 *
 * Each document represents an opening that a recruiter has opted
 * to publish on the Mockmate-AI candidate portal.
 * Source of truth for opening data is Zinterview; this is updated
 * via event-driven sync (no polling).
 */

const mockmateConfigSchema = new mongoose.Schema(
  {
    fitnessThreshold: {
      type: Number,
      default: 0, // 0 means allow all candidates
      min: 0,
      max: 100,
    },
    schedulingMode: {
      type: String,
      enum: ["TIMEFRAME", "MANUAL", "IMMEDIATE", "ANYTIME"],
      default: "ANYTIME",
    },
    approvalRequired: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const jobOpeningSchema = new mongoose.Schema(
  {
    // Reference back to the Zinterview opening
    zinterviewOpeningId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Organisation info
    organizationId: {
      type: String,
      required: true,
    },
    orgName: {
      type: String,
      default: "",
    },
    orgLogoUrl: {
      type: String,
      default: "",
    },
    // Opening details
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    coreSkills: {
      type: [String],
      default: [],
    },
    skillsGroup: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    jobRequirementsAndResponsibilities: {
      type: [String],
      default: [],
    },
    experience: {
      type: Number,
      default: 0,
    },
    minExperience: {
      type: Number,
      default: 0,
    },
    maxExperience: {
      type: Number,
      default: null,
    },
    location: {
      type: String,
      default: "",
    },
    interviewMode: {
      type: String,
      default: "TRADITIONAL",
    },
    maxQuestions: {
      type: Number,
      default: 15,
    },
    languageOfQuestions: {
      type: String,
      default: "en",
    },
    // Sync metadata
    isEnabled: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      default: "zinterview",
      enum: ["zinterview"],
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
    // Mockmate-specific config set by recruiter
    mockmateConfig: {
      type: mockmateConfigSchema,
      default: () => ({}),
    },
    // Opening status from Zinterview
    status: {
      type: Boolean,
      default: true,
    },
    // Candidate stats (denormalized for performance)
    totalApplications: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "job_openings",
  },
);

// Compound indexes for common queries
jobOpeningSchema.index({ isEnabled: 1, interviewMode: 1, createdAt: -1 });
jobOpeningSchema.index({ organizationId: 1 });
jobOpeningSchema.index({ isEnabled: 1, status: 1, createdAt: -1 });
// Text index for search
jobOpeningSchema.index({
  title: "text",
  orgName: "text",
  coreSkills: "text",
  description: "text",
});

const JobOpening = mongoose.model("JobOpening", jobOpeningSchema);

module.exports = JobOpening;
