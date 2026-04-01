const JobApplication = require("../models/JobApplication");
const JobOpening = require("../models/JobOpening");
const CandidateProfile = require("../models/CandidateProfile");
const CandidateResume = require("../models/CandidateResume");
const User = require("../models/User");
const {
  calculateFitnessScore,
  getStoredFitnessScore,
  generateResumeSummary,
} = require("../services/fitnessScoreService");
const ZinterviewService = require("../services/zinterviewService");
const { seedFromResume: seedCentralisedResume } = require("../services/centralisedResumeService");
const { uploadFile } = require("../services/s3Service");
const {
  compressText,
  decompressText,
} = require("../services/compressionUtils");
const { GoogleGenAI } = require("@google/genai");
const { v4: uuidv4 } = require("uuid");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
});

/**
 * Job Application Controller
 *
 * Handles the complete application lifecycle:
 *   submitFullApplication → fitness evaluation → finalizeApplication → candidate registration
 */

// ── POST /api/applications/submit-full ──────────────────────────

/**
 * Phase 1: Submit application form + calculate fitness score.
 *
 * Body: {
 *   openingId,
 *   resumeText,
 *   resumeId?,
 *   candidateDetails: { firstName, lastName, preferredName, email, phone, experience, country },
 *   saveDetails?: boolean
 * }
 *
 * Returns fitness score result for frontend display before finalisation.
 */
const submitFullApplication = async (req, res) => {
  try {
    const candidateId = req.user._id;
    const {
      openingId,
      resumeText,
      resumeId,
      candidateDetails,
      saveDetails,
      resumeS3Key,
    } = req.body;

    // Validate required fields
    if (
      !openingId ||
      (!resumeText && !resumeId && !resumeS3Key) ||
      !candidateDetails
    ) {
      return res.status(400).json({
        success: false,
        error: "openingId, resume, and candidateDetails are required",
      });
    }

    let finalResumeText = resumeText;

    if (!finalResumeText && (resumeId || resumeS3Key)) {
      const resumeKeyToMatch = resumeId || resumeS3Key;
      const candidateResume = await CandidateResume.findOne({
        userId: candidateId,
      }).select("+resumes.extractedText");

      let matchedResume = null;
      if (candidateResume) {
        matchedResume = candidateResume.resumes.find(
          (r) =>
            r.resumeKey === resumeKeyToMatch ||
            r._id.toString() === resumeKeyToMatch,
        );
      }

      if (matchedResume && matchedResume.extractedText) {
        finalResumeText = decompressText(matchedResume.extractedText);
      } else if (resumeKeyToMatch) {
        // Fallback: If not found in cache (e.g. synthetic resume from User), extract on-the-fly
        try {
          console.log(
            `Extracting text on-the-fly for S3 Key: ${resumeKeyToMatch}`,
          );
          const { getAudioBuffer } = require("../services/s3Service");
          const fileBuffer = await getAudioBuffer(resumeKeyToMatch);

          if (fileBuffer) {
            const base64Data = fileBuffer.toString("base64");
            const mimeType = resumeKeyToMatch.toLowerCase().endsWith(".pdf")
              ? "application/pdf"
              : "application/octet-stream";

            const result = await ai.models.generateContent({
              model: "gemini-2.0-flash",
              contents: [
                {
                  role: "user",
                  parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    {
                      text: "Extract ALL text content from this document exactly as it appears. Preserve the structure and formatting as much as possible. Return ONLY the raw text content — no markdown formatting, no explanations, no headers. Just the text.",
                    },
                  ],
                },
              ],
              config: { temperature: 0.1, maxOutputTokens: 8192 },
            });
            finalResumeText = result?.text?.trim() || "";

            // Cache it back to CandidateResume to avoid 10s delay on repeat applications
            if (finalResumeText) {
              const User = require("../models/User");
              const userRec = await User.findById(candidateId).lean();
              const newResumeEntry = {
                resumeKey: resumeKeyToMatch,
                fileName: userRec?.resumeFileName || "Primary Resume",
                uploadedAt: userRec?.createdAt || new Date(),
                lastUsedAt: new Date(),
                extractedText: compressText(finalResumeText),
              };

              if (candidateResume) {
                candidateResume.resumes.push(newResumeEntry);
                await candidateResume.save();
              } else {
                await CandidateResume.create({
                  userId: candidateId,
                  resumes: [newResumeEntry],
                });
              }
            }
          }
        } catch (extractErr) {
          console.error(
            "On-the-fly text extraction failed:",
            extractErr.message,
          );
        }
      }
    }

    if (!finalResumeText) {
      return res.status(400).json({
        success: false,
        error: "Could not extract resume text. Please upload a valid resume.",
      });
    }

    // Check if opening exists and is active
    const opening = await JobOpening.findById(openingId).lean();
    if (!opening) {
      return res.status(404).json({
        success: false,
        error: "Job opening not found",
      });
    }
    if (!opening.isEnabled || !opening.status) {
      return res.status(400).json({
        success: false,
        error: "This job opening is no longer accepting applications",
      });
    }

    // Check for existing application
    const existing = await JobApplication.findOne({
      candidateId,
      openingId,
    }).lean();

    if (existing) {
      // Return existing score if already applied
      const storedScore = await getStoredFitnessScore(candidateId, openingId);
      return res.status(200).json({
        success: true,
        alreadyApplied: true,
        data: {
          applicationId: existing._id,
          status: existing.status,
          fitnessScore: storedScore,
        },
      });
    }

    // Save candidate profile if requested
    if (saveDetails && candidateDetails) {
      await CandidateProfile.findOneAndUpdate(
        { userId: candidateId },
        {
          userId: candidateId,
          firstName: candidateDetails.firstName || "",
          lastName: candidateDetails.lastName || "",
          preferredName: candidateDetails.preferredName || "",
          name: `${candidateDetails.firstName || ""} ${candidateDetails.lastName || ""}`.trim(),
          email: candidateDetails.email || req.user.email,
          phone: candidateDetails.phone || "",
          country: candidateDetails.country || "",
          experience: Number(candidateDetails.experience) || 0,
          savedDetails: true,
        },
        { upsert: true, new: true },
      );
    }

    // Calculate fitness score via RAG pipeline
    const fitnessResult = await calculateFitnessScore(
      finalResumeText,
      opening,
      candidateId,
      resumeId || null,
    );

    res.status(200).json({
      success: true,
      alreadyApplied: false,
      data: {
        fitnessScore: {
          score: fitnessResult.score,
          candidateFitRating: fitnessResult.candidateFitRating,
          fitnessLabel: fitnessResult.fitnessLabel,
          justification: fitnessResult.justification,
          breakdown: fitnessResult.breakdown,
          cached: fitnessResult.cached,
        },
        opening: {
          _id: opening._id,
          title: opening.title,
          orgName: opening.orgName,
          mockmateConfig: opening.mockmateConfig,
        },
      },
    });
  } catch (error) {
    console.error("submitFullApplication error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process application",
    });
  }
};

// ── POST /api/applications/finalize ─────────────────────────────

/**
 * Phase 2: After user reviews fitness score and proceeds.
 *
 * Body: {
 *   openingId,
 *   candidateDetails: { firstName, lastName, preferredName, email, phone, experience, country },
 *   resumeId?,
 *   resumeS3Key?,
 *   scheduledAt? (ISO string, for TIMEFRAME mode),
 * }
 *
 * Steps:
 *  1. Validate fitness threshold
 *  2. Create JobApplication record with fitness data
 *  3. Register candidate on Zinterview backend
 *  4. Return scheduling mode + interview URL (if applicable)
 */
const finalizeApplication = async (req, res) => {
  try {
    const candidateId = req.user._id;
    const { openingId, candidateDetails, resumeId, resumeS3Key, scheduledAt } =
      req.body;

    if (!openingId || !candidateDetails) {
      return res.status(400).json({
        success: false,
        error: "openingId and candidateDetails are required",
      });
    }

    const opening = await JobOpening.findById(openingId).lean();
    if (!opening) {
      return res.status(404).json({
        success: false,
        error: "Job opening not found",
      });
    }

    // Prevent duplicate submissions
    const existing = await JobApplication.findOne({
      candidateId,
      openingId,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "You have already applied to this position",
        data: { applicationId: existing._id, status: existing.status },
      });
    }

    // Retrieve stored fitness score
    const storedScore = await getStoredFitnessScore(candidateId, openingId);
    const fitnessScore = storedScore?.score ?? null;
    const fitnessLabel = storedScore?.fitnessLabel ?? null;
    const fitnessBreakdown = storedScore?.breakdown ?? null;
    const candidateFitRating = storedScore?.candidateFitRating ?? null;

    // Check fitness threshold (if configured by org)
    const threshold = opening.mockmateConfig?.fitnessThreshold || 0;
    if (threshold > 0 && fitnessScore !== null && fitnessScore < threshold) {
      return res.status(200).json({
        success: false,
        validationFailed: true,
        error: `Your fitness score (${fitnessScore}) is below the minimum threshold (${threshold}) for this position.`,
        data: {
          score: fitnessScore,
          threshold,
          fitnessLabel,
        },
      });
    }

    // Determine scheduling mode
    const schedulingMode = opening.mockmateConfig?.schedulingMode || "ANYTIME";
    const approvalRequired = opening.mockmateConfig?.approvalRequired || false;

    // Initial status depends on approval config
    const initialStatus = approvalRequired ? "PENDING_APPROVAL" : "APPROVED";

    // Create JobApplication
    const application = new JobApplication({
      candidateId,
      openingId,
      zinterviewOpeningId: opening.zinterviewOpeningId || "",
      status: initialStatus,
      fitnessScore,
      fitnessLabel,
      fitnessBreakdown,
      resumeId: resumeId || null,
      resumeS3Key: resumeS3Key || null,
      candidateDetails: {
        name: `${candidateDetails.firstName || ""} ${candidateDetails.lastName || ""}`.trim(),
        email: candidateDetails.email || "",
        phone: candidateDetails.phone || "",
        experience: Number(candidateDetails.experience) || 0,
        country: candidateDetails.country || "",
      },
      schedulingMode,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      appliedAt: new Date(),
    });

    // Add initial lifecycle entry
    application.addLifecycleEntry("APPLIED", {
      fitnessScore,
      fitnessLabel,
      candidateFitRating,
    });

    if (fitnessScore !== null) {
      application.addLifecycleEntry("FITNESS_EVALUATED", {
        score: fitnessScore,
        label: fitnessLabel,
      });
    }

    if (!approvalRequired) {
      application.addLifecycleEntry("APPROVED", {
        autoApproved: true,
        schedulingMode,
      });
    }

    await application.save();

    // Increment application count on the opening
    await JobOpening.findByIdAndUpdate(openingId, {
      $inc: { totalApplications: 1 },
    });

    // Register candidate on Zinterview backend
    let interviewUrl = null;
    let interviewReportId = null;

    try {
      const ziResult = await ZinterviewService.createCandidate({
        openingId: opening.zinterviewOpeningId,
        firstName: candidateDetails.firstName || "",
        lastName: candidateDetails.lastName || "",
        email: candidateDetails.email || "",
        preferredName:
          candidateDetails.preferredName || candidateDetails.firstName || "",
        phoneNumber: candidateDetails.phone || "",
        experience: String(candidateDetails.experience || 0),
      });

      // Extract interview report ID from Zinterview response
      if (ziResult?.data || ziResult?.interviewReportId || ziResult?._id) {
        interviewReportId =
          ziResult.data || ziResult.interviewReportId || ziResult._id;
        application.interviewReportId = interviewReportId;
        application.addLifecycleEntry("CANDIDATE_REGISTERED", {
          interviewReportId,
          zinterviewOpeningId: opening.zinterviewOpeningId,
        });
        await application.save();

        // Build interview URL for IMMEDIATE or ANYTIME modes
        if (schedulingMode === "IMMEDIATE" || schedulingMode === "ANYTIME") {
          interviewUrl = ZinterviewService.buildInterviewUrl(
            opening.zinterviewOpeningId,
            interviewReportId,
            null,
          );
        }
      }
    } catch (ziError) {
      console.error(
        "Zinterview candidate registration failed:",
        ziError.message,
      );
      // Non-fatal: application is still created, candidate can be registered later
      application.addLifecycleEntry("REGISTRATION_FAILED", {
        error: ziError.message,
      });
      await application.save();
    }

    // Handle scheduling for TIMEFRAME mode
    if (schedulingMode === "TIMEFRAME" && scheduledAt && interviewReportId) {
      try {
        await ZinterviewService.scheduleCandidates({
          openingId: opening.zinterviewOpeningId,
          selectedCandidateIds: [interviewReportId],
          schedule: scheduledAt,
          interviewBaseUrl: ZinterviewService.buildInterviewUrl(
            opening.zinterviewOpeningId,
            interviewReportId,
            null,
          ),
        });
        application.status = "INTERVIEW_SCHEDULED";
        application.scheduledAt = new Date(scheduledAt);
        application.addLifecycleEntry("INTERVIEW_SCHEDULED", {
          scheduledAt,
        });
        await application.save();
      } catch (schedError) {
        console.error("Scheduling failed:", schedError.message);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        applicationId: application._id,
        status: application.status,
        schedulingMode,
        interviewUrl,
        interviewReportId,
        approvalRequired,
        fitnessScore,
        fitnessLabel,
      },
    });
  } catch (error) {
    console.error("finalizeApplication error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to finalize application",
    });
  }
};

// ── Existing endpoints (kept) ────────────────────────────────────

/**
 * POST /api/applications/submit
 * Legacy submit endpoint (kept for backward compatibility).
 */
const submitApplication = async (req, res) => {
  try {
    const candidateId = req.user._id;
    const { openingId, candidateDetails, resumeId } = req.body;

    if (!openingId) {
      return res.status(400).json({
        success: false,
        error: "openingId is required",
      });
    }

    const opening = await JobOpening.findById(openingId).lean();
    if (!opening) {
      return res.status(404).json({
        success: false,
        error: "Job opening not found",
      });
    }

    const existing = await JobApplication.findOne({
      candidateId,
      openingId,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Already applied",
      });
    }

    const application = new JobApplication({
      candidateId,
      openingId,
      zinterviewOpeningId: opening.zinterviewOpeningId || "",
      candidateDetails: candidateDetails || {},
      resumeId: resumeId || null,
    });

    application.addLifecycleEntry("APPLIED");
    await application.save();

    await JobOpening.findByIdAndUpdate(openingId, {
      $inc: { totalApplications: 1 },
    });

    res.status(201).json({
      success: true,
      data: application,
    });
  } catch (error) {
    console.error("submitApplication error:", error);
    res.status(500).json({ success: false, error: "Failed to submit" });
  }
};

/**
 * GET /api/applications/mine
 */
const getMyApplications = async (req, res) => {
  try {
    const candidateId = req.user._id;
    const { cursor, limit = 20, status } = req.query;
    const pageLimit = Math.min(parseInt(limit) || 20, 50);

    const query = { candidateId };
    if (cursor) query._id = { $lt: cursor };
    if (status) query.status = status;

    const applications = await JobApplication.find(query)
      .sort({ appliedAt: -1 })
      .limit(pageLimit + 1)
      .populate("openingId", "title orgName orgLogoUrl location jobType")
      .lean();

    const hasMore = applications.length > pageLimit;
    const results = hasMore ? applications.slice(0, pageLimit) : applications;

    res.status(200).json({
      success: true,
      data: results,
      meta: {
        count: results.length,
        hasMore,
        nextCursor: hasMore ? results[results.length - 1]._id : null,
      },
    });
  } catch (error) {
    console.error("getMyApplications error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch applications" });
  }
};

/**
 * GET /api/applications/:id
 */
const getApplicationDetail = async (req, res) => {
  try {
    const application = await JobApplication.findOne({
      _id: req.params.id,
      candidateId: req.user._id,
    })
      .populate("openingId")
      .lean();

    if (!application) {
      return res
        .status(404)
        .json({ success: false, error: "Application not found" });
    }

    res.status(200).json({ success: true, data: application });
  } catch (error) {
    console.error("getApplicationDetail error:", error);
    res.status(500).json({ success: false, error: "Failed" });
  }
};

/**
 * POST /api/applications/:id/withdraw
 */
const withdrawApplication = async (req, res) => {
  try {
    const application = await JobApplication.findOne({
      _id: req.params.id,
      candidateId: req.user._id,
    });

    if (!application) {
      return res
        .status(404)
        .json({ success: false, error: "Application not found" });
    }

    if (
      ["WITHDRAWN", "INTERVIEW_COMPLETED", "REJECTED"].includes(
        application.status,
      )
    ) {
      return res.status(400).json({
        success: false,
        error: `Cannot withdraw: application is ${application.status}`,
      });
    }

    application.status = "WITHDRAWN";
    application.addLifecycleEntry("WITHDRAWN");
    await application.save();

    res.status(200).json({ success: true, data: application });
  } catch (error) {
    console.error("withdrawApplication error:", error);
    res.status(500).json({ success: false, error: "Failed to withdraw" });
  }
};

/**
 * GET /api/applications/profile/me
 * Returns candidate profile for form pre-fill + cached resumes.
 * Falls back to User model if no CandidateProfile exists yet.
 */
const getCandidateProfile = async (req, res) => {
  try {
    let profile = await CandidateProfile.findOne({
      userId: req.user._id,
    }).lean();

    let user = null;

    // Fallback: synthesize from User model when no saved CandidateProfile
    if (!profile || !profile.savedDetails) {
      user = await User.findById(req.user._id)
        .select(
          "name email phone yearsOfExperience resumeS3Key resumeFileName createdAt",
        )
        .lean();
      if (user) {
        const nameParts = (user.name || "").trim().split(/\s+/);
        profile = {
          ...(profile || {}),
          firstName: profile?.firstName || nameParts[0] || "",
          lastName: profile?.lastName || nameParts.slice(1).join(" ") || "",
          email: profile?.email || user.email || "",
          phone: profile?.phone || user.phone || "",
          experience: profile?.experience ?? user.yearsOfExperience ?? 0,
          _fromUser: true,
        };
      }
    }

    // Fetch cached resumes (exclude large fields)
    const resumeDoc = await CandidateResume.findOne({
      userId: req.user._id,
    }).lean();
    const cachedResumes = (resumeDoc?.resumes || []).map((r) => ({
      _id: r._id,
      fileName: r.fileName,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      uploadedAt: r.uploadedAt,
      lastUsedAt: r.lastUsedAt,
      resumeKey: r.resumeKey,
    }));
    let defaultResumeId = resumeDoc?.defaultResumeId || null;

    // Check user record for resume if not already fetched
    if (!user) {
      user = await User.findById(req.user._id)
        .select("resumeS3Key resumeFileName createdAt")
        .lean();
    }

    // Inject user's primary resume if it exists and isn't already cached
    if (user && user.resumeS3Key) {
      const alreadyExists = cachedResumes.some(
        (r) => r.resumeKey === user.resumeS3Key,
      );
      if (!alreadyExists) {
        const syntheticResume = {
          _id: user.resumeS3Key, // Use S3 Key as unique ID for synthetic
          fileName: user.resumeFileName || "Primary_Resume.pdf",
          mimeType: "application/pdf",
          fileSize: 0,
          uploadedAt: user.createdAt || new Date(),
          lastUsedAt: new Date(),
          resumeKey: user.resumeS3Key,
        };

        cachedResumes.unshift(syntheticResume);

        // Use as default if no default is explicitly set
        if (!defaultResumeId) {
          defaultResumeId = syntheticResume._id;
        }
      }
    }

    res.status(200).json({
      success: true,
      data: profile,
      resumes: cachedResumes,
      defaultResumeId,
    });
  } catch (error) {
    console.error("getCandidateProfile error:", error);
    res.status(500).json({ success: false, error: "Failed" });
  }
};

/**
 * PUT /api/applications/profile/me
 */
const updateCandidateProfile = async (req, res) => {
  try {
    const profileData = req.body;
    const profile = await CandidateProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        ...profileData,
      },
      { upsert: true, new: true },
    );
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error("updateCandidateProfile error:", error);
    res.status(500).json({ success: false, error: "Failed" });
  }
};

/**
 * GET /api/applications/resumes/cached
 */
const getCachedResumes = async (req, res) => {
  try {
    const resumeDoc = await CandidateResume.findOne({
      userId: req.user._id,
    }).lean();
    res.status(200).json({
      success: true,
      data: resumeDoc?.resumes || [],
    });
  } catch (error) {
    console.error("getCachedResumes error:", error);
    res.status(500).json({ success: false, error: "Failed" });
  }
};

/**
 * POST /api/applications/resumes/upload
 * Upload a resume, extract text via Gemini Vision, generate summary,
 * and save to CandidateResume LRU cache.
 */
const uploadApplicationResume = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    const userId = req.user._id;
    const file = req.file;

    // 1. Upload to S3
    const fileExtension = file.originalname.split(".").pop();
    const s3Key = `mockmate/resumes/${userId}/${uuidv4()}.${fileExtension}`;
    await uploadFile(file.buffer, s3Key, file.mimetype);

    // 2. Extract text via Gemini Vision API
    const base64Data = file.buffer.toString("base64");
    const mimeType = file.mimetype;

    let extractedText = "";
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              {
                text: `Extract ALL text content from this document exactly as it appears. Preserve the structure and formatting as much as possible. Return ONLY the raw text content — no markdown formatting, no explanations, no headers like "Here is the text". Just the text from the document.`,
              },
            ],
          },
        ],
        config: { temperature: 0.1, maxOutputTokens: 8192 },
      });
      extractedText = result?.text?.trim() || "";
    } catch (aiErr) {
      console.error("Gemini text extraction failed:", aiErr.message);
      return res.status(500).json({
        success: false,
        error: "Failed to extract text from resume",
      });
    }

    // 3. Generate resume summary in parallel (non-blocking)
    let resumeSummaryText = "";
    try {
      const { summary } = await generateResumeSummary(extractedText);
      resumeSummaryText = summary;
    } catch (summaryErr) {
      console.error(
        "Resume summary generation failed (non-fatal):",
        summaryErr.message,
      );
    }

    // 4. Save to CandidateResume LRU cache
    let resumeDoc = await CandidateResume.findOne({ userId });
    if (!resumeDoc) {
      resumeDoc = new CandidateResume({ userId, resumes: [] });
    }

    const resumeEntry = {
      resumeKey: s3Key,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedAt: new Date(),
      lastUsedAt: new Date(),
      extractedText: compressText(extractedText),
      resumeSummary: compressText(resumeSummaryText),
    };

    resumeDoc.addResume(resumeEntry);
    await resumeDoc.save();

    // Seed/update CentralisedResume with parsed resume data (non-blocking)
    const addedResume = resumeDoc.resumes[resumeDoc.resumes.length - 1];
    if (extractedText && addedResume?._id) {
      seedCentralisedResume(userId, addedResume._id, extractedText).catch((err) =>
        console.error('[CentralisedResume] Seed from uploadApplicationResume failed (non-fatal):', err.message)
      );
    }

    // Find the just-added resume entry (reuse addedResume from above)

    res.status(200).json({
      success: true,
      data: {
        resumeId: addedResume._id.toString(),
        fileName: file.originalname,
        extractedText,
        resumeS3Key: s3Key,
      },
    });
  } catch (error) {
    console.error("uploadApplicationResume error:", error);
    res.status(500).json({ success: false, error: "Failed to upload resume" });
  }
};

// ── Exports ──────────────────────────────────────────────────────

module.exports = {
  submitApplication,
  submitFullApplication,
  finalizeApplication,
  getMyApplications,
  getApplicationDetail,
  withdrawApplication,
  getCandidateProfile,
  updateCandidateProfile,
  getCachedResumes,
  uploadApplicationResume,
};
