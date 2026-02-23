const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");
const {
  getStats,
  getUsers,
  getUserDetails,
  getAllInterviews,
  getInterviewDetails,
  getUserGrowth,
  transcribeInterviewAudio,
  proxyAudioStream,
  generateTtsForHistory,
} = require("../controllers/adminController");

router.use(protect);
router.use(admin);

router.route("/stats").get(getStats);
router.route("/user-growth").get(getUserGrowth);
router.route("/users").get(getUsers);
router.route("/users/:id").get(getUserDetails);
router.route("/interviews").get(getAllInterviews);
router.route("/interviews/:id").get(getInterviewDetails);
router.route("/interviews/:id/transcribe").post(transcribeInterviewAudio);
router.route("/interviews/:id/tts-fallback").post(generateTtsForHistory);
router.route("/interviews/:id/audio/:questionIndex").get(proxyAudioStream);

module.exports = router;
