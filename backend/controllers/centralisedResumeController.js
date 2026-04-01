/**
 * CentralisedResumeController — API endpoints for the living candidate profile.
 *
 * All endpoints are feature-flag gated via FEATURE_CENTRALISED_RESUME.
 */

const CentralisedResume = require("../models/CentralisedResume");
const JobOpening = require("../models/JobOpening");
const {
  computeFitnessForOpening,
  computeSkillGap,
} = require("../services/centralisedResumeService");
const configService = require("../services/configService");

/**
 * GET /api/centralised-resume/me
 * Returns the current user's CentralisedResume profile.
 */
const getMyResume = async (req, res) => {
  try {
    const config = await configService.getConfig();
    if (!config.FEATURE_CENTRALISED_RESUME) {
      return res
        .status(404)
        .json({ success: false, error: "Feature not available" });
    }

    const resume = await CentralisedResume.findOne({
      userId: req.user._id,
    }).lean();

    if (!resume) {
      return res.status(200).json({
        success: true,
        data: null,
        message:
          "No centralised resume found. Upload a resume or complete an interview to create one.",
      });
    }

    res.status(200).json({ success: true, data: resume });
  } catch (error) {
    console.error("getMyResume error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch resume" });
  }
};

/**
 * GET /api/centralised-resume/fitness/:openingId
 * Compute composite fitness score against a specific opening.
 * Zero LLM cost — uses stored CentralisedResume data only.
 */
const getResumeForOpening = async (req, res) => {
  try {
    const config = await configService.getConfig();
    if (!config.FEATURE_CENTRALISED_RESUME) {
      return res
        .status(404)
        .json({ success: false, error: "Feature not available" });
    }

    const { openingId } = req.params;
    const opening = await JobOpening.findById(openingId).lean();
    if (!opening) {
      return res
        .status(404)
        .json({ success: false, error: "Opening not found" });
    }

    const fitness = await computeFitnessForOpening(req.user._id, opening);

    res.status(200).json({
      success: true,
      data: fitness,
    });
  } catch (error) {
    console.error("getResumeForOpening error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to compute fitness" });
  }
};

/**
 * GET /api/centralised-resume/gap/:openingId
 * Compute skill gap analysis against a specific opening.
 */
const getSkillGap = async (req, res) => {
  try {
    const config = await configService.getConfig();
    if (!config.FEATURE_CENTRALISED_RESUME) {
      return res
        .status(404)
        .json({ success: false, error: "Feature not available" });
    }

    const { openingId } = req.params;
    const opening = await JobOpening.findById(openingId).lean();
    if (!opening) {
      return res
        .status(404)
        .json({ success: false, error: "Opening not found" });
    }

    const gap = await computeSkillGap(req.user._id, opening);

    res.status(200).json({
      success: true,
      data: gap,
    });
  } catch (error) {
    console.error("getSkillGap error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to compute skill gap" });
  }
};

module.exports = {
  getMyResume,
  getResumeForOpening,
  getSkillGap,
};
