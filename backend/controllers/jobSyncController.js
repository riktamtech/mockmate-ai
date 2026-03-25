const JobOpening = require("../models/JobOpening");

/**
 * Job Sync Controller
 *
 * Handles webhook/API endpoints that Zinterview-backend calls
 * to push sync events for job openings.
 */

/**
 * POST /api/jobs/sync
 * Upsert a job opening from Zinterview.
 * Actions: ENABLE, UPDATE_CONFIG
 */
const syncJobOpening = async (req, res) => {
  try {
    const { action, opening } = req.body;

    if (!action || !opening?.zinterviewOpeningId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: action, opening.zinterviewOpeningId",
      });
    }

    if (action === "ENABLE") {
      // Upsert: create or re-enable
      const result = await JobOpening.findOneAndUpdate(
        { zinterviewOpeningId: opening.zinterviewOpeningId },
        {
          $set: {
            organizationId: opening.organizationId,
            orgName: opening.orgName || "",
            orgLogoUrl: opening.orgLogoUrl || "",
            title: opening.title,
            description: opening.description || "",
            coreSkills: opening.coreSkills || [],
            skillsGroup: opening.skillsGroup || [],
            jobRequirementsAndResponsibilities:
              opening.jobRequirementsAndResponsibilities || [],
            experience: opening.experience || 0,
            minExperience: opening.minExperience || 0,
            maxExperience: opening.maxExperience || null,
            interviewMode: opening.interviewMode || "TRADITIONAL",
            maxQuestions: opening.maxQuestions || 15,
            languageOfQuestions: opening.languageOfQuestions || "en",
            status: opening.status !== false,
            isEnabled: true,
            source: "zinterview",
            syncedAt: new Date(),
            // Clear cached JD so it's regenerated on next fitness calculation
            formattedJobDescription: "",
            jdContentHash: "",
            mockmateConfig: {
              fitnessThreshold:
                opening.mockmateConfig?.fitnessThreshold || 0,
              schedulingMode:
                opening.mockmateConfig?.schedulingMode || "ANYTIME",
              approvalRequired:
                opening.mockmateConfig?.approvalRequired || false,
            },
          },
        },
        { upsert: true, new: true },
      );

      return res.status(200).json({
        success: true,
        data: { id: result._id },
        message: "Job opening synced successfully",
      });
    }

    if (action === "UPDATE_CONFIG") {
      const result = await JobOpening.findOneAndUpdate(
        { zinterviewOpeningId: opening.zinterviewOpeningId },
        {
          $set: {
            "mockmateConfig.fitnessThreshold":
              opening.mockmateConfig?.fitnessThreshold,
            "mockmateConfig.schedulingMode":
              opening.mockmateConfig?.schedulingMode,
            "mockmateConfig.approvalRequired":
              opening.mockmateConfig?.approvalRequired,
            syncedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          error: "Job opening not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: { id: result._id },
        message: "Config updated successfully",
      });
    }

    return res.status(400).json({
      success: false,
      error: `Unknown action: ${action}`,
    });
  } catch (error) {
    console.error("Error syncing job opening:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

/**
 * POST /api/jobs/sync/disable
 * Disable a job opening in Mockmate.
 */
const disableJobOpening = async (req, res) => {
  try {
    const { zinterviewOpeningId } = req.body;

    if (!zinterviewOpeningId) {
      return res.status(400).json({
        success: false,
        error: "Missing zinterviewOpeningId",
      });
    }

    const result = await JobOpening.findOneAndUpdate(
      { zinterviewOpeningId },
      { $set: { isEnabled: false, syncedAt: new Date() } },
      { new: true },
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Job opening not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Job opening disabled",
    });
  } catch (error) {
    console.error("Error disabling job opening:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

module.exports = { syncJobOpening, disableJobOpening };
