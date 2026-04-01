const express = require("express");
const router = express.Router();
const {
  listCandidates,
  getCandidateDetail,
  getOpeningApplicants,
  updateCustomQuestions,
} = require("../controllers/recruiterCandidateController");

// ── Middleware: Service authentication ──────────────────────────
// These endpoints are called by Zinterview-backend, not by end users.
// Use HMAC signature verification or service JWT.

const verifyServiceAuth = (req, res, next) => {
  const serviceKey = req.headers["x-service-key"];
  const expectedKey = process.env.ZINTERVIEW_SERVICE_KEY;

  if (!expectedKey) {
    // If no key configured, allow (dev mode)
    console.warn("[RecruiterAPI] No ZINTERVIEW_SERVICE_KEY configured, allowing request");
    return next();
  }

  if (serviceKey !== expectedKey) {
    return res.status(401).json({ success: false, error: "Unauthorized service request" });
  }

  next();
};

// ── Routes ──────────────────────────────────────────────────────

// Global Candidate Pool
router.get("/candidates", verifyServiceAuth, listCandidates);
router.get("/candidates/:userId", verifyServiceAuth, getCandidateDetail);

// Per-Opening MockMate Tab
router.get("/opening/:openingId/applicants", verifyServiceAuth, getOpeningApplicants);
router.put("/opening/:openingId/custom-questions", verifyServiceAuth, updateCustomQuestions);

module.exports = router;
