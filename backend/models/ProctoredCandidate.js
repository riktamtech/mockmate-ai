const mongoose = require("mongoose");

const ProctoredCandidateSchema = new mongoose.Schema(
  {
    // Internal references
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    opening: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProctoredOpening",
      required: true,
      index: true,
    },

    // Zinterview references
    zinterviewCandidateId: {
      type: String,
      required: true,
      index: true,
    },
    zinterviewOpeningId: {
      type: String,
      required: true,
    },

    // Candidate details (as sent to Zinterview)
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    preferredName: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    experience: { type: Number, default: 0 },

    // Resume info
    resumeUrl: { type: String, default: "" },
    resumeS3Key: { type: String, default: "" },
    resumeFileName: { type: String, default: "" },

    // Full Zinterview response
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  },
);

// One candidate per user per opening
ProctoredCandidateSchema.index(
  { user: 1, zinterviewOpeningId: 1 },
  { unique: true },
);

module.exports = mongoose.model("ProctoredCandidate", ProctoredCandidateSchema);
