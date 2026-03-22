const JobOpening = require("../models/JobOpening");
const JobApplication = require("../models/JobApplication");

/**
 * Job Openings Controller
 *
 * Handles fetching job openings for the candidate-facing
 * job portal with cursor-based pagination, search, and filters.
 */

/**
 * GET /api/jobs
 * Fetch enabled job openings with pagination, search, and filters.
 */
const getJobOpenings = async (req, res) => {
  try {
    const {
      cursor,
      limit = 20,
      search,
      experience,
      location,
      organisation,
      sort = "newest",
    } = req.query;

    const pageLimit = Math.min(parseInt(limit) || 20, 50);

    // Base query: only enabled, non-coding-round, active openings
    const query = {
      isEnabled: true,
      status: true,
      interviewMode: { $ne: "CODING_ROUND" },
    };

    // Cursor-based pagination
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // Multi-keyword search (comma-separated)
    if (search) {
      const terms = search
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (terms.length > 0) {
        const regexConditions = terms.map((term) => ({
          $or: [
            { title: { $regex: term, $options: "i" } },
            { orgName: { $regex: term, $options: "i" } },
            { coreSkills: { $regex: term, $options: "i" } },
          ],
        }));
        query.$and = regexConditions;
      }
    }

    // Experience filter
    if (experience) {
      const [min, max] = experience.split("-").map(Number);
      if (!isNaN(min)) {
        query.minExperience = { $lte: max || 100 };
      }
    }

    // Location filter
    if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    // Organisation filter
    if (organisation) {
      query.orgName = { $regex: organisation, $options: "i" };
    }

    const sortOrder = sort === "oldest" ? { _id: 1 } : { _id: -1 };

    const openings = await JobOpening.find(query)
      .sort(sortOrder)
      .limit(pageLimit + 1)
      .lean();

    const hasMore = openings.length > pageLimit;
    const results = hasMore ? openings.slice(0, pageLimit) : openings;
    const nextCursor =
      hasMore && results.length > 0
        ? results[results.length - 1]._id
        : null;

    res.status(200).json({
      success: true,
      data: results,
      meta: {
        count: results.length,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("Error fetching job openings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch job openings",
    });
  }
};

/**
 * GET /api/jobs/:id
 * Get a single job opening by ID.
 */
const getJobOpeningById = async (req, res) => {
  try {
    const { id } = req.params;

    const opening = await JobOpening.findById(id).lean();

    if (!opening) {
      return res.status(404).json({
        success: false,
        error: "Job opening not found",
      });
    }

    // Get application status for the requesting user if authenticated
    let applicationStatus = null;
    if (req.user) {
      const application = await JobApplication.findOne({
        candidateId: req.user._id,
        openingId: id,
      })
        .select("status fitnessScore fitnessLabel appliedAt scheduledAt lifecycleHistory")
        .lean();
      applicationStatus = application || null;
    }

    res.status(200).json({
      success: true,
      data: {
        ...opening,
        applicationStatus,
      },
    });
  } catch (error) {
    console.error("Error fetching job opening:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch job opening",
    });
  }
};

/**
 * GET /api/jobs/:id/apply-status
 * Check if the user has already applied to this job.
 */
const getApplyStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const application = await JobApplication.findOne({
      candidateId: req.user._id,
      openingId: id,
    })
      .select(
        "status fitnessScore fitnessLabel appliedAt scheduledAt " +
        "interviewReportId lifecycleHistory",
      )
      .lean();

    res.status(200).json({
      success: true,
      data: application || null,
    });
  } catch (error) {
    console.error("Error checking apply status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check apply status",
    });
  }
};

module.exports = { getJobOpenings, getJobOpeningById, getApplyStatus };
