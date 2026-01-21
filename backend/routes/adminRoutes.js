const express = require('express');
const router = express.Router();
const { 
  getDashboardStats, 
  getAllUsers, 
  getInterviewDetails, 
  getAllInterviews 
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/stats', protect, admin, getDashboardStats);
router.get('/users', protect, admin, getAllUsers);
router.get('/interviews', protect, admin, getAllInterviews);
router.get('/interviews/:interviewId', protect, admin, getInterviewDetails);

module.exports = router;