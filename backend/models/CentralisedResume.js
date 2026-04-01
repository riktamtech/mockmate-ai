const mongoose = require("mongoose");

/**
 * CentralisedResume — High-level, ever-improving candidate profile.
 *
 * Seeded from the candidate's uploaded resume on first registration.
 * Continuously enriched after every proctored interview — adding new
 * skill ratings, updating existing scores, appending evaluations,
 * and enriching metadata.
 *
 * This is the single source of truth for a candidate's verified profile
 * that both MockMate-AI and Zinterview consume.
 */

// ── Sub-schemas ────────────────────────────────────────────────────────

const educationEntrySchema = new mongoose.Schema(
  {
    institution: { type: String, default: "" },
    degree: { type: String, default: "" },
    field: { type: String, default: "" },
    graduationYear: { type: Number, default: null },
  },
  { _id: false },
);

const workHistoryEntrySchema = new mongoose.Schema(
  {
    company: { type: String, default: "" },
    role: { type: String, default: "" },
    durationMonths: { type: Number, default: 0 },
    highlights: [{ type: String }],
  },
  { _id: false },
);

const resumeSourceDataSchema = new mongoose.Schema(
  {
    parsedFromResumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CandidateResume",
      default: null,
    },
    initialParsedAt: { type: Date, default: null },
    rawSkillsExtracted: [{ type: String }],
    educationHistory: [educationEntrySchema],
    workHistory: [workHistoryEntrySchema],
    certifications: [{ type: String }],
    projectHighlights: [{ type: String }],
  },
  { _id: false },
);

const SKILL_TRENDS = ["IMPROVING", "STABLE", "DECLINING"];
const DEPTH_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"];

const skillEntrySchema = new mongoose.Schema(
  {
    skillName: { type: String, required: true },
    bestScore: { type: Number, default: 0, min: 0, max: 100 },
    currentScore: { type: Number, default: 0, min: 0, max: 100 },
    trend: { type: String, enum: SKILL_TRENDS, default: "STABLE" },
    totalAttempts: { type: Number, default: 0 },
    sourceInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProctoredInterview",
      default: null,
    },
    lastAssessedAt: { type: Date, default: null },
    questionCount: { type: Number, default: 0 },
    confidence: { type: String, enum: CONFIDENCE_LEVELS, default: "LOW" },
    depthLevel: { type: String, enum: DEPTH_LEVELS, default: "BEGINNER" },
    subTopicsCovered: [{ type: String }],
  },
  { _id: false },
);

const strengthEntrySchema = new mongoose.Schema(
  {
    area: { type: String, required: true },
    description: { type: String, default: "" },
    evidenceFromInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProctoredInterview",
      default: null,
    },
  },
  { _id: false },
);

const weaknessEntrySchema = new mongoose.Schema(
  {
    area: { type: String, required: true },
    description: { type: String, default: "" },
    suggestedImprovement: { type: String, default: "" },
    evidenceFromInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProctoredInterview",
      default: null,
    },
  },
  { _id: false },
);

const interviewRecordingRefSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProctoredInterview",
      required: true,
    },
    recordingUrl: { type: String, default: "" },
    transcriptUrl: { type: String, default: "" },
    evaluationSummary: { type: String, default: "" },
    skillsCovered: [{ type: String }],
    date: { type: Date, default: null },
    duration: { type: Number, default: 0 }, // minutes
  },
  { _id: false },
);

const INTEGRITY_VERDICTS = ["TRUSTED", "FLAGGED", "UNVERIFIED"];

// ── Main Schema ────────────────────────────────────────────────────────

const centralisedResumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // ── Initial Skeleton (seeded from uploaded resume) ──────────────
    resumeSourceData: {
      type: resumeSourceDataSchema,
      default: () => ({}),
    },

    // ── AI-Verified Skill Ratings ───────────────────────────────────
    skills: [skillEntrySchema],

    // ── Qualitative Assessments ─────────────────────────────────────
    technicalStrengths: [strengthEntrySchema],
    technicalWeaknesses: [weaknessEntrySchema],

    // ── Performance Metrics (recruiter-facing) ──────────────────────
    overallCompositeScore: { type: Number, default: 0, min: 0, max: 100 },
    problemSolvingScore: { type: Number, default: 0, min: 0, max: 100 },
    communicationScore: { type: Number, default: 0, min: 0, max: 100 },
    codeQualityScore: { type: Number, default: 0, min: 0, max: 100 },
    consistencyScore: { type: Number, default: 0, min: 0, max: 100 },
    depthVsBreadth: {
      breadthCoverage: { type: Number, default: 0 }, // % skills assessed
      avgDepthLevel: { type: Number, default: 0 },
    },
    experienceSummary: { type: String, default: "" },
    totalYearsExperience: { type: Number, default: 0 },

    // ── Trust & Integrity ───────────────────────────────────────────
    avgTrustScore: { type: Number, default: 0, min: 0, max: 100 },
    avgCheatingLikelihood: { type: Number, default: 0, min: 0, max: 100 },
    integrityVerdict: {
      type: String,
      enum: INTEGRITY_VERDICTS,
      default: "UNVERIFIED",
    },

    // ── Interview History References ────────────────────────────────
    interviewRecordingRefs: [interviewRecordingRefSchema],

    // ── Aggregates ──────────────────────────────────────────────────
    totalInterviews: { type: Number, default: 0 },
    totalQuestionsAnswered: { type: Number, default: 0 },
    lastUpdatedFromInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProctoredInterview",
      default: null,
    },
    profileCompleteness: { type: Number, default: 0, min: 0, max: 100 },
    lastActivityAt: { type: Date, default: null },

    // ── Cached Fitness Evaluations ──────────────────────────────────
    // Cache the initial resume parse result to avoid re-computation
    cachedResumeParse: {
      parsedAt: { type: Date, default: null },
      resumeIdUsed: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CandidateResume",
        default: null,
      },
      parseResult: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    // ── Extensible ──────────────────────────────────────────────────
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "centralised_resumes",
  },
);

// ── Indexes ────────────────────────────────────────────────────────────

// Recruiter pool filtering
centralisedResumeSchema.index({
  "skills.skillName": 1,
  "skills.bestScore": -1,
});
centralisedResumeSchema.index({ overallCompositeScore: -1 });
centralisedResumeSchema.index({ lastActivityAt: -1 });
centralisedResumeSchema.index({ profileCompleteness: -1 });

// ── Statics ────────────────────────────────────────────────────────────

centralisedResumeSchema.statics.SKILL_TRENDS = SKILL_TRENDS;
centralisedResumeSchema.statics.DEPTH_LEVELS = DEPTH_LEVELS;
centralisedResumeSchema.statics.CONFIDENCE_LEVELS = CONFIDENCE_LEVELS;
centralisedResumeSchema.statics.INTEGRITY_VERDICTS = INTEGRITY_VERDICTS;

const CentralisedResume = mongoose.model(
  "CentralisedResume",
  centralisedResumeSchema,
);

module.exports = CentralisedResume;
