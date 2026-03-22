const JobApplication = require("../models/JobApplication");

/**
 * Events Controller
 *
 * Handles upcoming + past events (interviews, pending actions)
 * for the candidate events page.
 */

/**
 * GET /api/events/upcoming
 * Fetch upcoming events: scheduled interviews, pending actions.
 */
const getUpcomingEvents = async (req, res) => {
  try {
    const events = await JobApplication.find({
      candidateId: req.user._id,
      status: {
        $in: [
          "APPROVED",
          "INTERVIEW_SCHEDULED",
          "INTERVIEW_IN_PROGRESS",
          "PENDING_APPROVAL",
        ],
      },
    })
      .populate("openingId", "title orgName orgLogoUrl")
      .sort({ scheduledAt: 1, appliedAt: -1 })
      .limit(50)
      .lean();

    const transformed = events.map((app) => ({
      id: app._id,
      type:
        app.status === "INTERVIEW_SCHEDULED"
          ? "INTERVIEW"
          : app.status === "PENDING_APPROVAL"
            ? "PENDING_ACTION"
            : "ACTIVE",
      title: app.openingId?.title || "Unknown Opening",
      orgName: app.openingId?.orgName || "",
      orgLogoUrl: app.openingId?.orgLogoUrl || "",
      status: app.status,
      scheduledAt: app.scheduledAt,
      appliedAt: app.appliedAt,
      fitnessScore: app.fitnessScore,
      openingId: app.openingId?._id,
    }));

    res.status(200).json({ success: true, data: transformed });
  } catch (error) {
    console.error("Error fetching upcoming events:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * GET /api/events/past
 * Fetch past events: completed interviews, rejected applications.
 */
const getPastEvents = async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const pageLimit = Math.min(parseInt(limit) || 20, 50);

    const query = {
      candidateId: req.user._id,
      status: {
        $in: [
          "INTERVIEW_COMPLETED",
          "REJECTED",
          "WITHDRAWN",
          "OPENING_CLOSED",
        ],
      },
    };
    if (cursor) query._id = { $lt: cursor };

    const events = await JobApplication.find(query)
      .populate("openingId", "title orgName orgLogoUrl")
      .sort({ updatedAt: -1 })
      .limit(pageLimit + 1)
      .lean();

    const hasMore = events.length > pageLimit;
    const results = hasMore ? events.slice(0, pageLimit) : events;
    const nextCursor =
      hasMore && results.length > 0
        ? results[results.length - 1]._id
        : null;

    const transformed = results.map((app) => ({
      id: app._id,
      type: "PAST",
      title: app.openingId?.title || "Unknown Opening",
      orgName: app.openingId?.orgName || "",
      status: app.status,
      scheduledAt: app.scheduledAt,
      appliedAt: app.appliedAt,
      fitnessScore: app.fitnessScore,
      openingId: app.openingId?._id,
    }));

    res.status(200).json({
      success: true,
      data: transformed,
      meta: { count: transformed.length, hasMore, nextCursor },
    });
  } catch (error) {
    console.error("Error fetching past events:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = { getUpcomingEvents, getPastEvents };
