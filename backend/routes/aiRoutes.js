const express = require('express');
const router = express.Router();
const { chatStream, generateFeedback, generateSpeech, analyzeResume } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

// Public or Protected? Protected usually, but for demo we can leave public or wrap with protect.
// For security, strictly speaking, should be protected.
router.post('/chat', protect, chatStream);
router.post('/feedback', protect, generateFeedback);
router.post('/tts', protect, generateSpeech);
router.post('/analyze-resume', protect, analyzeResume);

module.exports = router;