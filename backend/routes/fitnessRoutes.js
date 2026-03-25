const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  calculateFitnessScore,
  getStoredFitnessScore,
} = require("../services/fitnessScoreService");
const JobOpening = require("../models/JobOpening");

const router = express.Router();

/**
 * POST /api/fitness/calculate
 * Calculate resume-to-JD fitness score (RAG pipeline).
 *
 * Body: { resumeText, openingId, resumeId? }
 *
 * Unlike the old implementation, this:
 *  1. Fetches the full opening document (not just JD text)
 *  2. Uses the RAG-based fitnessScoreService (summary + evaluation)
 *  3. Returns permanently stored results
 */
router.post("/calculate", protect, async (req, res) => {
  try {
    const { resumeText, openingId, resumeId } = req.body;
    const candidateId = req.user._id;

    if (!resumeText) {
      return res.status(400).json({
        success: false,
        error: "resumeText is required",
      });
    }
    if (!openingId) {
      return res.status(400).json({
        success: false,
        error: "openingId is required",
      });
    }

    // Fetch full opening document for structured JD building
    const opening = await JobOpening.findById(openingId).lean();
    if (!opening) {
      return res.status(404).json({
        success: false,
        error: "Job opening not found",
      });
    }

    const result = await calculateFitnessScore(
      resumeText,
      opening,
      candidateId,
      resumeId || null,
    );

    res.status(200).json({
      success: true,
      data: {
        score: result.score,
        candidateFitRating: result.candidateFitRating,
        fitnessLabel: result.fitnessLabel,
        justification: result.justification,
        breakdown: result.breakdown || {},
        cached: result.cached || false,
      },
    });
  } catch (error) {
    console.error("Fitness score error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /api/fitness/stored/:openingId
 * Retrieve a previously stored fitness score for the current user.
 */
router.get("/stored/:openingId", protect, async (req, res) => {
  try {
    const { openingId } = req.params;
    const candidateId = req.user._id;

    const stored = await getStoredFitnessScore(candidateId, openingId);

    res.status(200).json({
      success: true,
      data: stored,
    });
  } catch (error) {
    console.error("Stored fitness score error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
