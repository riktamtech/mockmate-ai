const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getMyResume,
  getResumeForOpening,
  getSkillGap,
} = require("../controllers/centralisedResumeController");

// ── Candidate-facing routes ─────────────────────────────────────

// Get my centralised resume profile
router.get("/me", protect, getMyResume);

// Get fitness score against a specific opening (zero LLM cost)
router.get("/fitness/:openingId", protect, getResumeForOpening);

// Get skill gap analysis against a specific opening
router.get("/gap/:openingId", protect, getSkillGap);

module.exports = router;
