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
  getOrganisations,
  getLocations,
  getJobTypes,
} = require("../controllers/jobOpeningsController");
const {
  getCountries,
  getStates,
  getCities,
} = require("../controllers/locationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// ── Cross-server sync endpoints (from Zinterview-backend) ─────
router.post("/sync", verifyCrossServerAuth, syncJobOpening);
router.post("/sync/disable", verifyCrossServerAuth, disableJobOpening);

// ── Meta / lookup endpoints (MUST be before /:id routes) ──────
router.get("/meta/organisations", protect, getOrganisations);
router.get("/meta/locations", protect, getLocations);
router.get("/meta/job-types", protect, getJobTypes);
router.get("/meta/countries", protect, getCountries);
router.get("/meta/states", protect, getStates);
router.get("/meta/cities", protect, getCities);

// ── Candidate-facing job listing endpoints ────────────────────
router.get("/", protect, getJobOpenings);
router.get("/:id", protect, getJobOpeningById);
router.get("/:id/apply-status", protect, getApplyStatus);

module.exports = router;
