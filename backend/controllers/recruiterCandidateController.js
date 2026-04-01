/**
 * RecruiterCandidateController — Recruiter-facing API for the Global Candidate Pool.
 *
 * These endpoints are consumed by Zinterview-backend via proxy.
 * All endpoints verify the request comes from a trusted service (HMAC or JWT).
 *
 * Endpoints:
 *  - GET  /api/recruiter/candidates          → List candidates with advanced filters
 *  - GET  /api/recruiter/candidates/:userId   → Full CentralisedResume for a candidate
 *  - GET  /api/recruiter/opening/:openingId/applicants → Per-opening MockMate applicants
 *  - PUT  /api/recruiter/opening/:openingId/custom-questions → Update custom questions config
 */

const CentralisedResume = require("../models/CentralisedResume");
const JobApplication = require("../models/JobApplication");
const JobOpening = require("../models/JobOpening");
const configService = require("../services/configService");
const { computeFitnessForOpening } = require("../services/centralisedResumeService");

// ── GET /api/recruiter/candidates ────────────────────────────────

/**
 * List candidates with advanced filtering and sorting.
 *
 * Query params:
 *  - page (default 1), limit (default 50, max 100)
 *  - sort: compositeScore | experience | recentInterview | profileCompleteness | problemSolving | trust
 *  - sortOrder: asc | desc (default desc)
 *  - minCompositeScore, maxCompositeScore
 *  - minExperience, maxExperience
 *  - minProblemSolving, minCommunication, minTrust
 *  - skills: comma-separated skill names
 *  - minSkillScore: minimum score for each listed skill
 *  - depthLevel: comma-separated (BEGINNER,INTERMEDIATE,ADVANCED,EXPERT)
 *  - minProfileCompleteness
 *  - search: text search across skills, summary
 */
const listCandidates = async (req, res) => {
  try {
    const config = await configService.getConfig();
    if (!config.FEATURE_GLOBAL_CANDIDATE_POOL) {
      return res.status(404).json({ success: false, error: "Feature not available" });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    // Build MongoDB filter
    const filter = {};

    // ── Composite score range ─────────────────────────────────
    if (req.query.minCompositeScore || req.query.maxCompositeScore) {
      filter.overallCompositeScore = {};
      if (req.query.minCompositeScore) {
        filter.overallCompositeScore.$gte = Number(req.query.minCompositeScore);
      }
      if (req.query.maxCompositeScore) {
        filter.overallCompositeScore.$lte = Number(req.query.maxCompositeScore);
      }
    }

    // ── Experience range ──────────────────────────────────────
    if (req.query.minExperience || req.query.maxExperience) {
      filter.totalYearsExperience = {};
      if (req.query.minExperience) {
        filter.totalYearsExperience.$gte = Number(req.query.minExperience);
      }
      if (req.query.maxExperience) {
        filter.totalYearsExperience.$lte = Number(req.query.maxExperience);
      }
    }

    // ── Performance score filters ─────────────────────────────
    if (req.query.minProblemSolving) {
      filter.problemSolvingScore = { $gte: Number(req.query.minProblemSolving) };
    }
    if (req.query.minCommunication) {
      filter.communicationScore = { $gte: Number(req.query.minCommunication) };
    }
    if (req.query.minTrust) {
      filter.avgTrustScore = { $gte: Number(req.query.minTrust) };
    }

    // ── Profile completeness ──────────────────────────────────
    if (req.query.minProfileCompleteness) {
      filter.profileCompleteness = { $gte: Number(req.query.minProfileCompleteness) };
    }

    // ── Skills filter (with per-skill min score) ──────────────
    if (req.query.skills) {
      const skillNames = req.query.skills.split(",").map((s) => s.trim()).filter(Boolean);
      const minScore = Number(req.query.minSkillScore) || 0;

      if (skillNames.length > 0) {
        filter.skills = {
          $elemMatch: {
            skillName: { $in: skillNames },
            bestScore: { $gte: minScore },
          },
        };
      }
    }

    // ── Depth level filter ────────────────────────────────────
    if (req.query.depthLevel) {
      const levels = req.query.depthLevel.split(",").map((l) => l.trim()).filter(Boolean);
      if (levels.length > 0) {
        filter["skills.depthLevel"] = { $in: levels };
      }
    }

    // ── Require at least one completed interview ──────────────
    filter.totalInterviews = { $gte: 1 };

    // ── Sort logic ────────────────────────────────────────────
    const sortField = req.query.sort || "compositeScore";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const sortMap = {
      compositeScore: { overallCompositeScore: sortOrder },
      experience: { totalYearsExperience: sortOrder },
      recentInterview: { lastActivityAt: sortOrder },
      profileCompleteness: { profileCompleteness: sortOrder },
      problemSolving: { problemSolvingScore: sortOrder },
      trust: { avgTrustScore: sortOrder },
      applicationDate: { createdAt: sortOrder },
    };

    const sort = sortMap[sortField] || sortMap.compositeScore;

    // ── Query ─────────────────────────────────────────────────
    const [candidates, total] = await Promise.all([
      CentralisedResume.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email phone")
        .select("-cachedResumeParse -metadata")
        .lean(),
      CentralisedResume.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: candidates,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasMore: skip + candidates.length < total,
      },
    });
  } catch (error) {
    console.error("listCandidates error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch candidates" });
  }
};

// ── GET /api/recruiter/candidates/:userId ────────────────────────

/**
 * Get full CentralisedResume for a specific candidate.
 */
const getCandidateDetail = async (req, res) => {
  try {
    const config = await configService.getConfig();
    if (!config.FEATURE_GLOBAL_CANDIDATE_POOL) {
      return res.status(404).json({ success: false, error: "Feature not available" });
    }

    const resume = await CentralisedResume.findOne({
      userId: req.params.userId,
    })
      .populate("userId", "name email phone linkedinUrl githubUrl portfolioUrl")
      .lean();

    if (!resume) {
      return res.status(404).json({ success: false, error: "Candidate not found" });
    }

    res.status(200).json({ success: true, data: resume });
  } catch (error) {
    console.error("getCandidateDetail error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch candidate" });
  }
};

// ── GET /api/recruiter/opening/:openingId/applicants ─────────────

/**
 * Get all MockMate applicants for a specific opening.
 * Enriches with CentralisedResume data and composite fitness score.
 */
const getOpeningApplicants = async (req, res) => {
  try {
    const config = await configService.getConfig();
    if (!config.FEATURE_OPENING_MOCKMATE_TAB) {
      return res.status(404).json({ success: false, error: "Feature not available" });
    }

    const { openingId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status;

    const appFilter = { openingId };
    if (statusFilter) {
      appFilter.status = statusFilter;
    }

    const [applications, total] = await Promise.all([
      JobApplication.find(appFilter)
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      JobApplication.countDocuments(appFilter),
    ]);

    // Enrich with CentralisedResume data
    const candidateIds = applications.map((a) => a.candidateId).filter(Boolean);
    const resumes = await CentralisedResume.find({
      userId: { $in: candidateIds },
    })
      .populate("userId", "name email phone")
      .select("userId skills overallCompositeScore problemSolvingScore communicationScore avgTrustScore integrityVerdict profileCompleteness totalInterviews totalYearsExperience")
      .lean();

    const resumeMap = new Map(resumes.map((r) => [r.userId?._id?.toString() || r.userId?.toString(), r]));

    const enriched = applications.map((app) => ({
      ...app,
      centralResume: resumeMap.get(app.candidateId?.toString()) || null,
    }));

    res.status(200).json({
      success: true,
      data: enriched,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasMore: skip + applications.length < total,
      },
    });
  } catch (error) {
    console.error("getOpeningApplicants error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch applicants" });
  }
};

// ── PUT /api/recruiter/opening/:openingId/custom-questions ───────

/**
 * Update custom questions config for an opening.
 * Body: { mode, directQuestions, conceptGuidance, batchApply, candidateOverrides }
 */
const updateCustomQuestions = async (req, res) => {
  try {
    const config = await configService.getConfig();
    if (!config.FEATURE_OPENING_MOCKMATE_TAB) {
      return res.status(404).json({ success: false, error: "Feature not available" });
    }

    const { openingId } = req.params;
    const { mode, directQuestions, conceptGuidance, batchApply, candidateOverrides } = req.body;

    const update = {};
    if (mode !== undefined) update["mockmateConfig.customQuestionsConfig.mode"] = mode;
    if (directQuestions !== undefined) update["mockmateConfig.customQuestionsConfig.directQuestions"] = directQuestions;
    if (conceptGuidance !== undefined) update["mockmateConfig.customQuestionsConfig.conceptGuidance"] = conceptGuidance;
    if (batchApply !== undefined) update["mockmateConfig.customQuestionsConfig.batchApply"] = batchApply;
    if (candidateOverrides !== undefined) update["mockmateConfig.customQuestionsConfig.candidateOverrides"] = candidateOverrides;

    const opening = await JobOpening.findByIdAndUpdate(
      openingId,
      { $set: update },
      { new: true },
    );

    if (!opening) {
      return res.status(404).json({ success: false, error: "Opening not found" });
    }

    res.status(200).json({
      success: true,
      data: opening.mockmateConfig.customQuestionsConfig,
    });
  } catch (error) {
    console.error("updateCustomQuestions error:", error);
    res.status(500).json({ success: false, error: "Failed to update custom questions" });
  }
};

module.exports = {
  listCandidates,
  getCandidateDetail,
  getOpeningApplicants,
  updateCustomQuestions,
};
