const mongoose = require("mongoose");

const ProctoredInterviewHistorySchema = new mongoose.Schema(
  {
    originalInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProctoredInterview",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Keep a snapshot of the major interview references
    opening: { type: mongoose.Schema.Types.ObjectId, ref: "ProctoredOpening" },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProctoredCandidate",
    },

    // Zinterview references
    zinterviewReportId: { type: String, default: "" },
    zinterviewOpeningId: { type: String, default: "" },
    zinterviewCandidateId: { type: String, default: "" },

    statusAtReset: { type: String },
    stepAtReset: { type: Number },
    stepDataSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Evaluation & Reports
    evaluation: { type: String, default: "" },
    communicationEvaluation: { type: String, default: "" },
    trustScore: { type: Number, default: 0 },

    // Content hash for deduplication (based on key snapshot fields)
    contentHash: { type: String, index: true },

    // Cancellation reason
    reasonForReset: { type: String, default: "User started over" },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate history entries for the same interview state
ProctoredInterviewHistorySchema.index(
  { originalInterviewId: 1, contentHash: 1 },
  { unique: true },
);

module.exports = mongoose.model(
  "ProctoredInterviewHistory",
  ProctoredInterviewHistorySchema,
);
