const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getUserAnalyticsSummary,
  getAdminAnalytics,
} = require("../controllers/analyticsController");

const router = express.Router();

router.get("/summary", protect, getUserAnalyticsSummary);
router.get("/admin", protect, getAdminAnalytics);

module.exports = router;
