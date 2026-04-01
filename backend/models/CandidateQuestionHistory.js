const mongoose = require("mongoose");

/**
 * CandidateQuestionHistory — Per-skill question deduplication tracking.
 *
 * Stores hashes of previously asked questions per skill per user.
 * Used by the Bloom filter for server-side novelty validation and
 * by topic-summary extraction for LLM prompt construction.
 *
 * Dedup Strategy (hybrid):
 *  - Up to MAX_HASHES_FOR_LLM recent hashes are passed directly to the LLM
 *  - Remaining history is compacted into topic summaries for the LLM prompt
 *  - ALL hashes are checked via Bloom filter post-generation for novelty
 */

const MAX_HASHES_FOR_LLM = 25;

const candidateQuestionHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    skillName: {
      type: String,
      required: true,
      index: true,
    },
    // SHA-256 hashes of normalised question text (all questions ever asked)
    questionHashes: [{ type: String }],
    // Topic-level summaries for compact LLM prompt construction
    // Auto-generated from question text when hashes exceed MAX_HASHES_FOR_LLM
    topicSummaries: [{ type: String }],
    // Total questions asked for this skill across all interviews
    totalAsked: { type: Number, default: 0 },
    // Reference to interviews that covered this skill
    interviewRefs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProctoredInterview",
      },
    ],
  },
  {
    timestamps: true,
    collection: "candidate_question_history",
  },
);

// Unique compound index: one document per user per skill
candidateQuestionHistorySchema.index(
  { userId: 1, skillName: 1 },
  { unique: true },
);

// ── Statics ────────────────────────────────────────────────────────────

candidateQuestionHistorySchema.statics.MAX_HASHES_FOR_LLM = MAX_HASHES_FOR_LLM;

// ── Methods ────────────────────────────────────────────────────────────

/**
 * Add new question hashes and update topic summaries.
 * @param {string[]} newHashes    – SHA-256 hashes of new question texts
 * @param {string[]} newTopics    – Topic labels extracted from the new questions
 * @param {ObjectId} interviewId  – The interview that generated these questions
 */
candidateQuestionHistorySchema.methods.addQuestions = function (
  newHashes,
  newTopics,
  interviewId,
) {
  // Append new hashes (dedup against existing)
  const existingHashSet = new Set(this.questionHashes);
  for (const hash of newHashes) {
    if (!existingHashSet.has(hash)) {
      this.questionHashes.push(hash);
      existingHashSet.add(hash);
    }
  }

  // Append new topic summaries (dedup)
  const existingTopicSet = new Set(this.topicSummaries);
  for (const topic of newTopics) {
    if (!existingTopicSet.has(topic)) {
      this.topicSummaries.push(topic);
      existingTopicSet.add(topic);
    }
  }

  // Update total count
  this.totalAsked = this.questionHashes.length;

  // Track interview ref
  if (interviewId && !this.interviewRefs.includes(interviewId)) {
    this.interviewRefs.push(interviewId);
  }
};

/**
 * Build the exclusion context for the LLM prompt.
 * Returns up to MAX_HASHES_FOR_LLM recent hashes + all topic summaries.
 * This keeps prompt size bounded regardless of interview count.
 *
 * @returns {{ recentHashes: string[], topics: string[], totalAsked: number }}
 */
candidateQuestionHistorySchema.methods.getExclusionContext = function () {
  const recentHashes = this.questionHashes.slice(-MAX_HASHES_FOR_LLM);
  return {
    recentHashes,
    topics: [...this.topicSummaries],
    totalAsked: this.totalAsked,
  };
};

const CandidateQuestionHistory = mongoose.model(
  "CandidateQuestionHistory",
  candidateQuestionHistorySchema,
);

module.exports = CandidateQuestionHistory;
