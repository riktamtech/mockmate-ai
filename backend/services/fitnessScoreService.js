/**
 * FitnessScoreService — RAG-powered resume-to-JD fitness evaluation.
 *
 * Architecture (mirrors Zinterview-backend createCandidateFitScore):
 *   1. Build structured JD from opening document
 *   2. Summarise resume text via Gemini 2.5 Flash (RAG: retrieval + augmentation)
 *   3. Evaluate candidate fit via tool-calling (structured output)
 *   4. Generate vector embedding for semantic caching
 *   5. Store result permanently in FitnessScore collection
 *
 * Caching layers:
 *   a) Exact-match:  SHA-256 hash of (normalisedResume + normalisedJD)
 *   b) Semantic:     Cosine similarity on Gemini text-embedding vectors
 *   c) Direct:       (candidateId + openingId) compound lookup
 *
 * SOLID: Single-responsibility functions, injected dependencies, no truncation.
 */

const crypto = require("crypto");
const { GoogleGenAI } = require("@google/genai");
const FitnessScore = require("../models/FitnessScore");
const JobOpening = require("../models/JobOpening");
const CandidateResume = require("../models/CandidateResume");
const { compressText, decompressText } = require("./compressionUtils");

// ── Gemini Client ────────────────────────────────────────────────

const mongoose = require("mongoose");
const getGenAI = () => new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "" });

// ── Constants ────────────────────────────────────────────────────

const SCORING_MODEL = "gemini-2.0-flash";
const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;
const SEMANTIC_SIMILARITY_THRESHOLD = 0.92; // cosine similarity cutoff

/** Weights for the composite score (sum = 100) */
const SCORE_WEIGHTS = {
  skillsMatch: 35,
  experienceRelevance: 20,
  educationFit: 10,
  roleAlignment: 20,
  keywordDensity: 15,
};

// ── Rating → Label mapping ───────────────────────────────────────

const RATING_TO_LABEL = {
  HIGH: "STRONG_MATCH",
  MEDIUM: "GOOD_MATCH",
  LOW: "LOW_MATCH",
};

const LABEL_TO_SCORE_RANGES = {
  STRONG_MATCH: { min: 75, max: 95 },
  GOOD_MATCH: { min: 55, max: 74 },
  FAIR_MATCH: { min: 35, max: 54 },
  LOW_MATCH: { min: 10, max: 34 },
};

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Build a structured JD string from a JobOpening document.
 * Mirrors Zinterview-backend's getJobDescriptionForOpening.
 */
function buildJobDescription(opening) {
  const criteriaMap = {
    1: "All skills are required from this group",
    2: "At least one skill is mandatory from this group",
    3: "No skill is mandatory from this group, but they're good to have.",
  };

  let skillsSection = "";
  const skillsGroup = opening.skillsGroup || [];
  const coreSkills = opening.coreSkills || [];

  if (skillsGroup.length > 0) {
    skillsSection = skillsGroup
      .map((group) => {
        const skills = Array.isArray(group.skills)
          ? group.skills.map((s) => (typeof s === "string" ? s : s.skillName || s)).join(", ")
          : "";
        return `
Main Skill Group: ${group.skillGroupName || "General"}
Criteria: ${criteriaMap[group.criteria] || criteriaMap[2]}
Skills from this group: ${skills}`;
      })
      .join("\n");
  } else if (coreSkills.length > 0) {
    skillsSection = coreSkills.join("\n");
  }

  const requirements = (opening.jobRequirementsAndResponsibilities || []).join("\n");

  return `
JOB DESCRIPTION:
"""
ROLE: ${opening.title};
EXPERIENCE RANGE: ${opening.minExperience || 0} - ${opening.maxExperience || "10+"} years;

SKILLS REQUIREMENTS: ${skillsSection};

JOB REQUIREMENTS AND RESPONSIBILITIES: ${requirements}

${coreSkills.length > 0 ? `CORE SKILLS: ${coreSkills.join("\n")}` : ""}
${opening.description ? `DESCRIPTION: ${opening.description}` : ""}
"""
`;
}

/**
 * Compute SHA-256 hash of normalised (resume + JD) text.
 */
function computeContentHash(resumeText, jobDescription) {
  const normalised = (resumeText + "|||" + jobDescription)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return crypto.createHash("sha256").update(normalised).digest("hex");
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ── RAG Step 1: Resume Summary ───────────────────────────────────

/**
 * Generate a detailed structured summary of the resume.
 * Mirrors Zinterview-backend's getDetailedSummaryFromResume.
 */
async function generateResumeSummary(resumeText) {
  if (!resumeText || resumeText.trim().length < 50) {
    return { summary: resumeText || "", tokenUsage: 0 };
  }

  const genAI = getGenAI();
  const systemPrompt = `
**Task:** Summarize the resume text below into the following structured sections:  
- **Summary**  
- **Skills**  
- **Experience**  
- **Education**  
- **Projects**  
- **Total Professional Experience** (in years and months)

---

**Instructions:**

1. **Be concise** while retaining all important information from each section.
2. For **Experience**, extract **only real job experience**. Open-source work, freelance, internships, or academic projects should only be included if **clearly labeled as professional work**.
3. **Calculate Total Professional Experience** carefully:
   - Use date ranges from each job to compute time worked.
   - **Exclude career gaps** and non-working periods.
   - Do **not** count education or open-source contributions unless explicitly framed as employment.
   - If the resume explicitly mentions "X years of experience", use that **only if it aligns** with the listed dates.
   - Cross-check the **graduation year** to validate legitimacy of work experience timelines.
   - Use the **current date at the time of processing** to calculate durations (Today's date is ${new Date().toISOString()}).
4. Output the **Total Professional Experience** in **years and months**. Give your reasoning.

---

**Resume Text:**
###
${resumeText}
###
`;

  const response = await genAI.models.generateContent({
    model: SCORING_MODEL,
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
    ],
    config: {
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  });

  const summary = response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const tokenUsage = response?.usageMetadata?.totalTokenCount || 0;

  return { summary, tokenUsage };
}

// ── RAG Step 2: AI Fitness Evaluation ────────────────────────────

/**
 * Evaluate candidate fit using Gemini 2.5 Flash with structured output.
 * Mirrors Zinterview-backend's createCandidateFitScore tool-calling.
 */
async function evaluateCandidateFit(resumeSummary, jobDescription) {
  const genAI = getGenAI();
  const delimiter1 = "####";
  const delimiter2 = "```";

  const systemPrompt = `
You will be provided with the details of a job opening delimited by ${delimiter1} and the candidate's resume summary delimited by ${delimiter2} by the user.

Your task is to extract relevant details from the candidate's resume and the job description and find how well is the candidate a fit for the given job role.

Instructions to follow while assigning the candidate_fit_rating:
Extract key skills, experience, and qualifications from the Candidate's Resume Summary.
Identify the core requirements, preferred skills, and qualifications from the Job Description.
Compare both and evaluate the level of alignment based on key factors such as:
Required and preferred skills match
Relevant work experience 
	- The candidate's experience should be in the range of the experience range provided in the opening details.
Industry or domain alignment
Educational background (if relevant)
Additional keywords or certifications that enhance fit.

Also evaluate and provide scores (0-100) for each of the following breakdown parameters:
1. skillsMatch (weight: 35%) - How well the candidate's technical and soft skills match the required skills
2. experienceRelevance (weight: 20%) - How relevant the candidate's experience duration and domain are
3. educationFit (weight: 10%) - How well education qualifications match requirements
4. roleAlignment (weight: 20%) - Overall alignment between candidate profile and role expectations
5. keywordDensity (weight: 15%) - Match of industry-specific keywords, certifications, and tools

The Job Description:
${delimiter1}
${jobDescription}
${delimiter1}
`;

  const userMessage = `
Here's the candidate resume summary provided below delimited by ${delimiter2}. Please provide the candidate fit rating.
CANDIDATE RESUME SUMMARY
${delimiter2}
${resumeSummary}
${delimiter2}

IMPORTANT: You MUST respond with a valid JSON object containing these exact fields:
{
  "candidate_fit_rating": "LOW" | "MEDIUM" | "HIGH",
  "reason_for_the_score": "A brief explanation in bulleted points each starting with a - dash",
  "breakdown": {
    "skillsMatch": <number 0-100>,
    "experienceRelevance": <number 0-100>,
    "educationFit": <number 0-100>,
    "roleAlignment": <number 0-100>,
    "keywordDensity": <number 0-100>
  }
}
`;

  const response = await genAI.models.generateContent({
    model: SCORING_MODEL,
    contents: [
      { role: "user", parts: [{ text: systemPrompt + "\n\n" + userMessage }] },
    ],
    config: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const raw = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const tokenUsage = response?.usageMetadata?.totalTokenCount || 0;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Advanced parsing for markdown with generic fallback
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (innerErr) {
        console.error("Failed to parse extracted JSON block:", innerErr.message);
        throw new Error("Failed to parse AI fitness evaluation response");
      }
    } else {
      console.error("Raw non-JSON output from AI:", raw);
      throw new Error(`Failed to parse AI fitness evaluation response. Raw output: ${raw.slice(0, 50)}...`);
    }
  }

  return { evaluation: parsed, tokenUsage };
}

// ── RAG Step 3: Vector Embedding ─────────────────────────────────

/**
 * Generate a text embedding for semantic similarity caching.
 */
async function generateEmbedding(text) {
  try {
    const genAI = getGenAI();
    const response = await genAI.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [{ parts: [{ text: text.slice(0, 10000) }] }],
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });
    const embedding = response?.embeddings?.[0]?.values || [];
    return embedding;
  } catch (error) {
    console.error("Embedding generation failed (non-fatal):", error.message);
    return [];
  }
}

// ── Cache Lookup ─────────────────────────────────────────────────

/**
 * Multi-layer cache lookup:
 *   1. Direct lookup by (candidateId + openingId)
 *   2. Exact hash match
 *   3. Semantic vector similarity (requires embeddings)
 *
 * @returns {Object|null} Cached FitnessScore document or null
 */
async function findCachedScore(candidateId, openingId, contentHash, embedding) {
  // Layer 1: Direct lookup (same user + same opening)
  const directMatch = await FitnessScore.findOne({
    candidateId,
    openingId,
  }).lean();

  if (directMatch) {
    return { ...directMatch, cacheHit: "direct" };
  }

  // Layer 2: Exact content hash match (different user, same resume+JD)
  const hashMatch = await FitnessScore.findOne({
    contentHash,
  }).lean();

  if (hashMatch) {
    return { ...hashMatch, cacheHit: "hash" };
  }

  // Layer 3: Semantic similarity via in-app cosine comparison
  // Only check if we have an embedding
  if (embedding && embedding.length > 0) {
    // Fetch recent scores for this opening to check semantic similarity
    const recentScores = await FitnessScore.find({
      openingId,
      embedding: { $exists: true, $not: { $size: 0 } },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("embedding score candidateFitRating fitnessLabel justification breakdown")
      .lean();

    for (const score of recentScores) {
      if (score.embedding && score.embedding.length === embedding.length) {
        const similarity = cosineSimilarity(embedding, score.embedding);
        if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
          return { ...score, cacheHit: "semantic", similarity };
        }
      }
    }
  }

  return null;
}

// ── Main Service Function ────────────────────────────────────────

/**
 * Calculate (or retrieve cached) fitness score for a candidate against a job opening.
 *
 * @param {string} resumeText     - Full parsed resume text (no truncation)
 * @param {Object} opening        - JobOpening mongoose document/object
 * @param {string} candidateId    - User ObjectId
 * @param {string} resumeId       - Resume identifier (optional, for tracking)
 * @returns {Object}              - { score, candidateFitRating, fitnessLabel, justification, breakdown, cached }
 */
async function calculateFitnessScore(resumeText, opening, candidateId, resumeId = null) {
  const openingId = opening._id;

  // ── Step 1: Build or retrieve cached job description ──────────
  const jdRelevantContent = [
    opening.title || "",
    JSON.stringify(opening.coreSkills || []),
    JSON.stringify(opening.skillsGroup || []),
    JSON.stringify(opening.jobRequirementsAndResponsibilities || []),
    String(opening.minExperience || 0),
    String(opening.maxExperience || ""),
    opening.description || "",
  ].join("|||");
  const computedJdHash = crypto.createHash("sha256").update(jdRelevantContent).digest("hex");

  let jobDescription;
  if (opening.jdContentHash === computedJdHash && opening.formattedJobDescription) {
    // Use cached JD
    jobDescription = opening.formattedJobDescription;
    console.log(`Using cached JD for opening=${openingId}`);
  } else {
    // Build fresh JD and save to opening
    jobDescription = buildJobDescription(opening);
    // Non-blocking update to cache the JD
    JobOpening.findByIdAndUpdate(openingId, {
      formattedJobDescription: jobDescription,
      jdContentHash: computedJdHash,
    }).catch((err) => console.error("Failed to cache JD:", err.message));
    console.log(`Built fresh JD for opening=${openingId}, hash=${computedJdHash.slice(0, 8)}`);
  }

  // ── Step 2: Content hash for exact dedup ─────────────────────
  const contentHash = computeContentHash(resumeText, jobDescription);

  // ── Step 3: Check early cache layers (Direct & Hash) ───────────
  let cached = await findCachedScore(candidateId, openingId, contentHash, null); // Pass null for embedding initially

  let embedding = [];
  if (!cached) {
    // ── Step 4: Generate embedding for semantic cache ────────────
    const combinedText = `RESUME:\n${resumeText.slice(0, 5000)}\n\nJOB:\n${jobDescription.slice(0, 3000)}`;
    embedding = await generateEmbedding(combinedText);

    // ── Step 5: Check semantic cache layer ─────────────────────
    cached = await findCachedScore(candidateId, openingId, contentHash, embedding);
  }

  if (cached) {
    console.log(`FitnessScore cache hit (${cached.cacheHit}) for candidate=${candidateId}, opening=${openingId}`);
    return {
      score: cached.score,
      candidateFitRating: cached.candidateFitRating,
      fitnessLabel: cached.fitnessLabel,
      justification: cached.justification,
      breakdown: cached.breakdown,
      cached: true,
      cacheHit: cached.cacheHit,
    };
  }

  // ── Step 5: Check for cached resume summary in CandidateResume ──
  console.log(`Generating fresh fitness score for candidate=${candidateId}, opening=${openingId}`);
  let resumeSummary = "";
  let summaryTokens = 0;

  if (resumeId && mongoose.Types.ObjectId.isValid(resumeId)) {
    try {
      const resumeDoc = await CandidateResume.findOne(
        { userId: candidateId, "resumes._id": resumeId },
        { "resumes.$": 1 },
      ).select("+resumes.resumeSummary").lean();

      const entry = resumeDoc?.resumes?.[0];
      if (entry?.resumeSummary) {
        resumeSummary = decompressText(entry.resumeSummary);
        if (resumeSummary && resumeSummary.length > 50) {
          console.log(`Using cached resume summary for resumeId=${resumeId}`);
        } else {
          resumeSummary = "";
        }
      }
    } catch (err) {
      console.error("Failed to fetch cached resume summary:", err.message);
    }
  }

  // Generate summary if not cached
  if (!resumeSummary) {
    const result = await generateResumeSummary(resumeText);
    resumeSummary = result.summary;
    summaryTokens = result.tokenUsage;

    // Cache the summary back to CandidateResume if we have a valid ObjectId resumeId
    if (resumeId && mongoose.Types.ObjectId.isValid(resumeId) && resumeSummary) {
      CandidateResume.updateOne(
        { userId: candidateId, "resumes._id": resumeId },
        { $set: { "resumes.$.resumeSummary": compressText(resumeSummary) } },
      ).catch((err) => console.error("Failed to cache resume summary:", err.message));
    }
  }

  // ── Step 6: RAG — Evaluate candidate fit ─────────────────────
  const { evaluation, tokenUsage: scoreTokens } =
    await evaluateCandidateFit(resumeSummary || resumeText, jobDescription);

  // ── Step 7: Process AI response ──────────────────────────────
  const candidateFitRating = (evaluation.candidate_fit_rating || "MEDIUM").toUpperCase();
  const justification = evaluation.reason_for_the_score || "";
  const breakdownRaw = evaluation.breakdown || {};

  const breakdown = {
    skillsMatch: Math.min(100, Math.max(0, Number(breakdownRaw.skillsMatch) || 50)),
    experienceRelevance: Math.min(100, Math.max(0, Number(breakdownRaw.experienceRelevance) || 50)),
    educationFit: Math.min(100, Math.max(0, Number(breakdownRaw.educationFit) || 50)),
    roleAlignment: Math.min(100, Math.max(0, Number(breakdownRaw.roleAlignment) || 50)),
    keywordDensity: Math.min(100, Math.max(0, Number(breakdownRaw.keywordDensity) || 50)),
  };

  // Compute weighted composite score
  const compositeScore = Math.round(
    (breakdown.skillsMatch * SCORE_WEIGHTS.skillsMatch +
      breakdown.experienceRelevance * SCORE_WEIGHTS.experienceRelevance +
      breakdown.educationFit * SCORE_WEIGHTS.educationFit +
      breakdown.roleAlignment * SCORE_WEIGHTS.roleAlignment +
      breakdown.keywordDensity * SCORE_WEIGHTS.keywordDensity) /
      100,
  );

  // Determine fitness label from composite score
  let fitnessLabel;
  if (compositeScore >= 75) fitnessLabel = "STRONG_MATCH";
  else if (compositeScore >= 55) fitnessLabel = "GOOD_MATCH";
  else if (compositeScore >= 35) fitnessLabel = "FAIR_MATCH";
  else fitnessLabel = "LOW_MATCH";

  // ── Step 8: Persist permanently ──────────────────────────────
  const fitnessDoc = await FitnessScore.findOneAndUpdate(
    { candidateId, openingId },
    {
      candidateId,
      openingId,
      resumeId,
      candidateFitRating,
      fitnessLabel,
      score: compositeScore,
      justification,
      breakdown,
      contentHash,
      embedding,
      resumeSummary: resumeSummary || resumeText.slice(0, 5000),
      jobDescriptionUsed: jobDescription,
      modelUsed: SCORING_MODEL,
      tokenUsage: {
        summaryTokens: summaryTokens || 0,
        scoreTokens: scoreTokens || 0,
        embeddingTokens: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(`FitnessScore created: id=${fitnessDoc._id}, score=${compositeScore}, label=${fitnessLabel}`);

  return {
    score: compositeScore,
    candidateFitRating,
    fitnessLabel,
    justification,
    breakdown,
    cached: false,
  };
}

/**
 * Retrieve a previously stored fitness score by (candidateId, openingId).
 * Returns null if not found.
 */
async function getStoredFitnessScore(candidateId, openingId) {
  const doc = await FitnessScore.findOne({ candidateId, openingId })
    .select("score candidateFitRating fitnessLabel justification breakdown createdAt")
    .lean();
  return doc || null;
}

// ── Exports ──────────────────────────────────────────────────────

module.exports = {
  calculateFitnessScore,
  getStoredFitnessScore,
  buildJobDescription,
  generateResumeSummary,
  generateEmbedding,
  SCORE_WEIGHTS,
  SEMANTIC_SIMILARITY_THRESHOLD,
};
