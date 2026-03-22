const express = require("express");
const {
  verifyCrossServerAuth,
} = require("../middleware/crossServerAuth");
const {
  syncJobOpening,
  disableJobOpening,
} = require("../controllers/jobSyncController");
const {
  getJobOpenings,
  getJobOpeningById,
  getApplyStatus,
} = require("../controllers/jobOpeningsController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// ── Cross-server sync endpoints (from Zinterview-backend) ─────
router.post("/sync", verifyCrossServerAuth, syncJobOpening);
router.post("/sync/disable", verifyCrossServerAuth, disableJobOpening);

// ── Candidate-facing job listing endpoints ────────────────────
router.get("/", protect, getJobOpenings);
router.get("/:id", protect, getJobOpeningById);
router.get("/:id/apply-status", protect, getApplyStatus);

module.exports = router;
