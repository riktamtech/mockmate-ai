const JobApplication = require("../models/JobApplication");
const JobOpening = require("../models/JobOpening");
const CandidateProfile = require("../models/CandidateProfile");
const CandidateResume = require("../models/CandidateResume");
const notificationTriggers = require("../services/notificationTriggerService");

/**
 * Job Application Controller — Handles candidate applications
 */

/** POST /api/applications/submit */
const submitApplication = async (req, res) => {
  try {
    const { openingId, resumeId, fitnessScore, scheduledAt, saveProfile } = req.body;
    const userId = req.user._id;

    const opening = await JobOpening.findById(openingId);
    if (!opening || !opening.isEnabled) {
      return res.status(404).json({ success: false, error: "Opening not found or closed" });
    }

    const existing = await JobApplication.findOne({ candidateId: userId, openingId });
    if (existing) {
      return res.status(409).json({ success: false, error: "Already applied" });
    }

    const threshold = opening.mockmateConfig?.fitnessThreshold || 0;
    if (threshold > 0 && fitnessScore < threshold) {
      return res.status(400).json({ success: false, error: "Fitness score below threshold" });
    }

    const needsApproval = opening.mockmateConfig?.approvalRequired;
    const status = needsApproval ? "PENDING_APPROVAL" : "APPROVED";

    const application = await JobApplication.create({
      candidateId: userId,
      openingId,
      zinterviewOpeningId: opening.zinterviewOpeningId,
      status,
      fitnessScore,
      resumeId,
      appliedAt: new Date(),
      scheduledAt: scheduledAt || null,
      lifecycleHistory: [{ stage: "APPLIED", timestamp: new Date() }],
    });

    if (saveProfile) {
      await CandidateProfile.findOneAndUpdate(
        { userId },
        { $set: { ...req.body, userId, savedDetails: true } },
        { upsert: true },
      );
    }

    await notificationTriggers.applicationSubmitted(userId, opening.title, application._id);

    res.status(201).json({ success: true, data: application });
  } catch (error) {
    console.error("Error submitting application:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/** GET /api/applications/mine */
const getMyApplications = async (req, res) => {
  try {
    const { cursor, limit = 20, status } = req.query;
    const pageLimit = Math.min(parseInt(limit) || 20, 50);
    const query = { candidateId: req.user._id };
    if (cursor) query._id = { $lt: cursor };
    if (status) query.status = status;

    const apps = await JobApplication.find(query)
      .populate("openingId", "title orgName orgLogoUrl coreSkills")
      .sort({ appliedAt: -1 })
      .limit(pageLimit + 1)
      .lean();

    const hasMore = apps.length > pageLimit;
    const results = hasMore ? apps.slice(0, pageLimit) : apps;

    res.status(200).json({
      success: true,
      data: results,
      meta: { count: results.length, hasMore, nextCursor: hasMore ? results[results.length - 1]._id : null },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/** GET /api/applications/:id */
const getApplicationDetail = async (req, res) => {
  try {
    const app = await JobApplication.findOne({ _id: req.params.id, candidateId: req.user._id })
      .populate("openingId")
      .lean();
    if (!app) return res.status(404).json({ success: false, error: "Not found" });
    res.status(200).json({ success: true, data: app });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/** POST /api/applications/:id/withdraw */
const withdrawApplication = async (req, res) => {
  try {
    const app = await JobApplication.findOneAndUpdate(
      { _id: req.params.id, candidateId: req.user._id, status: { $in: ["PENDING_APPROVAL", "APPROVED"] } },
      { $set: { status: "WITHDRAWN" }, $push: { lifecycleHistory: { stage: "WITHDRAWN", timestamp: new Date() } } },
      { new: true },
    );
    if (!app) return res.status(404).json({ success: false, error: "Cannot withdraw" });
    res.status(200).json({ success: true, data: app });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/** GET /api/profile */
const getCandidateProfile = async (req, res) => {
  try {
    const profile = await CandidateProfile.findOne({ userId: req.user._id }).lean();
    res.status(200).json({ success: true, data: profile || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/** GET /api/resumes */
const getCachedResumes = async (req, res) => {
  try {
    const doc = await CandidateResume.findOne({ userId: req.user._id }).lean();
    res.status(200).json({ success: true, data: doc || { resumes: [] } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = {
  submitApplication, getMyApplications, getApplicationDetail,
  withdrawApplication, getCandidateProfile, getCachedResumes,
};
