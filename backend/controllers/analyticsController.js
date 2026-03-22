const JobApplication = require("../models/JobApplication");
const JobAnalyticsSnapshot = require("../models/JobAnalyticsSnapshot");

/**
 * Analytics Controller
 *
 * Handles aggregate analytics queries for the candidate
 * and admin job analytics dashboards.
 */

/**
 * GET /api/analytics/summary
 * Get candidates analytics summary.
 */
const getUserAnalyticsSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    // Aggregate application stats
    const [stats] = await JobApplication.aggregate([
      { $match: { candidateId: userId } },
      {
        $group: {
          _id: null,
          totalApplications: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] },
          },
          interviewsScheduled: {
            $sum: {
              $cond: [{ $eq: ["$status", "INTERVIEW_SCHEDULED"] }, 1, 0],
            },
          },
          interviewsCompleted: {
            $sum: {
              $cond: [{ $eq: ["$status", "INTERVIEW_COMPLETED"] }, 1, 0],
            },
          },
          pendingApproval: {
            $sum: {
              $cond: [{ $eq: ["$status", "PENDING_APPROVAL"] }, 1, 0],
            },
          },
          avgFitnessScore: { $avg: "$fitnessScore" },
        },
      },
    ]);

    const summary = stats || {
      totalApplications: 0,
      approved: 0,
      rejected: 0,
      interviewsScheduled: 0,
      interviewsCompleted: 0,
      pendingApproval: 0,
      avgFitnessScore: 0,
    };

    // Status distribution for chart
    const statusDistribution = await JobApplication.aggregate([
      { $match: { candidateId: userId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Weekly activity (last 8 weeks)
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const weeklyActivity = await JobApplication.aggregate([
      {
        $match: {
          candidateId: userId,
          appliedAt: { $gte: eightWeeksAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-W%V", date: "$appliedAt" },
          },
          applications: { $sum: 1 },
          avgScore: { $avg: "$fitnessScore" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fitness score histogram
    const fitnessHistogram = await JobApplication.aggregate([
      {
        $match: {
          candidateId: userId,
          fitnessScore: { $ne: null },
        },
      },
      {
        $bucket: {
          groupBy: "$fitnessScore",
          boundaries: [0, 20, 40, 60, 80, 100],
          default: 100,
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary,
        statusDistribution,
        weeklyActivity,
        fitnessHistogram,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * GET /api/analytics/admin
 * Admin aggregate analytics across all users.
 */
const getAdminAnalytics = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const [globalStats] = await JobApplication.aggregate([
      {
        $group: {
          _id: null,
          totalApplications: { $sum: 1 },
          uniqueCandidates: { $addToSet: "$candidateId" },
          uniqueOpenings: { $addToSet: "$openingId" },
          avgFitnessScore: { $avg: "$fitnessScore" },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "INTERVIEW_COMPLETED"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          totalApplications: 1,
          uniqueCandidates: { $size: "$uniqueCandidates" },
          uniqueOpenings: { $size: "$uniqueOpenings" },
          avgFitnessScore: { $round: ["$avgFitnessScore", 1] },
          approved: 1,
          rejected: 1,
          completed: 1,
        },
      },
    ]);

    // Top openings by application count
    const topOpenings = await JobApplication.aggregate([
      { $group: { _id: "$openingId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "job_openings",
          localField: "_id",
          foreignField: "_id",
          as: "opening",
        },
      },
      { $unwind: { path: "$opening", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          count: 1,
          title: "$opening.title",
          orgName: "$opening.orgName",
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        globalStats: globalStats || {},
        topOpenings,
      },
    });
  } catch (error) {
    console.error("Error fetching admin analytics:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = { getUserAnalyticsSummary, getAdminAnalytics };
