const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getUpcomingEvents,
  getPastEvents,
} = require("../controllers/eventsController");

const router = express.Router();

router.get("/upcoming", protect, getUpcomingEvents);
router.get("/past", protect, getPastEvents);

module.exports = router;
