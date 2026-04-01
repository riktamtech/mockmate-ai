/**
 * QuestionDedupService — Hybrid question deduplication for multi-interview candidates.
 *
 * Strategy:
 *  1. On question generation, build an exclusion context from CandidateQuestionHistory:
 *     - Up to MAX_HASHES_FOR_LLM (25) recent question hashes → passed directly to LLM
 *     - Remaining history compacted into topic summaries → "Previously covered: [topics]"
 *  2. After LLM generates questions, validate novelty via in-memory Bloom filter
 *  3. If any question is a duplicate, regenerate with stricter exclusion
 *  4. Save new hashes + topics back to CandidateQuestionHistory
 *
 * Bloom Filter: Uses a simple in-memory probabilistic structure built from
 * all question hashes for a user+skill combo. False positive rate ~1% at 10x capacity.
 */

const crypto = require("crypto");
const CandidateQuestionHistory = require("../models/CandidateQuestionHistory");
const { normaliseSkill } = require("../constants/skillNormalisationMap");

// ── Bloom Filter Implementation ──────────────────────────────────

class BloomFilter {
  /**
   * @param {number} size       - Bit array size
   * @param {number} hashCount  - Number of hash functions
   */
  constructor(size = 1024, hashCount = 7) {
    this.size = size;
    this.hashCount = hashCount;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  _getHashes(value) {
    const hashes = [];
    for (let i = 0; i < this.hashCount; i++) {
      const hash = crypto
        .createHash("md5")
        .update(`${i}:${value}`)
        .digest();
      const index = hash.readUInt32BE(0) % this.size;
      hashes.push(index);
    }
    return hashes;
  }

  add(value) {
    for (const index of this._getHashes(value)) {
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      this.bits[byteIndex] |= 1 << bitIndex;
    }
  }

  mightContain(value) {
    for (const index of this._getHashes(value)) {
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      if (!(this.bits[byteIndex] & (1 << bitIndex))) {
        return false; // Definitely not in the set
      }
    }
    return true; // Possibly in the set (may be false positive)
  }

  /**
   * Build a Bloom filter from an array of hashes.
   * @param {string[]} hashes
   * @returns {BloomFilter}
   */
  static fromHashes(hashes) {
    // Size the filter at 10x the number of items for ~1% false positive rate
    const size = Math.max(1024, hashes.length * 10);
    const filter = new BloomFilter(size, 7);
    for (const hash of hashes) {
      filter.add(hash);
    }
    return filter;
  }
}

// ── Hash Computation ─────────────────────────────────────────────

/**
 * Compute a normalised SHA-256 hash of a question text.
 * Strips whitespace, lowercases, removes punctuation for dedup.
 * @param {string} questionText
 * @returns {string} Hex hash
 */
function hashQuestion(questionText) {
  const normalised = questionText
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return crypto.createHash("sha256").update(normalised).digest("hex");
}

// ── Core Functions ───────────────────────────────────────────────

/**
 * Get the exclusion context for a user+skill pair.
 * Returns data to inject into the LLM prompt for question generation.
 *
 * @param {ObjectId} userId
 * @param {string}   skillName - Raw skill name (will be normalised)
 * @returns {Object}           - { recentHashes, topics, totalAsked, bloomFilter }
 */
async function getExclusionContext(userId, skillName) {
  const canonical = await normaliseSkill(skillName);

  const history = await CandidateQuestionHistory.findOne({
    userId,
    skillName: canonical,
  });

  if (!history || history.totalAsked === 0) {
    return {
      recentHashes: [],
      topics: [],
      totalAsked: 0,
      bloomFilter: null,
      promptExclusion: "", // Nothing to exclude
    };
  }

  const exclusionCtx = history.getExclusionContext();

  // Build Bloom filter from ALL hashes (not just recent)
  const bloomFilter = BloomFilter.fromHashes(history.questionHashes);

  // Build the prompt exclusion string
  const promptParts = [];

  if (exclusionCtx.topics.length > 0) {
    promptParts.push(
      `Previously covered topics for ${canonical}: ${exclusionCtx.topics.join(", ")}. Generate questions on DIFFERENT aspects.`,
    );
  }

  if (exclusionCtx.recentHashes.length > 0) {
    promptParts.push(
      `The candidate has answered ${exclusionCtx.totalAsked} questions on ${canonical} across previous interviews. Ensure all new questions are substantially different.`,
    );
  }

  return {
    recentHashes: exclusionCtx.recentHashes,
    topics: exclusionCtx.topics,
    totalAsked: exclusionCtx.totalAsked,
    bloomFilter,
    promptExclusion: promptParts.join(" "),
  };
}

/**
 * Build a combined exclusion context for multiple skills.
 * Used when generating an interview covering multiple skill areas.
 *
 * @param {ObjectId} userId
 * @param {string[]} skillNames - Array of raw skill names
 * @returns {Object}            - { perSkill: Map<skillName, context>, combinedPrompt: string }
 */
async function getMultiSkillExclusionContext(userId, skillNames) {
  const perSkill = new Map();
  const promptParts = [];

  for (const skill of skillNames) {
    const ctx = await getExclusionContext(userId, skill);
    perSkill.set(await normaliseSkill(skill), ctx);
    if (ctx.promptExclusion) {
      promptParts.push(ctx.promptExclusion);
    }
  }

  return {
    perSkill,
    combinedPrompt: promptParts.join("\n"),
  };
}

/**
 * Validate generated questions for novelty using the Bloom filter.
 * Returns arrays of novel and duplicate questions.
 *
 * @param {Object[]}    questions    - Array of { text, skill } objects
 * @param {BloomFilter} bloomFilter  - Bloom filter for the skill
 * @returns {Object}                 - { novel: [], duplicates: [] }
 */
function validateNovelty(questions, bloomFilter) {
  if (!bloomFilter) {
    return { novel: questions, duplicates: [] };
  }

  const novel = [];
  const duplicates = [];

  for (const q of questions) {
    const hash = hashQuestion(q.text);
    if (bloomFilter.mightContain(hash)) {
      duplicates.push({ ...q, hash });
    } else {
      novel.push({ ...q, hash });
    }
  }

  return { novel, duplicates };
}

/**
 * Record questions asked in an interview.
 * Saves hashes and topic summaries to CandidateQuestionHistory.
 *
 * @param {ObjectId} userId
 * @param {ObjectId} interviewId
 * @param {Object[]} questionsPerSkill - Array of { skillName, questions: [{ text, topics: [] }] }
 */
async function recordQuestions(userId, interviewId, questionsPerSkill) {
  for (const { skillName, questions } of questionsPerSkill) {
    const canonical = await normaliseSkill(skillName);

    // Compute hashes
    const newHashes = questions.map((q) => hashQuestion(q.text));

    // Extract topics
    const newTopics = [];
    for (const q of questions) {
      if (q.topics && Array.isArray(q.topics)) {
        newTopics.push(...q.topics);
      }
    }

    // Upsert: find or create, then add questions
    let history = await CandidateQuestionHistory.findOne({
      userId,
      skillName: canonical,
    });

    if (!history) {
      history = new CandidateQuestionHistory({
        userId,
        skillName: canonical,
        questionHashes: [],
        topicSummaries: [],
        totalAsked: 0,
        interviewRefs: [],
      });
    }

    history.addQuestions(newHashes, newTopics, interviewId);
    await history.save();
  }
}

/**
 * Get question exhaustion fallback strategies when novelty is low.
 * Returns suggested alternative question types based on exhaustion level.
 *
 * @param {number} totalAsked     - Total questions asked for this skill
 * @param {string} skillName      - Skill name
 * @returns {Object}              - { exhaustionLevel, strategies: string[] }
 */
function getExhaustionFallback(totalAsked, skillName) {
  if (totalAsked < 10) {
    return {
      exhaustionLevel: "LOW",
      strategies: ["standard"],
    };
  }

  if (totalAsked < 25) {
    return {
      exhaustionLevel: "MODERATE",
      strategies: [
        "scenario-based",
        `Generate scenario-based questions for ${skillName} that present real-world problems the candidate must solve.`,
      ],
    };
  }

  if (totalAsked < 50) {
    return {
      exhaustionLevel: "HIGH",
      strategies: [
        "twisted-advanced",
        `Generate advanced/twisted variants of ${skillName} concepts — edge cases, performance traps, integration challenges.`,
        "cross-domain",
        `Generate questions that combine ${skillName} with related technologies or system design.`,
      ],
    };
  }

  return {
    exhaustionLevel: "EXHAUSTED",
    strategies: [
      "hands-on-challenge",
      `Present a hands-on coding/design challenge for ${skillName} — a mini-project rather than discrete Q&A.`,
      "cross-domain-synthesis",
      `Generate cross-domain synthesis questions combining ${skillName} with adjacent fields.`,
      "meta-questions",
      `Ask about teaching ${skillName}, evaluating others' ${skillName} code, or comparing ${skillName} approaches.`,
    ],
  };
}

// ── Exports ──────────────────────────────────────────────────────

module.exports = {
  BloomFilter,
  hashQuestion,
  getExclusionContext,
  getMultiSkillExclusionContext,
  validateNovelty,
  recordQuestions,
  getExhaustionFallback,
};
