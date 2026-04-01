/**
 * CentralisedResumeService — Core service for the living candidate profile.
 *
 * Responsibilities:
 *  1. seedFromResume()        – Parse uploaded resume and create initial skeleton
 *  2. updateFromResume()      – Refresh source data when candidate changes resume
 *  3. enrichFromInterview()   – Union interview results into the centralised resume
 *  4. computeCompositeScore() – Weighted algorithmic score (zero LLM cost)
 *  5. computeSkillGap()       – Diff candidate skills against JD requirements
 *  6. computeFitnessForOpening() – Full composite fitness against an opening
 *
 * All functions are feature-flag gated via configService.getConfig().
 */

const { GoogleGenAI } = require("@google/genai");
const CentralisedResume = require("../models/CentralisedResume");
const CandidateResume = require("../models/CandidateResume");
const { normaliseSkill, normaliseSkills } = require("../constants/skillNormalisationMap");
const { decompressText } = require("./compressionUtils");
const configService = require("./configService");

// ── Gemini Client ─────────────────────────────────────────────────

const getGenAI = () =>
  new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "" });

const PARSING_MODEL = "gemini-2.0-flash";

// ── Composite Score Weights ───────────────────────────────────────

const COMPOSITE_WEIGHTS = {
  skillMatch: 0.35,
  experience: 0.20,
  depthCoverage: 0.15,
  performance: 0.15,
  consistency: 0.10,
  trust: 0.05,
};

// ── Resume Parse Prompt ───────────────────────────────────────────

const RESUME_PARSE_PROMPT = `
You are an expert resume parser. Analyse the resume text below and extract ALL structured data.

Output a JSON object with EXACTLY these fields:
{
  "skills": [{"skillName": "<canonical name>", "estimatedLevel": "BEGINNER|INTERMEDIATE|ADVANCED|EXPERT"}],
  "educationHistory": [{"institution": "<name>", "degree": "<degree>", "field": "<field>", "graduationYear": <year or null>}],
  "workHistory": [{"company": "<name>", "role": "<title>", "durationMonths": <num>, "highlights": ["<key achievement>"]}],
  "certifications": ["<cert name>"],
  "projectHighlights": ["<brief project description>"],
  "totalYearsExperience": <number>,
  "experienceSummary": "<2-3 sentence summary of professional background>",
  "technicalStrengths": ["<strength area>"],
  "technicalWeaknesses": ["<weakness/gap area>"]
}

Rules:
- Extract ALL technical and soft skills mentioned
- Calculate totalYearsExperience from actual work durations, not self-reported claims
- Be conservative with skill levels — only mark EXPERT if there's clear evidence
- Include all education, even partially completed
- For projectHighlights, focus on technical complexity and impact
- technicalWeaknesses should highlight areas where the resume shows gaps relative to typically expected skills for their level

Resume Text:
###
`;

// ══════════════════════════════════════════════════════════════════
// 1. SEED FROM RESUME (called once on first resume upload)
// ══════════════════════════════════════════════════════════════════

/**
 * Parse an uploaded resume and create the initial CentralisedResume skeleton.
 * Idempotent: if a CentralisedResume already exists for this user, it merges
 * the source data without overwriting interview-verified metrics.
 *
 * @param {ObjectId} userId       - User ID
 * @param {ObjectId} resumeId     - CandidateResume entry _id
 * @param {string}   resumeText   - Full extracted resume text
 * @returns {Object}              - The created/updated CentralisedResume
 */
async function seedFromResume(userId, resumeId, resumeText) {
  const config = await configService.getConfig();
  if (!config.FEATURE_CENTRALISED_RESUME) {
    console.log("[CentralisedResume] Feature disabled, skipping seed");
    return null;
  }

  if (!resumeText || resumeText.trim().length < 50) {
    console.warn("[CentralisedResume] Insufficient resume text for parsing");
    return null;
  }

  // Check if we already have a cached parse for this exact resume
  const existing = await CentralisedResume.findOne({ userId });
  if (
    existing?.cachedResumeParse?.resumeIdUsed?.toString() === resumeId?.toString() &&
    existing?.cachedResumeParse?.parseResult
  ) {
    console.log("[CentralisedResume] Resume already parsed and cached, skipping re-parse");
    return existing;
  }

  // Parse via Gemini
  const parseResult = await _parseResumeWithAI(resumeText);
  if (!parseResult) {
    console.error("[CentralisedResume] AI resume parse failed");
    return null;
  }

  // Normalise all skills async
  const normalisedSkills = await Promise.all((parseResult.skills || []).map(async (s) => ({
    skillName: await normaliseSkill(s.skillName),
    bestScore: 0, // Not verified yet — will be set by interviews
    currentScore: 0,
    trend: "STABLE",
    totalAttempts: 0,
    sourceInterviewId: null,
    lastAssessedAt: null,
    questionCount: 0,
    confidence: "LOW", // Unverified from resume
    depthLevel: s.estimatedLevel || "BEGINNER",
    subTopicsCovered: [],
  })));

  // Build the update payload
  const updatePayload = {
    resumeSourceData: {
      parsedFromResumeId: resumeId,
      initialParsedAt: new Date(),
      rawSkillsExtracted: (parseResult.skills || []).map((s) => s.skillName),
      educationHistory: parseResult.educationHistory || [],
      workHistory: parseResult.workHistory || [],
      certifications: parseResult.certifications || [],
      projectHighlights: parseResult.projectHighlights || [],
    },
    experienceSummary: parseResult.experienceSummary || "",
    totalYearsExperience: parseResult.totalYearsExperience || 0,
    cachedResumeParse: {
      parsedAt: new Date(),
      resumeIdUsed: resumeId,
      parseResult,
    },
    lastActivityAt: new Date(),
  };

  // If this is a new profile, set initial strengths/weaknesses from resume
  if (!existing) {
    updatePayload.skills = normalisedSkills;
    updatePayload.technicalStrengths = (parseResult.technicalStrengths || []).map((s) => ({
      area: s,
      description: `Identified from resume`,
      evidenceFromInterviewId: null,
    }));
    updatePayload.technicalWeaknesses = (parseResult.technicalWeaknesses || []).map((w) => ({
      area: w,
      description: `Identified from resume`,
      suggestedImprovement: "",
      evidenceFromInterviewId: null,
    }));
  } else {
    // Merge new resume skills without overwriting interview-verified scores
    const existingSkillMap = new Map(existing.skills.map((s) => [s.skillName, s]));
    for (const skill of normalisedSkills) {
      if (!existingSkillMap.has(skill.skillName)) {
        existingSkillMap.set(skill.skillName, skill);
      }
      // If skill already exists with an interview-verified score, keep it
    }
    updatePayload.skills = Array.from(existingSkillMap.values());
  }

  // Recalculate profile completeness
  updatePayload.profileCompleteness = _calculateProfileCompleteness(updatePayload, existing);

  const resume = await CentralisedResume.findOneAndUpdate(
    { userId },
    { $set: updatePayload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(`[CentralisedResume] Seeded for userId=${userId}, skills=${resume.skills.length}`);
  return resume;
}

// ══════════════════════════════════════════════════════════════════
// 2. UPDATE FROM RESUME (when candidate changes resume in settings)
// ══════════════════════════════════════════════════════════════════

/**
 * Re-parse when the candidate updates their resume in profile settings.
 * Merges new data without overwriting interview-verified metrics.
 *
 * @param {ObjectId} userId     - User ID
 * @param {ObjectId} resumeId   - New resume entry _id
 * @param {string}   resumeText - Full extracted resume text
 * @returns {Object}            - Updated CentralisedResume
 */
async function updateFromResume(userId, resumeId, resumeText) {
  // Delegates to seedFromResume which handles merge logic
  return seedFromResume(userId, resumeId, resumeText);
}

// ══════════════════════════════════════════════════════════════════
// 3. ENRICH FROM INTERVIEW (post-interview completion hook)
// ══════════════════════════════════════════════════════════════════

/**
 * After an interview completes, union the results into the CentralisedResume.
 * Uses $max for scores (keeps best), appends new sub-topics, updates metrics.
 *
 * @param {ObjectId} userId          - User ID
 * @param {Object}   interviewData   - Processed interview results:
 *   {
 *     interviewId: ObjectId,
 *     skillResults: [{ skillName, score, depthLevel, subTopicsCovered, questionCount }],
 *     problemSolvingScore: Number,
 *     communicationScore: Number,
 *     codeQualityScore: Number,
 *     trustScore: Number,
 *     cheatingLikelihood: Number,
 *     recordingUrl: String,
 *     transcriptUrl: String,
 *     evaluationSummary: String,
 *     duration: Number (minutes),
 *     strengths: [String],
 *     weaknesses: [{ area: String, suggestion: String }],
 *   }
 */
async function enrichFromInterview(userId, interviewData) {
  const config = await configService.getConfig();
  if (!config.FEATURE_CENTRALISED_RESUME) {
    return null;
  }

  const resume = await CentralisedResume.findOne({ userId });
  if (!resume) {
    console.warn(`[CentralisedResume] No profile found for userId=${userId}, creating skeleton`);
    // Create a minimal profile — full seeding will happen when they upload a resume
    const newResume = await CentralisedResume.create({ userId });
    return _applyInterviewEnrichment(newResume, interviewData);
  }

  return _applyInterviewEnrichment(resume, interviewData);
}

/**
 * Internal: apply interview data to an existing CentralisedResume document.
 */
async function _applyInterviewEnrichment(resume, data) {
  const {
    interviewId,
    skillResults = [],
    problemSolvingScore,
    communicationScore,
    codeQualityScore,
    trustScore,
    cheatingLikelihood,
    recordingUrl,
    transcriptUrl,
    evaluationSummary,
    duration,
    strengths = [],
    weaknesses = [],
  } = data;

  // ── Merge skill scores (best-score union) ───────────────────────
  const skillMap = new Map(resume.skills.map((s) => [s.skillName, { ...s.toObject() }]));

  for (const result of skillResults) {
    const canonicalName = await normaliseSkill(result.skillName);
    const existing = skillMap.get(canonicalName);

    if (existing) {
      // Update with best score
      const previousBest = existing.bestScore;
      existing.bestScore = Math.max(existing.bestScore, result.score);
      existing.currentScore = result.score;
      existing.totalAttempts = (existing.totalAttempts || 0) + 1;
      existing.questionCount = (existing.questionCount || 0) + (result.questionCount || 0);
      existing.lastAssessedAt = new Date();
      existing.confidence = result.questionCount >= 5 ? "HIGH" : result.questionCount >= 3 ? "MEDIUM" : "LOW";

      // Update depth level if higher
      const depthOrder = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
      const newIdx = depthOrder.indexOf(result.depthLevel || "BEGINNER");
      const existIdx = depthOrder.indexOf(existing.depthLevel || "BEGINNER");
      if (newIdx > existIdx) existing.depthLevel = result.depthLevel;

      // Append new sub-topics
      const existingTopics = new Set(existing.subTopicsCovered || []);
      for (const topic of result.subTopicsCovered || []) {
        existingTopics.add(topic);
      }
      existing.subTopicsCovered = Array.from(existingTopics);

      // Compute trend
      if (result.score > previousBest) {
        existing.trend = "IMPROVING";
      } else if (result.score < previousBest * 0.85) {
        existing.trend = "DECLINING";
      } else {
        existing.trend = "STABLE";
      }

      // Update sourceInterviewId if this is the new best
      if (result.score >= existing.bestScore) {
        existing.sourceInterviewId = interviewId;
      }

      skillMap.set(canonicalName, existing);
    } else {
      // New skill — add it
      skillMap.set(canonicalName, {
        skillName: canonicalName,
        bestScore: result.score,
        currentScore: result.score,
        trend: "STABLE",
        totalAttempts: 1,
        sourceInterviewId: interviewId,
        lastAssessedAt: new Date(),
        questionCount: result.questionCount || 0,
        confidence: result.questionCount >= 5 ? "HIGH" : result.questionCount >= 3 ? "MEDIUM" : "LOW",
        depthLevel: result.depthLevel || "BEGINNER",
        subTopicsCovered: result.subTopicsCovered || [],
      });
    }
  }

  resume.skills = Array.from(skillMap.values());

  // ── Merge performance metrics (running average) ─────────────────
  const n = resume.totalInterviews || 0;
  const newN = n + 1;

  if (problemSolvingScore != null) {
    resume.problemSolvingScore = Math.round(
      ((resume.problemSolvingScore || 0) * n + problemSolvingScore) / newN,
    );
  }
  if (communicationScore != null) {
    resume.communicationScore = Math.round(
      ((resume.communicationScore || 0) * n + communicationScore) / newN,
    );
  }
  if (codeQualityScore != null) {
    resume.codeQualityScore = Math.round(
      ((resume.codeQualityScore || 0) * n + codeQualityScore) / newN,
    );
  }

  // ── Trust & Integrity (running average) ─────────────────────────
  if (trustScore != null) {
    resume.avgTrustScore = Math.round(
      ((resume.avgTrustScore || 0) * n + trustScore) / newN,
    );
  }
  if (cheatingLikelihood != null) {
    resume.avgCheatingLikelihood = Math.round(
      ((resume.avgCheatingLikelihood || 0) * n + cheatingLikelihood) / newN,
    );
  }

  // Update integrity verdict
  if (resume.avgCheatingLikelihood > 50) {
    resume.integrityVerdict = "FLAGGED";
  } else if (resume.totalInterviews >= 1) {
    resume.integrityVerdict = "TRUSTED";
  }

  // ── Consistency score (100 - stddev of skill scores) ────────────
  const scores = resume.skills
    .filter((s) => s.bestScore > 0)
    .map((s) => s.bestScore);
  if (scores.length > 1) {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
    resume.consistencyScore = Math.max(0, Math.round(100 - Math.sqrt(variance)));
  }

  // ── Depth vs Breadth ────────────────────────────────────────────
  const assessedSkills = resume.skills.filter((s) => s.totalAttempts > 0);
  const totalSkills = resume.skills.length;
  resume.depthVsBreadth = {
    breadthCoverage: totalSkills > 0 ? Math.round((assessedSkills.length / totalSkills) * 100) : 0,
    avgDepthLevel:
      assessedSkills.length > 0
        ? Math.round(
            assessedSkills.reduce((sum, s) => {
              const depthMap = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 4 };
              return sum + (depthMap[s.depthLevel] || 1);
            }, 0) / assessedSkills.length,
          )
        : 0,
  };

  // ── Append strengths and weaknesses ─────────────────────────────
  for (const s of strengths) {
    const exists = resume.technicalStrengths.some((ts) => ts.area === s);
    if (!exists) {
      resume.technicalStrengths.push({
        area: s,
        description: `Demonstrated in interview`,
        evidenceFromInterviewId: interviewId,
      });
    }
  }
  for (const w of weaknesses) {
    const exists = resume.technicalWeaknesses.some((tw) => tw.area === w.area);
    if (!exists) {
      resume.technicalWeaknesses.push({
        area: w.area,
        description: `Identified in interview`,
        suggestedImprovement: w.suggestion || "",
        evidenceFromInterviewId: interviewId,
      });
    }
  }

  // ── Interview recording ref ─────────────────────────────────────
  resume.interviewRecordingRefs.push({
    interviewId,
    recordingUrl: recordingUrl || "",
    transcriptUrl: transcriptUrl || "",
    evaluationSummary: evaluationSummary || "",
    skillsCovered: await Promise.all(skillResults.map((s) => normaliseSkill(s.skillName))),
    date: new Date(),
    duration: duration || 0,
  });

  // ── Aggregates ──────────────────────────────────────────────────
  resume.totalInterviews = newN;
  resume.totalQuestionsAnswered =
    (resume.totalQuestionsAnswered || 0) +
    skillResults.reduce((sum, s) => sum + (s.questionCount || 0), 0);
  resume.lastUpdatedFromInterviewId = interviewId;
  resume.lastActivityAt = new Date();

  // ── Recompute composite score and profile completeness ──────────
  resume.overallCompositeScore = _computeInternalCompositeScore(resume);
  resume.profileCompleteness = _calculateProfileCompleteness(resume.toObject());

  await resume.save();
  console.log(
    `[CentralisedResume] Enriched userId=${resume.userId}, interviews=${newN}, composite=${resume.overallCompositeScore}`,
  );
  return resume;
}

// ══════════════════════════════════════════════════════════════════
// 4. COMPOSITE SCORE COMPUTATION (zero LLM cost)
// ══════════════════════════════════════════════════════════════════

/**
 * Compute internal composite score from CentralisedResume data.
 * Used for the resume's own overallCompositeScore.
 *
 * @param {Object} resume - CentralisedResume document
 * @returns {Number}      - Composite score 0-100
 */
function _computeInternalCompositeScore(resume) {
  const skills = resume.skills || [];
  const assessedSkills = skills.filter((s) => s.totalAttempts > 0 && s.bestScore > 0);

  // Skill Match component: average of all verified skill scores
  const skillMatchScore =
    assessedSkills.length > 0
      ? assessedSkills.reduce((sum, s) => sum + s.bestScore, 0) / assessedSkills.length
      : 0;

  // Experience component: normalised (cap at 100 for 15+ years)
  const experienceScore = Math.min(100, ((resume.totalYearsExperience || 0) / 15) * 100);

  // Depth coverage: how many skills are interview-verified
  const totalSkills = skills.length || 1;
  const depthCoverageScore =
    (assessedSkills.length / totalSkills) *
    (resume.depthVsBreadth?.avgDepthLevel || 1) *
    25; // Scale from depth level (1-4) * 25

  // Performance: average of problem-solving, communication, code quality
  const perfScores = [
    resume.problemSolvingScore || 50,
    resume.communicationScore || 50,
    resume.codeQualityScore || 50,
  ];
  const performanceScore = perfScores.reduce((a, b) => a + b, 0) / perfScores.length;

  // Consistency: already computed
  const consistencyScore = resume.consistencyScore || 50;

  // Trust
  const trustMultiplier = resume.integrityVerdict === "TRUSTED" ? 1.0 : 0.5;
  const trustScore = (resume.avgTrustScore || 50) * trustMultiplier;

  const composite = Math.round(
    skillMatchScore * COMPOSITE_WEIGHTS.skillMatch +
      experienceScore * COMPOSITE_WEIGHTS.experience +
      Math.min(100, depthCoverageScore) * COMPOSITE_WEIGHTS.depthCoverage +
      performanceScore * COMPOSITE_WEIGHTS.performance +
      consistencyScore * COMPOSITE_WEIGHTS.consistency +
      trustScore * COMPOSITE_WEIGHTS.trust,
  );

  return Math.min(100, Math.max(0, composite));
}

// ══════════════════════════════════════════════════════════════════
// 5. COMPUTE FITNESS FOR A SPECIFIC OPENING (zero LLM cost)
// ══════════════════════════════════════════════════════════════════

/**
 * Compute composite fitness score against a specific job opening.
 * Uses the CentralisedResume's verified data — no LLM calls needed.
 *
 * @param {ObjectId} userId  - User ID
 * @param {Object}   opening - JobOpening document
 * @returns {Object}         - { score, label, breakdown, gapSkills }
 */
async function computeFitnessForOpening(userId, opening) {
  const requiredSkills = await _extractRequiredSkills(opening);
  if (!resume) {
    return {
      score: 0,
      label: "LOW_MATCH",
      breakdown: _emptyBreakdown(),
      gapSkills: requiredSkills,
    };
  }

  const userSkillMap = new Map(resume.skills.map((s) => [s.skillName, s]));

  // ── Skill Match Component (35%) ─────────────────────────────────
  let skillMatchSum = 0;
  let skillWeightSum = 0;
  const gapSkills = [];

  for (const req of requiredSkills) {
    // req is already normalised by _extractRequiredSkills
    const userSkill = userSkillMap.get(req);
    const weight = 1; // Equal weight for now; could be weighted by criteria

    if (userSkill && userSkill.bestScore > 0) {
      skillMatchSum += Math.min(userSkill.bestScore, 100) * weight;
    } else {
      gapSkills.push(canonical);
      // Missing skill gets 0
    }
    skillWeightSum += 100 * weight;
  }
  const skillMatchScore = skillWeightSum > 0 ? (skillMatchSum / skillWeightSum) * 100 : 0;

  // ── Experience Component (20%) ──────────────────────────────────
  const minExp = opening.minExperience || 0;
  const maxExp = opening.maxExperience || 20;
  const candidateExp = resume.totalYearsExperience || 0;
  let experienceScore;
  if (candidateExp >= minExp && candidateExp <= maxExp) {
    experienceScore = 100;
  } else if (candidateExp < minExp) {
    experienceScore = Math.max(0, (candidateExp / minExp) * 100);
  } else {
    // Over-qualified is still a reasonable match
    experienceScore = Math.max(60, 100 - (candidateExp - maxExp) * 5);
  }

  // ── Depth Coverage Component (15%) ──────────────────────────────
  const verifiedSkillCount = requiredSkills.filter((s) => {
    const userSkill = userSkillMap.get(s);
    return userSkill && userSkill.totalAttempts > 0;
  }).length;
  const breadth = requiredSkills.length > 0 ? verifiedSkillCount / requiredSkills.length : 0;
  const avgDepth = resume.depthVsBreadth?.avgDepthLevel || 1;
  const depthCoverageScore = Math.min(100, breadth * avgDepth * 25);

  // ── Performance Component (15%) ─────────────────────────────────
  const perfScores = [
    resume.problemSolvingScore || 50,
    resume.communicationScore || 50,
    resume.codeQualityScore || 50,
  ];
  const performanceScore = perfScores.reduce((a, b) => a + b, 0) / perfScores.length;

  // ── Consistency Component (10%) ─────────────────────────────────
  const consistencyScore = resume.consistencyScore || 50;

  // ── Trust Component (5%) ────────────────────────────────────────
  const trustMultiplier = resume.integrityVerdict === "TRUSTED" ? 1.0 : 0.5;
  const trustScore = (resume.avgTrustScore || 50) * trustMultiplier;

  // ── Composite ───────────────────────────────────────────────────
  const composite = Math.round(
    skillMatchScore * COMPOSITE_WEIGHTS.skillMatch +
      experienceScore * COMPOSITE_WEIGHTS.experience +
      depthCoverageScore * COMPOSITE_WEIGHTS.depthCoverage +
      performanceScore * COMPOSITE_WEIGHTS.performance +
      consistencyScore * COMPOSITE_WEIGHTS.consistency +
      trustScore * COMPOSITE_WEIGHTS.trust,
  );

  const score = Math.min(100, Math.max(0, composite));

  let label;
  if (score >= 75) label = "STRONG_MATCH";
  else if (score >= 55) label = "GOOD_MATCH";
  else if (score >= 35) label = "FAIR_MATCH";
  else label = "LOW_MATCH";

  return {
    score,
    label,
    breakdown: {
      skillMatch: Math.round(skillMatchScore),
      experience: Math.round(experienceScore),
      depthCoverage: Math.round(depthCoverageScore),
      performance: Math.round(performanceScore),
      consistency: Math.round(consistencyScore),
      trust: Math.round(trustScore),
    },
    gapSkills,
    profileCompleteness: resume.profileCompleteness,
    totalInterviews: resume.totalInterviews,
  };
}

// ══════════════════════════════════════════════════════════════════
// 6. SKILL GAP ANALYSIS
// ══════════════════════════════════════════════════════════════════

/**
 * Compute the skill gap between a candidate's CentralisedResume and a JD.
 *
 * @param {ObjectId} userId  - User ID
 * @param {Object}   opening - JobOpening document
 * @returns {Object}         - { coveredSkills, gapSkills, coverage }
 */
async function computeSkillGap(userId, opening) {
  const resume = await CentralisedResume.findOne({ userId });
  const requiredSkills = await _extractRequiredSkills(opening);

  if (!resume) {
    return {
      coveredSkills: [],
      gapSkills: requiredSkills,
      coverage: 0,
    };
  }

  const userSkillSet = new Set(resume.skills.map((s) => s.skillName));

  const coveredSkills = [];
  const gapSkills = [];

  for (const skill of requiredSkills) {
    // skill is already normalised
    if (userSkillSet.has(skill)) {
      const userSkill = resume.skills.find((s) => s.skillName === skill);
      coveredSkills.push({
        skillName: skill,
        bestScore: userSkill?.bestScore || 0,
        verified: (userSkill?.totalAttempts || 0) > 0,
      });
    } else {
      gapSkills.push(skill);
    }
  }

  return {
    coveredSkills,
    gapSkills,
    coverage:
      requiredSkills.length > 0
        ? Math.round((coveredSkills.length / requiredSkills.length) * 100)
        : 100,
  };
}

// ══════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════════

/**
 * Parse resume text using Gemini to extract structured data.
 */
async function _parseResumeWithAI(resumeText) {
  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: PARSING_MODEL,
      contents: [
        { role: "user", parts: [{ text: RESUME_PARSE_PROMPT + resumeText + "\n###" }] },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    const raw = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI resume parse response");
      }
    }
    return parsed;
  } catch (err) {
    console.error("[CentralisedResume] AI parse error:", err.message);
    return null;
  }
}

function _emptyBreakdown() {
// ... placeholder to not disrupt line numbers
}

/**
 * Extract required skills from a JobOpening document.
 * Normalises all skill names via DB before returning.
 */
async function _extractRequiredSkills(opening) {
  const rawSkills = [];

  // From skillsGroup
  const groups = opening.skillsGroup || [];
  for (const group of groups) {
    const groupSkills = Array.isArray(group.skills) ? group.skills : [];
    for (const s of groupSkills) {
      const name = typeof s === "string" ? s : s.skillName || s.name || "";
      if (name) rawSkills.push(name);
    }
  }

  // From coreSkills
  const core = opening.coreSkills || [];
  for (const s of core) {
    if (s) rawSkills.push(s);
  }

  // Bulk normalise async
  return await normaliseSkills(rawSkills);
}

/**
 * Calculate profile completeness percentage.
 */
function _calculateProfileCompleteness(data, existing = null) {
  let score = 0;
  const checks = [
    { weight: 15, check: () => (data.resumeSourceData?.workHistory?.length || existing?.resumeSourceData?.workHistory?.length || 0) > 0 },
    { weight: 15, check: () => (data.resumeSourceData?.educationHistory?.length || existing?.resumeSourceData?.educationHistory?.length || 0) > 0 },
    { weight: 10, check: () => (data.experienceSummary || existing?.experienceSummary || "").length > 10 },
    { weight: 20, check: () => {
      const skills = data.skills || existing?.skills || [];
      return skills.some((s) => s.totalAttempts > 0);
    }},
    { weight: 10, check: () => (data.technicalStrengths?.length || existing?.technicalStrengths?.length || 0) > 0 },
    { weight: 10, check: () => (data.interviewRecordingRefs?.length || existing?.interviewRecordingRefs?.length || 0) > 0 },
    { weight: 10, check: () => (data.totalInterviews || existing?.totalInterviews || 0) >= 3 },
    { weight: 10, check: () => (data.resumeSourceData?.certifications?.length || existing?.resumeSourceData?.certifications?.length || 0) > 0 },
  ];

  for (const { weight, check } of checks) {
    try {
      if (check()) score += weight;
    } catch {
      // Ignore check failures
    }
  }

  return Math.min(100, score);
}

/**
 * Return an empty fitness breakdown object.
 */
function _emptyBreakdown() {
  return {
    skillMatch: 0,
    experience: 0,
    depthCoverage: 0,
    performance: 50,
    consistency: 50,
    trust: 50,
  };
}

// ── Exports ───────────────────────────────────────────────────────

module.exports = {
  seedFromResume,
  updateFromResume,
  enrichFromInterview,
  computeFitnessForOpening,
  computeSkillGap,
  COMPOSITE_WEIGHTS,
};
