const mongoose = require("mongoose");

/**
 * FitnessScore — Permanent store for resume-to-JD fitness evaluations.
 *
 * Each document stores the result of an AI-powered fitness score calculation
 * including the rating, justification, breakdown, and a vector embedding
 * for semantic similarity lookups (to avoid redundant LLM calls for
 * similar resume+JD pairs).
 *
 * Indexing strategy:
 *   - Compound (candidateId, openingId) for direct lookups
 *   - contentHash for exact-match dedup
 *   - MongoDB Atlas Search index on embedding field for vector similarity
 */

const RATING_LEVELS = ["LOW", "MEDIUM", "HIGH"];

const FITNESS_LABELS = [
  "STRONG_MATCH",
  "GOOD_MATCH",
  "FAIR_MATCH",
  "LOW_MATCH",
];

const breakdownSchema = new mongoose.Schema(
  {
    skillsMatch: { type: Number, default: 0, min: 0, max: 100 },
    experienceRelevance: { type: Number, default: 0, min: 0, max: 100 },
    educationFit: { type: Number, default: 0, min: 0, max: 100 },
    roleAlignment: { type: Number, default: 0, min: 0, max: 100 },
    keywordDensity: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false },
);

const fitnessScoreSchema = new mongoose.Schema(
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
    resumeId: {
      type: String,
      default: null,
    },

    // ── AI Evaluation Result ────────────────────────────────────
    candidateFitRating: {
      type: String,
      enum: RATING_LEVELS,
      required: true,
    },
    fitnessLabel: {
      type: String,
      enum: FITNESS_LABELS,
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    justification: {
      type: String,
      default: "",
    },
    breakdown: {
      type: breakdownSchema,
      default: () => ({}),
    },

    // ── Semantic Similarity Cache ───────────────────────────────
    /**
     * SHA-256 hash of (normalised resumeText + normalised jobDescription).
     * Used for exact-match dedup before falling back to vector search.
     */
    contentHash: {
      type: String,
      required: true,
    },
    /**
     * Vector embedding of the (resumeSummary + jobDescription) text.
     * Generated via Gemini text-embedding model.
     * Used for semantic (near-match) lookups.
     */
    embedding: {
      type: [Number],
      default: [],
    },

    // ── Resume & JD context stored for audit ────────────────────
    resumeSummary: {
      type: String,
      default: "",
      select: false, // Don't return by default (large field)
    },
    jobDescriptionUsed: {
      type: String,
      default: "",
      select: false,
    },

    // ── Metadata ────────────────────────────────────────────────
    modelUsed: {
      type: String,
      default: "gemini-2.5-flash",
    },
    tokenUsage: {
      summaryTokens: { type: Number, default: 0 },
      scoreTokens: { type: Number, default: 0 },
      embeddingTokens: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    collection: "fitness_scores",
  },
);

// ── Indexes ──────────────────────────────────────────────────────
// Direct lookup: "has this user already scored against this opening?"
fitnessScoreSchema.index({ candidateId: 1, openingId: 1 });
// Exact content dedup
fitnessScoreSchema.index({ contentHash: 1 });
// Resume ID lookup
fitnessScoreSchema.index({ candidateId: 1, resumeId: 1 });

// ── Statics ──────────────────────────────────────────────────────
fitnessScoreSchema.statics.RATING_LEVELS = RATING_LEVELS;
fitnessScoreSchema.statics.FITNESS_LABELS = FITNESS_LABELS;

const FitnessScore = mongoose.model("FitnessScore", fitnessScoreSchema);

module.exports = FitnessScore;
