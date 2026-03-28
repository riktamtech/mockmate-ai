/**
 * OpeningMatcherService — High-performance opening matching & merge logic.
 *
 * Provides a weighted multi-factor scoring system to find the best-matching
 * existing opening for a given set of user-provided interview details,
 * and computes a merge payload to patch any missing data into the match.
 *
 * Scoring breakdown (100 pts total):
 *   Title similarity:           0–35
 *   isTechnical match:          0–10
 *   Experience range overlap:   0–25
 *   Skill similarity (Jaccard): 0–30
 *
 * Match threshold: 75 pts (configurable via MATCH_THRESHOLD).
 */

const MATCH_THRESHOLD = 75;

// ── String normalisation helpers ────────────────────────────────────────

/**
 * Normalises a skill string for comparison.
 * Lowercases, trims, removes non-alphanumeric chars (except spaces, +, #, .)
 * and collapses whitespace.
 */
const normalizeSkill = (skill) =>
  (skill || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s+#.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Tokenises a title into individual lower-cased word tokens,
 * filtering out very short noise words.
 */
const NOISE_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "for",
  "in",
  "on",
  "at",
  "to",
  "with",
  "by",
  "is",
  "it",
  "as",
  "be",
  "was",
  "are",
  "from",
]);

const tokenizeTitle = (title) =>
  (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE_WORDS.has(t));

// ── Set utilities ───────────────────────────────────────────────────────

/** Jaccard similarity: |A ∩ B| / |A ∪ B| */
const jaccardSimilarity = (setA, setB) => {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

/** Check if setA is a subset of setB */
const isSubset = (setA, setB) => {
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
};

// ── Scoring functions ───────────────────────────────────────────────────

/**
 * Title similarity score (0–35).
 *
 * - Exact match (case-insensitive)               → 35
 * - One title's tokens are a subset of the other → 30
 * - Token Jaccard ≥ 0.6                          → 20
 * - Otherwise                                    → 0
 */
const scoreTitleSimilarity = (openingTitle, userTitle) => {
  const normOpening = (openingTitle || "").toLowerCase().trim();
  const normUser = (userTitle || "").toLowerCase().trim();

  // Exact match
  if (normOpening === normUser) return 35;

  // Token-based comparison
  const openTokens = new Set(tokenizeTitle(openingTitle));
  const userTokens = new Set(tokenizeTitle(userTitle));

  if (openTokens.size === 0 || userTokens.size === 0) return 0;

  // Subset check: all user tokens in opening OR all opening tokens in user
  if (isSubset(userTokens, openTokens) || isSubset(openTokens, userTokens)) {
    return 30;
  }

  // Jaccard on word tokens
  const jaccard = jaccardSimilarity(openTokens, userTokens);
  if (jaccard >= 0.6) return 20;

  return 0;
};

/**
 * isTechnical match score (0–10).
 */
const scoreIsTechnical = (openingIsTechnical, userIsTechnical) =>
  openingIsTechnical === userIsTechnical ? 10 : 0;

/**
 * Experience range overlap score (0–25).
 *
 * - Complete containment (user range within opening) → 25
 * - Significant overlap (≥ 50% of user range)       → 20
 * - Any overlap                                      → 10
 * - No overlap                                       → 0
 */
const scoreExperienceOverlap = (opening, user) => {
  const oMin = opening.minExperience ?? 0;
  const oMax = opening.maxExperience ?? 20;
  const uMin = user.minExperience ?? 0;
  const uMax = user.maxExperience ?? 20;

  const overlapMin = Math.max(oMin, uMin);
  const overlapMax = Math.min(oMax, uMax);

  if (overlapMin > overlapMax) return 0; // No overlap

  const overlapSize = overlapMax - overlapMin;
  const userRangeSize = Math.max(uMax - uMin, 1);

  // Complete containment: user range fits within opening
  if (uMin >= oMin && uMax <= oMax) return 25;

  // Significant overlap: ≥ 50% of user range is covered
  const overlapRatio = overlapSize / userRangeSize;
  if (overlapRatio >= 0.5) return 20;

  // Any overlap at all
  return 10;
};

/**
 * Skill similarity score (0–30).
 *
 * Flattens all skills from the opening's skillsGroup and computes
 * Jaccard similarity against the user's flat skill list.
 *
 * - Jaccard ≥ 0.70 → 30
 * - Jaccard ≥ 0.50 → 22
 * - Jaccard ≥ 0.30 → 12
 * - Otherwise      → 0
 */
const scoreSkillSimilarity = (opening, userSkills) => {
  const userNormalized = new Set(
    (userSkills || []).map(normalizeSkill).filter(Boolean),
  );

  // Flatten all skills from opening's skills groups
  const openingNormalized = new Set();
  (opening.skillsGroup || []).forEach((sg) => {
    (sg.skills || []).forEach((s) => {
      const norm = normalizeSkill(s);
      if (norm) openingNormalized.add(norm);
    });
  });

  if (userNormalized.size === 0 && openingNormalized.size === 0) return 30;
  if (userNormalized.size === 0 || openingNormalized.size === 0) return 0;

  const jaccard = jaccardSimilarity(userNormalized, openingNormalized);

  if (jaccard >= 0.7) return 30;
  if (jaccard >= 0.5) return 22;
  if (jaccard >= 0.3) return 12;
  return 0;
};

// ── Main scoring function ───────────────────────────────────────────────

/**
 * Compute the total match score between an opening and user details.
 * @param {Object} opening      – Existing Zinterview opening
 * @param {Object} userDetails  – { title, isTechnical, minExperience, maxExperience, skills }
 * @returns {number}            – Score 0–100
 */
const computeMatchScore = (opening, userDetails) => {
  const titleScore = scoreTitleSimilarity(opening.title, userDetails.title);
  const techScore = scoreIsTechnical(
    opening.isTechnical,
    userDetails.isTechnical,
  );
  const expScore = scoreExperienceOverlap(opening, userDetails);
  const skillScore = scoreSkillSimilarity(opening, userDetails.skills);

  return titleScore + techScore + expScore + skillScore;
};

// ── Best match finder ───────────────────────────────────────────────────

const BATCH_SIZE = 20; // Number of openings to score per batch
const EARLY_EXIT_SCORE = 95; // Skip remaining batches if score meets this

/**
 * Find the best-matching opening from a list.
 *
 * Processes openings in batches of BATCH_SIZE using Promise.all per batch.
 * This prevents event-loop starvation when the opening list is very large.
 * An early-exit optimisation short-circuits remaining batches once a
 * near-perfect match (score ≥ EARLY_EXIT_SCORE) is found.
 *
 * @param {Array}  openings     – List of existing Zinterview openings
 * @param {Object} userDetails  – { title, isTechnical, minExperience, maxExperience, skills, jobRequirements }
 * @returns {{ match: Object, score: number, mergePayload: Object|null } | null}
 */
const findBestMatchingOpening = async (openings, userDetails) => {
  if (!Array.isArray(openings) || openings.length === 0) return null;

  let best = null; // { opening, score }

  // Process in batches to avoid blocking the event loop on large lists
  for (let i = 0; i < openings.length; i += BATCH_SIZE) {
    const batch = openings.slice(i, i + BATCH_SIZE);

    // Score the batch concurrently
    const scored = await Promise.all(
      batch.map(async (opening) => ({
        opening,
        score: computeMatchScore(opening, userDetails),
      })),
    );

    // Update best match from this batch
    for (const entry of scored) {
      if (
        entry.score >= MATCH_THRESHOLD &&
        (!best || entry.score > best.score)
      ) {
        best = entry;
      }
    }

    // Early exit: near-perfect match found, no need to score remaining batches
    if (best && best.score >= EARLY_EXIT_SCORE) {
      break;
    }
  }

  if (!best) return null;

  // Build the merge payload for any missing data
  const mergePayload = buildMergePayload(best.opening, userDetails);

  return {
    match: best.opening,
    score: best.score,
    mergePayload,
  };
};

// ── Merge payload builder ───────────────────────────────────────────────

/**
 * Compute the delta between the matched opening and user details.
 * Returns a payload suitable for ZinterviewService.updateOpening(),
 * or null if nothing needs updating.
 *
 * Merges:
 *   - Skills: adds any user skills not already in the opening
 *   - Experience: widens range if user range extends beyond opening's
 *   - Job requirements: appends any new requirements
 *
 * @param {Object} opening      – Matched Zinterview opening
 * @param {Object} userDetails  – User-provided details
 * @returns {Object|null}       – Payload for updateOpening, or null
 */
const buildMergePayload = (opening, userDetails) => {
  const payload = {};
  let hasChanges = false;

  // ── 1. Merge skills ──────────────────────────────────────────────────
  const userSkills = (userDetails.skills || [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (userSkills.length > 0) {
    // Flatten existing opening skills (normalized) for lookup
    const existingNormalized = new Set();
    (opening.skillsGroup || []).forEach((sg) => {
      (sg.skills || []).forEach((s) => {
        existingNormalized.add(normalizeSkill(s));
      });
    });

    // Find skills the user has that the opening doesn't
    const missingSkills = userSkills.filter(
      (s) => !existingNormalized.has(normalizeSkill(s)),
    );

    if (missingSkills.length > 0) {
      // Clone existing groups and add missing skills to the first group
      // (or create a new "Primary Skills" group if none exists)
      const updatedGroups = JSON.parse(
        JSON.stringify(opening.skillsGroup || []),
      );

      if (updatedGroups.length > 0) {
        // Add to the first skill group
        updatedGroups[0].skills = [
          ...updatedGroups[0].skills,
          ...missingSkills,
        ];
      } else {
        updatedGroups.push({
          skillGroupName: "Primary Skills",
          skills: missingSkills,
          criteria: 2,
          weight: 1,
        });
      }

      // Remove MongoDB _id fields that the update API won't accept
      payload.skillsGroup = updatedGroups.map((sg) => ({
        skillGroupName: sg.skillGroupName,
        skills: sg.skills,
        criteria: sg.criteria,
        weight: sg.weight,
      }));
      hasChanges = true;
    }
  }

  // ── 2. Widen experience range ────────────────────────────────────────
  const oMin = opening.minExperience ?? 0;
  const oMax = opening.maxExperience ?? 20;
  const uMin = userDetails.minExperience ?? 0;
  const uMax = userDetails.maxExperience ?? 20;

  let newMin = oMin;
  let newMax = oMax;

  if (uMin < oMin) newMin = uMin;
  if (uMax > oMax) newMax = uMax;

  if (newMin !== oMin || newMax !== oMax) {
    payload.minExperience = newMin;
    payload.maxExperience = newMax;
    hasChanges = true;
  }

  // ── 3. Append missing job requirements ───────────────────────────────
  const existingReqs = new Set(
    (opening.jobRequirementsAndResponsibilities || []).map((r) =>
      r.toLowerCase().trim(),
    ),
  );
  const userReqs = (userDetails.jobRequirements || []).filter(Boolean);
  const newReqs = userReqs.filter(
    (r) => !existingReqs.has(r.toLowerCase().trim()),
  );

  if (newReqs.length > 0) {
    payload.jobRequirementsAndResponsibilities = [
      ...(opening.jobRequirementsAndResponsibilities || []),
      ...newReqs,
    ];
    hasChanges = true;
  }

  return hasChanges ? payload : null;
};

// ── Exports ─────────────────────────────────────────────────────────────

module.exports = {
  findBestMatchingOpening,
  computeMatchScore,
  buildMergePayload,
  normalizeSkill,
  MATCH_THRESHOLD,
};
