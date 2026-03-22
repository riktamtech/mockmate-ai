const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { calculateFitnessScore } = require("../services/fitnessScoreService");

const router = express.Router();

/**
 * POST /api/fitness/calculate
 * Calculate resume-to-JD fitness score
 */
router.post("/calculate", protect, async (req, res) => {
  try {
    const { resumeText, jobDescription, resumeId, openingId } = req.body;

    if (!resumeText || !jobDescription) {
      return res.status(400).json({
        success: false,
        error: "resumeText and jobDescription are required",
      });
    }

    const result = await calculateFitnessScore(
      resumeText,
      jobDescription,
      resumeId || "unknown",
      openingId || "unknown",
    );

    res.status(200).json({
      success: true,
      data: {
        score: result.score,
        breakdown: result.breakdown || {},
        summary: result.summary || "",
        cached: result.cached || false,
      },
    });
  } catch (error) {
    console.error("Fitness score error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
