const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, admin } = require('../middleware/authMiddleware');
const {
  uploadAudioRecording,
  getAudioPlaybackUrl,
  getInterviewAudioRecordings,
  deleteAudioRecording
} = require('../controllers/audioController');

// Configure multer for memory storage (buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// User routes
router.post('/upload', protect, upload.single('audio'), uploadAudioRecording);
router.get('/:interviewId/:recordingId', protect, getAudioPlaybackUrl);

// Admin routes
router.get('/interview/:interviewId', protect, admin, getInterviewAudioRecordings);
router.delete('/:interviewId/:recordingId', protect, admin, deleteAudioRecording);

module.exports = router;
