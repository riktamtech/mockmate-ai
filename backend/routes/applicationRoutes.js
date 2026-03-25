const express = require("express");
const multer = require("multer");
const { protect } = require("../middleware/authMiddleware");
const {
  submitApplication,
  submitFullApplication,
  finalizeApplication,
  getMyApplications,
  getApplicationDetail,
  withdrawApplication,
  getCandidateProfile,
  updateCandidateProfile,
  getCachedResumes,
  uploadApplicationResume,
} = require("../controllers/jobApplicationController");

const router = express.Router();

// Multer config for resume uploads (in-memory, max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, DOCX, and image files are allowed"), false);
    }
  },
});

// ── Full application flow (OBJ-5) ────────────────────────────────
router.post("/submit-full", protect, submitFullApplication);
router.post("/finalize", protect, finalizeApplication);

// ── Legacy submit ────────────────────────────────────────────────
router.post("/submit", protect, submitApplication);

// ── Application endpoints ────────────────────────────────────────
router.get("/mine", protect, getMyApplications);
router.get("/:id", protect, getApplicationDetail);
router.post("/:id/withdraw", protect, withdrawApplication);

// ── Profile & Resume endpoints ───────────────────────────────────
router.get("/profile/me", protect, getCandidateProfile);
router.put("/profile/me", protect, updateCandidateProfile);
router.get("/resumes/cached", protect, getCachedResumes);
router.post("/resumes/upload", protect, upload.single("resume"), uploadApplicationResume);

module.exports = router;
