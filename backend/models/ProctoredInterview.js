const mongoose = require("mongoose");

/**
 * Status flow:
 * CONSENT_GIVEN → DETAILS_COLLECTED → OPENING_CREATED → CANDIDATE_ADDED
 * → SCHEDULED → IN_PROGRESS → COMPLETED
 *
 * CANCELLED can happen from SCHEDULED state.
 */
const PROCTORED_STATUSES = [
  "CONSENT_GIVEN",
  "DETAILS_COLLECTED",
  "OPENING_CREATED",
  "CANDIDATE_ADDED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const PROCTORED_STEPS = {
  CONSENT: 1,
  DETAILS: 2,
  OPENING: 3,
  CANDIDATE: 4,
  SCHEDULE: 5,
  JOIN: 6,
};

const CheatingScoreSchema = new mongoose.Schema(
  {
    likelihood_of_cheating: { type: Number, default: 0 },
    summary: { type: String, default: "" },
    verdict: { type: String, default: "" },
  },
  { _id: false },
);

const ProctoredInterviewSchema = new mongoose.Schema(
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
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProctoredCandidate",
    },

    // Zinterview references
    zinterviewReportId: { type: String, default: "" },
    zinterviewOpeningId: { type: String, default: "" },
    zinterviewCandidateId: { type: String, default: "" },
    resumeToken: { type: String, default: "" },
    shortCode: { type: String, default: "" },
    interviewUrl: { type: String, default: "" },
    adminProctorJoinUrl: { type: String, default: "" },

    // Scheduling
    schedule: { type: Date },
    interviewTimeZone: { type: String, default: "Asia/Calcutta" },
    joinEarly: { type: Boolean, default: true },
    joinOption: { type: String, default: "anytime" },
    timeWindow: { type: Number, default: 24 },
    isStartNow: { type: Boolean, default: false },

    // Status tracking
    status: {
      type: String,
      enum: PROCTORED_STATUSES,
      default: "CONSENT_GIVEN",
      index: true,
    },
    currentStep: {
      type: Number,
      min: 1,
      max: 6,
      default: 1,
    },

    // Partial form data (for resume on revisit)
    stepData: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Consent
    consentGivenAt: { type: Date },
    consentSignature: { type: String, default: "" },
    consentAcknowledged: { type: Boolean, default: false },

    // Reset tracking
    resetCount: { type: Number, default: 0 },

    // Evaluation & Reports
    evaluation: { type: String, default: "" },
    performanceScore: { type: Number, default: 0 },
    communicationEvaluation: { type: String, default: "" },
    cheatingScore: { type: CheatingScoreSchema },
    trustScore: { type: Number, default: 0 },
    interviewCompleted: { type: Boolean, default: false },
    reportFetched: { type: Boolean, default: false },
    messages: { type: [mongoose.Schema.Types.Mixed], default: undefined },

    // Interview timing
    interviewStartTime: { type: Date },
    interviewEndTime: { type: Date },

    // Cancellation
    cancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    reasonForCancellation: { type: String, default: "" },

    // Reschedule tracking
    rescheduleCount: { type: Number, default: 0 },
    maxReschedules: { type: Number, default: 3 },
    allowRescheduleByCandidate: { type: Boolean, default: true },
    maxRescheduleDateForCandidate: { type: Date },

    // Raw API payloads (for extensibility)
    rawSchedulePayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    rawReportPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    rawCandidatePayload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  },
);

// One active (non-cancelled/completed) interview per user
ProctoredInterviewSchema.index({ user: 1, status: 1 });
ProctoredInterviewSchema.index({ user: 1, createdAt: -1 });
ProctoredInterviewSchema.index({ zinterviewReportId: 1 });
// Admin dashboard filtering indexes
ProctoredInterviewSchema.index({ status: 1, createdAt: -1 });
ProctoredInterviewSchema.index({ schedule: -1 });
ProctoredInterviewSchema.index({ opening: 1 });

module.exports = mongoose.model("ProctoredInterview", ProctoredInterviewSchema);
module.exports.PROCTORED_STATUSES = PROCTORED_STATUSES;
module.exports.PROCTORED_STEPS = PROCTORED_STEPS;
