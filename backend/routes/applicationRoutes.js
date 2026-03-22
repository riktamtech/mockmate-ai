const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  submitApplication, getMyApplications, getApplicationDetail,
  withdrawApplication, getCandidateProfile, getCachedResumes,
} = require("../controllers/jobApplicationController");

const router = express.Router();

// Application endpoints
router.post("/submit", protect, submitApplication);
router.get("/mine", protect, getMyApplications);
router.get("/:id", protect, getApplicationDetail);
router.post("/:id/withdraw", protect, withdrawApplication);

// Profile & Resume endpoints
router.get("/profile/me", protect, getCandidateProfile);
router.get("/resumes/cached", protect, getCachedResumes);

module.exports = router;
