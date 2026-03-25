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
 *
 * Query params:
 * - cursor: cursor for pagination
 * - limit: page size (default 20, max 50)
 * - search: comma-separated multi-keyword search
 * - minExp / maxExp: experience range filter
 * - singleExp: single experience value (find overlapping openings)
 * - location: location text filter
 * - organisation: organisation name filter (exact match from dropdown)
 * - jobType: job type filter (Full-Time, Part-Time, Contract, etc.)
 * - applied: "true" to show only applied jobs
 * - needsInterview: "true" to show jobs needing interview
 * - interviewInProgress: "true" to show jobs with interview in progress
 * - interviewCompleted: "true" to show jobs with completed interviews
 * - sort: "newest" (default) or "oldest"
 */
const getJobOpenings = async (req, res) => {
  try {
    const {
      cursor,
      limit = 20,
      search,
      minExp,
      maxExp,
      singleExp,
      location,
      organisation,
      jobType,
      applied,
      needsInterview,
      interviewInProgress,
      interviewCompleted,
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
      if (sort === "oldest") {
        query._id = { $gt: cursor };
      } else {
        query._id = { $lt: cursor };
      }
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
            { description: { $regex: term, $options: "i" } },
          ],
        }));
        if (!query.$and) query.$and = [];
        query.$and.push(...regexConditions);
      }
    }

    // Experience filter — range mode
    if (singleExp) {
      // Single value: find openings that overlap with this single value
      const expVal = parseFloat(singleExp);
      if (!isNaN(expVal)) {
        if (!query.$and) query.$and = [];
        query.$and.push({
          $or: [
            // Opening range overlaps with the single value
            {
              minExperience: { $lte: expVal },
              $or: [
                { maxExperience: { $gte: expVal } },
                { maxExperience: null },
              ],
            },
            // Opening has only experience field
            { experience: { $lte: expVal } },
          ],
        });
      }
    } else if (minExp || maxExp) {
      const minVal = parseFloat(minExp);
      const maxVal = parseFloat(maxExp);
      const expFilter = {};

      if (!isNaN(minVal) && !isNaN(maxVal)) {
        // Range: find openings that overlap with [minVal, maxVal]
        if (!query.$and) query.$and = [];
        query.$and.push({
          $or: [
            {
              minExperience: { $lte: maxVal },
              $or: [
                { maxExperience: { $gte: minVal } },
                { maxExperience: null },
              ],
            },
            {
              experience: { $gte: minVal, $lte: maxVal },
            },
          ],
        });
      } else if (!isNaN(minVal)) {
        if (!query.$and) query.$and = [];
        query.$and.push({
          $or: [
            { maxExperience: { $gte: minVal } },
            { maxExperience: null, minExperience: { $lte: minVal } },
            { experience: { $gte: minVal } },
          ],
        });
      } else if (!isNaN(maxVal)) {
        query.minExperience = { $lte: maxVal };
      }
    }

    // Location filter
    if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    // Organisation filter
    if (organisation) {
      query.orgName = organisation; // Exact match from dropdown
    }

    // Job type filter
    if (jobType) {
      query.jobType = { $regex: `^${jobType}$`, $options: "i" };
    }

    // ── Application-status-based filters ──
    // These require cross-referencing the job_applications collection
    const userId = req.user?._id;
    let applicationFilterIds = null;

    if (userId && (applied === "true" || needsInterview === "true" || interviewInProgress === "true" || interviewCompleted === "true")) {
      const appQuery = { candidateId: userId };
      const statusConditions = [];

      if (applied === "true") {
        // Any application exists — no status filter needed
      }
      if (needsInterview === "true") {
        statusConditions.push("APPROVED", "INTERVIEW_SCHEDULED");
      }
      if (interviewInProgress === "true") {
        statusConditions.push("INTERVIEW_IN_PROGRESS");
      }
      if (interviewCompleted === "true") {
        statusConditions.push("INTERVIEW_COMPLETED");
      }

      if (statusConditions.length > 0) {
        appQuery.status = { $in: statusConditions };
      }

      const matchingApps = await JobApplication.find(appQuery)
        .select("openingId")
        .lean();

      applicationFilterIds = matchingApps.map((a) => a.openingId);
      query._id = { ...query._id, $in: applicationFilterIds };
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

    // Attach application status for the current user (batch query)
    if (userId && results.length > 0) {
      const openingIds = results.map((r) => r._id);
      const applications = await JobApplication.find({
        candidateId: userId,
        openingId: { $in: openingIds },
      })
        .select("openingId status")
        .lean();

      const appMap = {};
      applications.forEach((app) => {
        appMap[app.openingId.toString()] = app.status;
      });

      results.forEach((r) => {
        r.applicationStatus = appMap[r._id.toString()] || null;
      });
    }

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
 * GET /api/jobs/meta/organisations
 * Returns distinct organisation names from enabled job openings.
 */
const getOrganisations = async (req, res) => {
  try {
    const orgs = await JobOpening.distinct("orgName", {
      isEnabled: true,
      status: true,
      orgName: { $ne: "" },
    });

    res.status(200).json({
      success: true,
      data: orgs.sort(),
    });
  } catch (error) {
    console.error("Error fetching organisations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch organisations",
    });
  }
};

/**
 * GET /api/jobs/meta/locations
 * Returns distinct location values from enabled job openings.
 */
const getLocations = async (req, res) => {
  try {
    const locations = await JobOpening.distinct("location", {
      isEnabled: true,
      status: true,
      location: { $ne: "" },
    });

    res.status(200).json({
      success: true,
      data: locations.sort(),
    });
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch locations",
    });
  }
};

/**
 * GET /api/jobs/meta/job-types
 * Returns distinct job types from enabled job openings.
 */
const getJobTypes = async (req, res) => {
  try {
    const jobTypes = await JobOpening.distinct("jobType", {
      isEnabled: true,
      status: true,
      jobType: { $ne: "" },
    });

    // If no jobTypes are stored, return default list
    const defaults = ["Full-Time", "Part-Time", "Contract", "Internship", "Freelance"];
    const result = jobTypes.length > 0 ? jobTypes.sort() : defaults;

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching job types:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch job types",
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

module.exports = {
  getJobOpenings,
  getJobOpeningById,
  getApplyStatus,
  getOrganisations,
  getLocations,
  getJobTypes,
};
