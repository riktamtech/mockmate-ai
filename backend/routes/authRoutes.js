const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, googleLogin, sendOtp, verifyOtp } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.get('/me', protect, getMe);

module.exports = router;