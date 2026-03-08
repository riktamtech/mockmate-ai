const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");
const {
  getStatus,
  saveConsent,
  findOrCreateOpening,
  createCandidate,
  scheduleInterview,
  cancelInterview,
  rescheduleInterview,
  getReport,
  saveProgress,
  startOver,
  markInProgress,
  checkCompletion,
  resumeInterview,
  adminGetAll,
  adminGetDetail,
  adminGetResumeUrl,
  adminGetRecordingUrls,
  adminGetStats,
  adminGetRoles,
} = require("../controllers/proctoredInterviewController");

// ── Candidate routes (require auth) ──────────────────────────────────────

router.get("/status", protect, getStatus);
router.post("/consent", protect, saveConsent);
router.post("/find-or-create-opening", protect, findOrCreateOpening);
router.post("/create-candidate", protect, createCandidate);
router.post("/schedule", protect, scheduleInterview);
router.post("/cancel", protect, cancelInterview);
router.post("/reschedule", protect, rescheduleInterview);
router.get("/report", protect, getReport);
router.post("/save-progress", protect, saveProgress);
router.post("/start-over", protect, startOver);
router.post("/mark-in-progress", protect, markInProgress);
router.post("/check-completion", protect, checkCompletion);
router.post("/resume-interview", protect, resumeInterview);

// ── Admin routes ─────────────────────────────────────────────────────────

router.get("/admin/stats", protect, admin, adminGetStats);
router.get("/admin/roles", protect, admin, adminGetRoles);
router.get("/admin/all", protect, admin, adminGetAll);
router.get("/admin/:id/resume", protect, admin, adminGetResumeUrl);
router.get("/admin/:id/recording-urls", protect, admin, adminGetRecordingUrls);
router.get("/admin/:id", protect, admin, adminGetDetail);

module.exports = router;
