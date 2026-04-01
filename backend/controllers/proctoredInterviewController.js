/**
 * Proctored Interview Controller
 *
 * Handles the complete lifecycle of Zinterview proctored interviews:
 *  1. Consent & signature
 *  2. Find or create opening (with matching logic)
 *  3. Create candidate in Zinterview
 *  4. Schedule interview
 *  5. Cancel / reschedule
 *  6. Fetch report & cheating score
 *  7. Progress persistence & resume
 *  8. Admin views
 */

const asyncHandler = require("express-async-handler");
const ProctoredOpening = require("../models/ProctoredOpening");
const ProctoredCandidate = require("../models/ProctoredCandidate");
const ProctoredInterview = require("../models/ProctoredInterview");
const ProctoredInterviewHistory = require("../models/ProctoredInterviewHistory");
const { PROCTORED_STEPS } = require("../models/ProctoredInterview");
const User = require("../models/User");
const ZinterviewService = require("../services/zinterviewService");
const {
  findBestMatchingOpening,
} = require("../services/openingMatcherService");
const crypto = require("crypto");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { enrichFromInterview } = require("../services/centralisedResumeService");

// ── Timezone-aware ISO string helper ─────────────────────────────────────

/**
 * Convert a Date object to an ISO-like string (YYYY-MM-DDTHH:mm:ss)
 * in a given IANA timezone. This avoids the pitfall of toISOString()
 * which always returns UTC — the Zinterview API's toZonedIso() interprets
 * bare datetime strings in the provided interviewTimeZone, so we must
 * send local time in that zone.
 */
function toLocalISOString(date, timeZone) {
  const pad = (n) => String(n).padStart(2, "0");
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// ── S3 helper to download user resume ────────────────────────────────────

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const downloadResumeFromS3 = async (s3Key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
  });
  const response = await s3Client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

// ── Opening matching logic ───────────────────────────────────────────────
// Now handled by ../services/openingMatcherService.js
// Uses weighted multi-factor scoring: title (35) + isTechnical (10) +
// experience overlap (25) + skill Jaccard similarity (30) = 100 pts.
// Threshold: 75 pts. When matched, missing data is merged via updateOpening.

// ── Query projection constants ───────────────────────────────────────────

/**
 * Fields to EXCLUDE from interview queries sent to the client.
 * These are large, redundant payloads stored for extensibility
 * but never consumed by the frontend.
 */
const STATUS_EXCLUDED_FIELDS =
  "-rawCandidatePayload -rawSchedulePayload -rawReportPayload -consentSignature";
const OPENING_PROJECTION = "-rawPayload";
const CANDIDATE_PROJECTION = "-rawPayload";

// ════════════════════════════════════════════════════════════════════════
//  CONTROLLER METHODS
// ════════════════════════════════════════════════════════════════════════

/**
 * GET /api/proctored/status
 * Returns the current user's proctored interview state,
 * or null if none exists.
 */
const getStatus = asyncHandler(async (req, res) => {
  let interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: { $nin: ["CANCELLED"] },
  })
    .sort({ createdAt: -1 })
    .select(STATUS_EXCLUDED_FIELDS)
    .populate("opening", OPENING_PROJECTION)
    .populate("candidate", CANDIDATE_PROJECTION);

  if (!interview) {
    return res.json({ interview: null, canStartNew: true, interviewCount: 0 });
  }

  // Include interview count and ability to start new
  const totalCompleted = await ProctoredInterview.countDocuments({
    user: req.user._id,
    status: "COMPLETED",
  });

  let canStartNew = interview.status === "COMPLETED";

  // Check interview limit if enabled
  const configService = require("../services/configService");
  const appConfig = await configService.getConfig();
  if (appConfig.INTERVIEW_LIMIT_ENABLED && totalCompleted >= appConfig.MAX_INTERVIEWS_ALLOWED) {
    canStartNew = false;
  }

  // If the interview is IN_PROGRESS and we haven't fetched the final report yet,
  // call the Zinterview API to get the latest candidate data
  if (
    interview.status === "IN_PROGRESS" &&
    !interview.reportFetched &&
    interview.zinterviewReportId
  ) {
    try {
      const apiResponse = await ZinterviewService.getCandidate(
        interview.zinterviewReportId,
      );
      const report = apiResponse?.report || apiResponse;

      if (report) {
        const isCompleted =
          report.interviewCompleted === true ||
          report.evaluationStatus === true;

        if (isCompleted) {
          // We need rawReportPayload for DB storage but it was excluded
          // from the select. Use a separate update to write the raw payload.
          const updateFields = {
            interviewCompleted: true,
            status: "COMPLETED",
            evaluation: report.evaluation || "",
            performanceScore: extractPerformanceScore(report.evaluation) || 0,
            communicationEvaluation: report.communicationEvaluation || "",
            trustScore: report.trustScore || 0,
            interviewEndTime: report.interviewEndTime
              ? new Date(report.interviewEndTime)
              : new Date(),
            rawReportPayload: report,
            reportFetched: true,
          };

          // Extract transcript messages (only fields the frontend needs)
          if (Array.isArray(report.messages) && report.messages.length > 0) {
            updateFields.messages = report.messages.map((m) => ({
              role: m.role,
              content: m?.content,
              translation: m?.translation ?? "",
              isAutoSkipped: m?.isAutoSkipped ?? false,
              isMainQuestion: m?.isMainQuestion ?? false,
              questionType: m?.questionType ?? "",
              isInterviewEnded: m?.isInterviewEnded ?? false,
              duration: m?.duration ?? 0,
            }));
          }

          // Try to fetch cheating score
          if (!interview.cheatingScore?.verdict) {
            try {
              const cheatingResponse = await ZinterviewService.getCheatingScore(
                interview.zinterviewReportId,
              );
              if (cheatingResponse?.data) {
                updateFields.cheatingScore = {
                  likelihood_of_cheating:
                    cheatingResponse.data.likelihood_of_cheating || 0,
                  summary: cheatingResponse.data.summary || "",
                  verdict: cheatingResponse.data.verdict || "",
                };
              }
            } catch (err) {
              console.warn("Could not fetch cheating score:", err.message);
            }
          }

          // Update ProctoredCandidate with the latest raw payload
          if (interview.candidate) {
            await ProctoredCandidate.findByIdAndUpdate(
              interview.candidate._id,
              { rawPayload: report },
            );
          }

          // Save all fields (including raw payload) to DB
          await ProctoredInterview.findByIdAndUpdate(interview._id, {
            $set: updateFields,
          });

          // Re-query with projections so the response stays lean
          interview = await ProctoredInterview.findById(interview._id)
            .select(STATUS_EXCLUDED_FIELDS)
            .populate("opening", OPENING_PROJECTION)
            .populate("candidate", CANDIDATE_PROJECTION);
        }
      }
    } catch (err) {
      console.warn(
        "Could not fetch latest candidate data from Zinterview:",
        err.message,
      );
      // Non-fatal — return whatever we have in the DB
    }
  }

  // If the interview is COMPLETED but evaluation is still empty,
  // re-poll Zinterview to check if the evaluation has arrived.
  if (
    interview.status === "COMPLETED" &&
    interview.reportFetched &&
    !interview.evaluation &&
    interview.zinterviewReportId
  ) {
    try {
      const apiResponse = await ZinterviewService.getCandidate(
        interview.zinterviewReportId,
      );
      const report = apiResponse?.report || apiResponse;

      if (report?.evaluation) {
        const updateFields = {
          evaluation: report.evaluation,
          performanceScore: extractPerformanceScore(report.evaluation) || 0,
          communicationEvaluation: report.communicationEvaluation || "",
          trustScore: report.trustScore || 0,
          rawReportPayload: report,
        };

        // Extract transcript messages if available
        if (Array.isArray(report.messages) && report.messages.length > 0) {
          updateFields.messages = report.messages.map((m) => ({
            role: m.role,
            content: m?.content,
            translation: m?.translation ?? "",
            isAutoSkipped: m?.isAutoSkipped ?? false,
            isMainQuestion: m?.isMainQuestion ?? false,
            questionType: m?.questionType ?? "",
            isInterviewEnded: m?.isInterviewEnded ?? false,
            duration: m?.duration ?? 0,
          }));
        }

        // Try to fetch cheating score if not already fetched
        if (!interview.cheatingScore?.verdict) {
          try {
            const cheatingResponse = await ZinterviewService.getCheatingScore(
              interview.zinterviewReportId,
            );
            if (cheatingResponse?.data) {
              updateFields.cheatingScore = {
                likelihood_of_cheating:
                  cheatingResponse.data.likelihood_of_cheating || 0,
                summary: cheatingResponse.data.summary || "",
                verdict: cheatingResponse.data.verdict || "",
              };
            }
          } catch (err) {
            console.warn("Could not fetch cheating score:", err.message);
          }
        }

        // Update ProctoredCandidate with the latest raw payload
        if (interview.candidate) {
          await ProctoredCandidate.findByIdAndUpdate(
            interview.candidate._id || interview.candidate,
            { rawPayload: report },
          );
        }

        await ProctoredInterview.findByIdAndUpdate(interview._id, {
          $set: updateFields,
        });

        // Re-query with projections so the response stays lean
        interview = await ProctoredInterview.findById(interview._id)
          .select(STATUS_EXCLUDED_FIELDS)
          .populate("opening", OPENING_PROJECTION)
          .populate("candidate", CANDIDATE_PROJECTION);
      }
    } catch (err) {
      console.warn(
        "Could not re-fetch evaluation from Zinterview:",
        err.message,
      );
      // Non-fatal — return whatever we have in the DB
    }
  }

  // Include evaluationPending flag so frontend knows whether to keep polling
  const evaluationPending =
    interview.status === "COMPLETED" && !interview.evaluation;
  res.json({ interview, evaluationPending, canStartNew, interviewCount: totalCompleted });
});

/**
 * POST /api/proctored/consent
 * Body: { signature: string }
 *
 * Creates or updates a ProctoredInterview in CONSENT_GIVEN state.
 */
const saveConsent = asyncHandler(async (req, res) => {
  const { signature } = req.body;

  if (!signature) {
    res.status(400);
    throw new Error("Digital signature is required");
  }

  // Check for an existing active proctored interview (includes reset ones)
  let interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: { $nin: ["COMPLETED", "CANCELLED"] },
  });

  if (interview) {
    // Already exists — just update consent
    interview.consentSignature = signature;
    interview.consentGivenAt = new Date();
    interview.consentAcknowledged = true;
    if (interview.currentStep < PROCTORED_STEPS.CONSENT) {
      interview.currentStep = PROCTORED_STEPS.CONSENT;
    }
    await interview.save();
  } else {
    interview = await ProctoredInterview.create({
      user: req.user._id,
      status: "CONSENT_GIVEN",
      currentStep: PROCTORED_STEPS.CONSENT,
      consentSignature: signature,
      consentGivenAt: new Date(),
      consentAcknowledged: true,
    });
  }

  res.status(201).json({ interview });
});

/**
 * POST /api/proctored/find-or-create-opening
 * Body: { title, isTechnical, minExperience, maxExperience, skills, jobRequirements, interviewGuidelines }
 *
 * 1. Fetches existing openings from Zinterview
 * 2. Tries to find a match
 * 3. If match → reuses it; else → creates a new one
 * 4. Caches locally in ProctoredOpening
 * 5. Updates user's ProctoredInterview
 */
const findOrCreateOpening = asyncHandler(async (req, res) => {
  const {
    title,
    isTechnical = true,
    minExperience = 0,
    maxExperience = 20,
    skills = [],
    jobRequirements = [],
    interviewGuidelines = "",
  } = req.body;

  if (!title) {
    res.status(400);
    throw new Error("Job title is required");
  }

  // Get the user's active proctored interview
  let interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: { $nin: ["COMPLETED", "CANCELLED"] },
  });

  if (!interview) {
    res.status(400);
    throw new Error(
      "No active proctored interview found. Please complete the consent step first.",
    );
  }

  // 1. Fetch existing openings
  let existingOpenings = [];
  try {
    const openingsResponse = await ZinterviewService.getOpenings();
    existingOpenings = openingsResponse?.openings || openingsResponse || [];
    if (!Array.isArray(existingOpenings)) existingOpenings = [];
  } catch (err) {
    console.warn(
      "Could not fetch existing openings, will create new:",
      err.message,
    );
  }

  // 2. Find the best matching opening using the multi-factor scoring algorithm
  const matchResult = await findBestMatchingOpening(existingOpenings, {
    title,
    isTechnical,
    minExperience,
    maxExperience,
    skills,
    jobRequirements,
  });

  let openingData;
  let matchedOpening = null;

  if (matchResult) {
    // Reuse the existing opening
    matchedOpening = matchResult.match;
    openingData = matchedOpening;

    // 2b. Merge any missing data into the matched opening
    if (matchResult.mergePayload) {
      const openingId =
        matchedOpening._id?.$oid ||
        matchedOpening._id ||
        String(matchedOpening._id);
      try {
        const updateResponse = await ZinterviewService.updateOpening(
          openingId,
          matchResult.mergePayload,
        );
        // Use the updated opening data for local caching
        openingData = updateResponse?.opening || updateResponse || openingData;
        // Ensure the ID is preserved (some APIs return different shapes)
        if (!openingData._id) openingData._id = matchedOpening._id;
        console.log(
          `Opening ${openingId} updated with missing data (score: ${matchResult.score}/100)`,
        );
      } catch (err) {
        console.warn(
          `Could not update opening ${openingId} with merge data:`,
          err.message,
        );
        // Non-fatal — proceed with the existing opening as-is
      }
    } else {
      console.log(
        `Opening matched perfectly, no merge needed (score: ${matchResult.score}/100)`,
      );
    }
  } else {
    // 3. No match found — create a new opening
    const skillsGroup =
      skills.length > 0
        ? [
            {
              skillGroupName: "Primary Skills",
              skills,
              criteria: 2,
              weight: 1,
            },
          ]
        : [];

    const payload = {
      title,
      isTechnical,
      minExperience,
      maxExperience,
      jobRequirementsAndResponsibilities:
        jobRequirements.length > 0
          ? jobRequirements
          : [`Interview for ${title} position`],
      skillsGroup,
      // Interview configuration
      proctoring: true,
      isCodeEditorRequired: isTechnical,
      avatarMode: true,
      questionsBasedOnResume: true,
      isMobileInterviewAllowed: false,
      isRecordingEnabled: true,
      isCandidatePhotoRequired: true,
      isFaceMatchRequired: false,
      isSecondaryCameraRequired: false,
      editResponses: false,
      // Assessment types
      listeningComprehension: false,
      errorCorrection: false,
      emailWriting: false,
      // Question configuration
      maxQuestions: 12,
      // maxQuestions: 5, //For local
      mixOfBothQuestions: true,
      languageOfQuestions: "en",
      languageOfAnswers: "en",
      askIntroQuestion: true,
      askDailyWorkToolsQuestion: true,
      isFollowUpQuestionsRequired: true,
      numberOfResumeBasedQuestions: 2,
      autoSkipQTimeoutS: 60,
      scoringLeniency: 2,
      interviewMode: "TRADITIONAL",
      interviewGuidelines:
        interviewGuidelines ||
        `Interview for ${title}. Assess the candidate's knowledge, experience, and practical skills relevant to this role.`,
      newCustomQuestions: [],
      customQuestions: [],
      questionCategoriesFromBank: [],
      // Support & notifications
      allowSupportContact: true,
      supportPhone: "+91 8000926262",
      supportEmail: "support@zinterview.ai",
      supportName: "MockMate Support",
      supportContactText: null,
      emailRecipients: [],
      ccEmails: [],
      // Scoring & evaluation
      evaluationScoringSpecialInstructions: "",
      isSpecialEvaluationInstructionsMode: "false",
      businessContext: "",
      // Organization & folders
      aliasOrganizationName: null,
      foldersData: {},
      customRegistrationsFields: {
        unsavedCustomRegistrationsFields: [],
        movingData: {},
      },
    };

    const createResponse = await ZinterviewService.createOpening(payload);
    openingData = createResponse?.opening || createResponse;
  }

  // 4. Cache or update locally
  const zOpeningId =
    openingData._id?.$oid || openingData._id || String(openingData._id);
  let localOpening = await ProctoredOpening.findOne({
    zinterviewOpeningId: zOpeningId,
  });

  const localOpeningFields = {
    zinterviewOpeningId: zOpeningId,
    organizationId:
      openingData.organizationId?.$oid ||
      openingData.organizationId ||
      ZinterviewService.getOrganizationId(),
    title: openingData.title || title,
    description: openingData.description || "",
    isTechnical: openingData.isTechnical ?? isTechnical,
    minExperience: openingData.minExperience ?? minExperience,
    maxExperience: openingData.maxExperience ?? maxExperience,
    skillsGroup: openingData.skillsGroup || [],
    coreSkills: openingData.coreSkills || [],
    jobRequirementsAndResponsibilities:
      openingData.jobRequirementsAndResponsibilities || [],
    interviewGuidelines: openingData.interviewGuidelines || "",
    // Interview configuration
    maxQuestions: openingData.maxQuestions || 12,
    // maxQuestions: openingData.maxQuestions || 5, //For local
    proctoring: openingData.proctoring ?? true,
    isCodeEditorRequired: openingData.isCodeEditorRequired ?? false,
    avatarMode: openingData.avatarMode ?? true,
    questionsBasedOnResume: openingData.questionsBasedOnResume ?? true,
    isMobileInterviewAllowed: openingData.isMobileInterviewAllowed ?? false,
    isRecordingEnabled: openingData.isRecordingEnabled ?? true,
    isCandidatePhotoRequired: openingData.isCandidatePhotoRequired ?? true,
    isFaceMatchRequired: openingData.isFaceMatchRequired ?? false, //keep true for prod
    isSecondaryCameraRequired: openingData.isSecondaryCameraRequired ?? false,
    editResponses: openingData.editResponses ?? false,
    // Question configuration
    languageOfQuestions: openingData.languageOfQuestions || "en",
    languageOfAnswers: openingData.languageOfAnswers || "en",
    interviewMode: openingData.interviewMode || "TRADITIONAL",
    scoringLeniency: openingData.scoringLeniency ?? 2,
    askIntroQuestion: openingData.askIntroQuestion ?? true,
    askDailyWorkToolsQuestion: openingData.askDailyWorkToolsQuestion ?? true,
    mixOfBothQuestions: openingData.mixOfBothQuestions ?? true,
    isFollowUpQuestionsRequired:
      openingData.isFollowUpQuestionsRequired ?? true,
    numberOfResumeBasedQuestions: openingData.numberOfResumeBasedQuestions ?? 2,
    autoSkipQTimeoutS: openingData.autoSkipQTimeoutS ?? 60,
    // Support & notifications
    allowSupportContact: openingData.allowSupportContact ?? true,
    supportPhone: openingData.supportPhone || "+91 8000926262",
    supportEmail: openingData.supportEmail || "",
    supportName: openingData.supportName || "",
    emailRecipients: openingData.emailRecipients || [],
    // Business context
    businessContext: openingData.businessContext || "",
    // Full raw response
    rawPayload: openingData,
  };

  if (localOpening) {
    // Update the local cache with the latest opening data (handles merges)
    Object.assign(localOpening, localOpeningFields);
    await localOpening.save();
  } else {
    localOpening = await ProctoredOpening.create(localOpeningFields);
  }

  // 5. Update interview
  interview.opening = localOpening._id;
  interview.zinterviewOpeningId = zOpeningId;
  interview.status = "OPENING_CREATED";
  interview.currentStep = PROCTORED_STEPS.OPENING;
  interview.stepData = {
    ...interview.stepData,
    openingDetails: {
      title,
      isTechnical,
      minExperience,
      maxExperience,
      skills,
    },
    isExistingOpening: !!matchedOpening,
  };
  await interview.save();

  res.status(201).json({
    interview,
    opening: localOpening,
    isExistingOpening: !!matchedOpening,
  });
});

/**
 * POST /api/proctored/create-candidate
 * Body: { firstName, lastName, email, phoneNumber?, experience?, resumeS3Key? }
 *
 * Creates the candidate in Zinterview and caches locally.
 */
const createCandidate = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phoneNumber, experience } = req.body;

  if (!firstName || !lastName || !email) {
    res.status(400);
    throw new Error("First name, last name, and email are required");
  }

  const interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: { $nin: ["COMPLETED", "CANCELLED"] },
  }).populate("opening");

  if (!interview || !interview.zinterviewOpeningId) {
    res.status(400);
    throw new Error("Opening must be created before adding a candidate");
  }

  // Prepare form data fields
  const candidateFields = {
    openingId: interview.zinterviewOpeningId,
    firstName,
    lastName,
    email,
    preferredName: `${firstName} ${lastName}`,
    correctionFormShown: true,
  };
  if (phoneNumber) candidateFields.phoneNumber = phoneNumber;
  if (experience !== undefined) candidateFields.experience = experience;

  // Download resume from S3 if available
  let resumeBuffer = null;
  let resumeFileName = null;
  const user = await User.findById(req.user._id);

  // Use provided resumeS3Key or fall back to user's existing resume
  const resumeKey = req.body.resumeS3Key || user?.resumeS3Key;
  if (resumeKey) {
    try {
      resumeBuffer = await downloadResumeFromS3(resumeKey);
      resumeFileName = user?.resumeFileName || "resume.pdf";
    } catch (err) {
      console.warn("Could not download resume from S3:", err.message);
    }
  }

  // Call Zinterview API — try create first, fall back to update if candidate already exists
  let candidateData;
  try {
    const createResponse = await ZinterviewService.createCandidate(
      candidateFields,
      resumeBuffer,
      resumeFileName,
    );
    candidateData =
      createResponse?.data ||
      createResponse?.interviewReportsData?.[0] ||
      createResponse;
  } catch (createErr) {
    const errMsg = (createErr.message || "").toLowerCase();
    const isAlreadyExists =
      errMsg.includes("already exist") ||
      errMsg.includes("duplicate") ||
      createErr.statusCode === 409;

    if (isAlreadyExists) {
      console.log(
        `Candidate already exists for opening ${interview.zinterviewOpeningId}, using updateCandidate instead`,
      );

      // Fetch all candidates for this opening to find the existing candidateId
      const candidatesResponse = await ZinterviewService.getCandidates(
        interview.zinterviewOpeningId,
      );
      const candidates =
        candidatesResponse?.reports || candidatesResponse || [];
      const existingCandidate = Array.isArray(candidates)
        ? candidates.find((c) => c.email?.toLowerCase() === email.toLowerCase())
        : null;

      if (!existingCandidate) {
        throw new Error(
          `Candidate already exists but could not be found by email "${email}" in opening ${interview.zinterviewOpeningId}`,
        );
      }

      const existingCandidateId =
        existingCandidate._id?.$oid ||
        existingCandidate._id ||
        String(existingCandidate._id);

      // Add the required candidateId for the update API
      candidateFields.candidateId = existingCandidateId;

      const updateResponse = await ZinterviewService.updateCandidate(
        candidateFields,
        resumeBuffer,
        resumeFileName,
      );
      candidateData =
        updateResponse?.data ||
        updateResponse?.interviewReportsData?.[0] ||
        updateResponse;
    } else {
      throw createErr;
    }
  }

  const zCandidateId =
    candidateData._id?.$oid || candidateData._id || String(candidateData._id);

  // Cache locally
  let localCandidate = await ProctoredCandidate.findOne({
    user: req.user._id,
    zinterviewOpeningId: interview.zinterviewOpeningId,
  });

  if (localCandidate) {
    localCandidate.zinterviewCandidateId = zCandidateId;
    localCandidate.firstName = firstName;
    localCandidate.lastName = lastName;
    localCandidate.email = email;
    localCandidate.phoneNumber = phoneNumber || "";
    localCandidate.experience = experience || 0;
    localCandidate.resumeUrl = user?.resumeUrl || "";
    localCandidate.resumeS3Key = resumeKey || "";
    localCandidate.resumeFileName = resumeFileName || "";
    localCandidate.rawPayload = candidateData;
    await localCandidate.save();
  } else {
    localCandidate = await ProctoredCandidate.create({
      user: req.user._id,
      opening: interview.opening,
      zinterviewCandidateId: zCandidateId,
      zinterviewOpeningId: interview.zinterviewOpeningId,
      firstName,
      lastName,
      email,
      phoneNumber: phoneNumber || "",
      experience: experience || 0,
      resumeUrl: user?.resumeUrl || "",
      resumeS3Key: resumeKey || "",
      resumeFileName: resumeFileName || "",
      rawPayload: candidateData,
    });
  }

  // Update interview
  interview.candidate = localCandidate._id;
  interview.zinterviewCandidateId = zCandidateId;
  interview.status = "CANDIDATE_ADDED";
  interview.currentStep = PROCTORED_STEPS.CANDIDATE;
  interview.rawCandidatePayload = candidateData;
  await interview.save();

  res.status(201).json({ interview, candidate: localCandidate });
});

/**
 * POST /api/proctored/schedule
 * Body: { schedule, isStartNow?, interviewTimeZone? }
 */
const scheduleInterview = asyncHandler(async (req, res) => {
  const {
    schedule,
    isStartNow = false,
    interviewTimeZone = "Asia/Calcutta",
  } = req.body;

  const interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: { $nin: ["COMPLETED", "CANCELLED"] },
  });

  if (!interview || !interview.zinterviewCandidateId) {
    res.status(400);
    throw new Error("Candidate must be added before scheduling");
  }

  // Build schedule time — must be expressed in the target timezone, NOT UTC.
  // The Zinterview API's toZonedIso() interprets bare datetime strings in
  // the provided interviewTimeZone, so sending UTC would be ~5.5 hours behind
  // IST and get rejected as "schedule must be a future date/time".
  let scheduleTime;
  if (isStartNow) {
    // Schedule 2 minutes from now, expressed in the target timezone
    scheduleTime = toLocalISOString(
      new Date(Date.now() + 120 * 1000),
      interviewTimeZone,
    );
  } else {
    if (!schedule) {
      res.status(400);
      throw new Error(
        'Schedule time is required when not using "Start Now" option',
      );
    }
    scheduleTime = schedule;
  }

  // const interviewBaseUrl = ZinterviewService.buildInterviewBaseUrl(
  //   interview.zinterviewOpeningId,
  // );

  const payload = {
    openingId: interview.zinterviewOpeningId,
    selectedCandidateIds: [interview.zinterviewCandidateId],
    schedule: scheduleTime,
    joinOption: "anytime",
    timeWindow: 24,
    joinEarly: true,
    allowRescheduleByCandidate: true,
    maxRescheduleDateForCandidate: toLocalISOString(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      interviewTimeZone,
    ),
    maxReschedules: 3,
    ccEmails: ["harshith@riktamtech.com"],
    // interviewBaseUrl,
    interviewTimeZone,
    supportContactText: "+91 1231231234",
  };

  const scheduleResponse = await ZinterviewService.scheduleCandidates(payload);

  const reportData =
    scheduleResponse?.interviewReportsData?.[0] || scheduleResponse;

  const reportId =
    reportData._id?.$oid || reportData._id || String(reportData._id);
  const resumeToken = reportData.resumeToken || "";
  const shortCode = reportData.shortCode || "";

  const interviewUrl = ZinterviewService.buildInterviewUrl(
    interview.zinterviewOpeningId,
    reportId,
    resumeToken,
  );

  // Update interview record
  interview.zinterviewReportId = reportId;
  interview.resumeToken = resumeToken;
  interview.shortCode = shortCode;
  interview.interviewUrl = interviewUrl;
  interview.adminProctorJoinUrl = reportData.adminProctorJoinUrl || "";
  interview.schedule = new Date(scheduleTime);
  interview.interviewTimeZone = interviewTimeZone;
  interview.isStartNow = isStartNow;
  interview.joinEarly = true;
  interview.joinOption = "anytime";
  interview.timeWindow = 24;
  interview.status = "SCHEDULED";
  interview.currentStep = PROCTORED_STEPS.SCHEDULE;
  interview.rawSchedulePayload = reportData;
  interview.allowRescheduleByCandidate = true;
  interview.maxReschedules = 3;
  interview.maxRescheduleDateForCandidate = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  );
  await interview.save();

  res.status(201).json({ interview, interviewUrl });
});

/**
 * POST /api/proctored/cancel
 * Body: { reason? }
 */
const cancelInterview = asyncHandler(async (req, res) => {
  const { reason = "" } = req.body;

  const interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: "SCHEDULED",
  });

  if (!interview) {
    res.status(400);
    throw new Error("No scheduled interview found to cancel");
  }

  const cancelResponse = await ZinterviewService.cancelInterview({
    selectedCandidateIds: [interview.zinterviewCandidateId],
    reason,
  });

  interview.status = "CANCELLED";
  interview.cancelled = true;
  interview.cancelledAt = new Date();
  interview.reasonForCancellation = reason;
  await interview.save();

  res.json({ message: "Interview cancelled successfully", interview });
});

/**
 * POST /api/proctored/reschedule
 * Body: { schedule, interviewTimeZone?, reason? }
 */
const rescheduleInterview = asyncHandler(async (req, res) => {
  const {
    schedule,
    interviewTimeZone = "Asia/Calcutta",
    reason = "Rescheduled by candidate",
    isStartNow = false,
  } = req.body;

  const interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: "SCHEDULED",
  });

  if (!interview) {
    res.status(400);
    throw new Error("No scheduled interview found to reschedule");
  }

  if (interview.rescheduleCount >= interview.maxReschedules) {
    res.status(400);
    throw new Error("Maximum reschedule limit reached");
  }

  // Cancel the existing interview
  await ZinterviewService.cancelInterview({
    selectedCandidateIds: [interview.zinterviewCandidateId],
    reason,
  });

  // Re-schedule
  let scheduleTime;
  if (isStartNow) {
    scheduleTime = toLocalISOString(
      new Date(Date.now() + 120 * 1000),
      interviewTimeZone,
    );
  } else {
    if (!schedule) {
      res.status(400);
      throw new Error("Schedule time is required");
    }
    scheduleTime = schedule;
  }

  // const interviewBaseUrl = ZinterviewService.buildInterviewBaseUrl(
  //   interview.zinterviewOpeningId,
  // );

  const payload = {
    openingId: interview.zinterviewOpeningId,
    selectedCandidateIds: [interview.zinterviewCandidateId],
    schedule: scheduleTime,
    // interviewBaseUrl,
    interviewTimeZone,
    joinEarly: true,
    joinOption: "anytime",
    timeWindow: 24,
    allowRescheduleByCandidate: true,
    maxRescheduleDateForCandidate: toLocalISOString(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      interviewTimeZone,
    ),
    maxReschedules: interview.maxReschedules,
    supportContactText: "+91 1231231234", // Added because it's required by Zinterview
  };

  const scheduleResponse = await ZinterviewService.scheduleCandidates(payload);
  const reportData =
    scheduleResponse?.interviewReportsData?.[0] || scheduleResponse;

  const reportId =
    reportData._id?.$oid || reportData._id || String(reportData._id);
  const resumeToken = reportData.resumeToken || "";
  const interviewUrl = ZinterviewService.buildInterviewUrl(
    interview.zinterviewOpeningId,
    reportId,
    resumeToken,
  );

  interview.zinterviewReportId = reportId;
  interview.resumeToken = resumeToken;
  interview.shortCode = reportData.shortCode || "";
  interview.interviewUrl = interviewUrl;
  interview.schedule = new Date(scheduleTime);
  interview.interviewTimeZone = interviewTimeZone;
  interview.isStartNow = isStartNow;
  interview.rescheduleCount += 1;
  interview.rawSchedulePayload = reportData;
  interview.cancelled = false;
  await interview.save();

  res.json({ interview, interviewUrl });
});

/**
 * GET /api/proctored/report
 * Fetches evaluation + cheating score from Zinterview (if not already cached),
 * then returns the report.
 */
const getReport = asyncHandler(async (req, res) => {
  let interview = await ProctoredInterview.findOne({
    user: req.user._id,
  })
    .sort({ createdAt: -1 })
    .select(STATUS_EXCLUDED_FIELDS)
    .populate("opening", OPENING_PROJECTION)
    .populate("candidate", CANDIDATE_PROJECTION);

  if (!interview) {
    res.status(404);
    throw new Error("No proctored interview found");
  }

  // If interview is completed but report not fetched, try to fetch it
  if (interview.zinterviewCandidateId && !interview.reportFetched) {
    try {
      // Try to get candidates to check completion status
      if (interview.zinterviewOpeningId) {
        const candidatesResponse = await ZinterviewService.getCandidates(
          interview.zinterviewOpeningId,
        );
        const candidates =
          candidatesResponse?.interviewReportsData || candidatesResponse || [];

        const candidate = Array.isArray(candidates)
          ? candidates.find(
              (c) =>
                (c._id?.$oid || c._id || String(c._id)) ===
                interview.zinterviewCandidateId,
            )
          : null;

        if (candidate) {
          if (candidate.interviewCompleted) {
            interview.interviewCompleted = true;
            interview.status = "COMPLETED";
            interview.evaluation = candidate.evaluation || "";
            interview.communicationEvaluation =
              candidate.communicationEvaluation || "";
            interview.trustScore = candidate.trustScore || 0;
            interview.interviewEndTime = candidate.interviewEndTime
              ? new Date(candidate.interviewEndTime)
              : new Date();
            interview.rawReportPayload = candidate;

            // Extract transcript messages (only fields the frontend needs)
            if (
              Array.isArray(candidate.messages) &&
              candidate.messages.length > 0
            ) {
              interview.messages = candidate.messages.map((m) => ({
                role: m.role,
                content: m.content,
                isMainQuestion: m.isMainQuestion,
                questionType: m.questionType,
                isInterviewEnded: m.isInterviewEnded,
              }));
            }
          }
        }
      }

      // Fetch cheating score
      if (
        interview.zinterviewCandidateId &&
        !interview.cheatingScore?.verdict
      ) {
        try {
          const cheatingResponse = await ZinterviewService.getCheatingScore(
            interview.zinterviewCandidateId,
          );
          if (cheatingResponse?.data) {
            interview.cheatingScore = {
              likelihood_of_cheating:
                cheatingResponse.data.likelihood_of_cheating || 0,
              summary: cheatingResponse.data.summary || "",
              verdict: cheatingResponse.data.verdict || "",
            };
          }
        } catch (err) {
          console.warn("Could not fetch cheating score:", err.message);
        }
      }

      if (interview.interviewCompleted) {
        interview.reportFetched = true;
      }
      await interview.save();

      // Re-query with projections so the response stays lean
      interview = await ProctoredInterview.findById(interview._id)
        .select(STATUS_EXCLUDED_FIELDS)
        .populate("opening", OPENING_PROJECTION)
        .populate("candidate", CANDIDATE_PROJECTION);
    } catch (err) {
      console.warn("Could not fetch report data:", err.message);
    }
  }

  res.json({ interview });
});

/**
 * POST /api/proctored/save-progress
 * Body: { currentStep, stepData, status? }
 */
const saveProgress = asyncHandler(async (req, res) => {
  const { currentStep, stepData, status } = req.body;

  const interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: { $nin: ["COMPLETED", "CANCELLED"] },
  });

  if (!interview) {
    res.status(400);
    throw new Error("No active proctored interview found");
  }

  if (currentStep !== undefined) interview.currentStep = currentStep;
  if (stepData) interview.stepData = { ...interview.stepData, ...stepData };
  if (status) interview.status = status;
  await interview.save();

  res.json({ interview });
});

/**
 * POST /api/proctored/start-over
 * Takes a snapshot of the current interview progress into ProctoredInterviewHistory,
 * cancels any active Zinterview, and resets the active ProctoredInterview document.
 */
const startOver = asyncHandler(async (req, res) => {
  const interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: { $nin: ["COMPLETED", "CANCELLED"] },
  });

  if (!interview) {
    return res.json({ message: "No active interview to reset" });
  }

  const { stepData } = req.body || {};

  // If interview is IN_PROGRESS or SCHEDULED, check with Zinterview if it has actually started
  if (
    (interview.status === "IN_PROGRESS" || interview.status === "SCHEDULED") &&
    interview.zinterviewReportId
  ) {
    try {
      const apiResponse = await ZinterviewService.getCandidate(
        interview.zinterviewReportId,
      );
      const report = apiResponse?.report || apiResponse;

      // Interview has started if: it's completed, there's an active session,
      // or there are more than 2 messages (beyond the initial welcome exchange)
      const hasStarted =
        report?.interviewCompleted === true ||
        report?.activeSession === true ||
        (Array.isArray(report?.messages) && report.messages.length > 2);

      if (hasStarted) {
        return res.status(400).json({
          cannotReset: true,
          reason:
            "Your interview has already started and cannot be reset. Please continue or complete the interview.",
          interviewUrl: interview.interviewUrl,
        });
      }
    } catch (err) {
      console.warn(
        "Could not check interview status with Zinterview:",
        err.message,
      );
      // If we can't confirm, be safe — deny reset for IN_PROGRESS
      if (interview.status === "IN_PROGRESS") {
        return res.status(400).json({
          cannotReset: true,
          reason:
            "Unable to verify interview status. The interview may have started. Please try to resume instead.",
          interviewUrl: interview.interviewUrl,
        });
      }
    }
  }

  // If scheduled or was in-progress but not yet started, cancel in Zinterview first
  if (
    (interview.status === "SCHEDULED" || interview.status === "IN_PROGRESS") &&
    interview.zinterviewCandidateId
  ) {
    try {
      await ZinterviewService.cancelInterview({
        selectedCandidateIds: [interview.zinterviewCandidateId],
        reason: "User chose to start over",
      });
    } catch (err) {
      console.warn("Could not cancel in Zinterview:", err.message);
    }
  }

  // Use the passed stepData or fallback to what's in the interview
  const finalStepData = stepData || interview.stepData || {};

  const checkString = (val) => typeof val === "string" && val.trim() !== "";
  const hasMeaningfulStepData =
    finalStepData &&
    (checkString(finalStepData.role) ||
      checkString(finalStepData.firstName) ||
      checkString(String(finalStepData.experience || "")) ||
      (Array.isArray(finalStepData.skills) && finalStepData.skills.length > 0));

  // 1. Only snapshot history if there's meaningful progress beyond consent
  // Now we consider it meaningful if there is any gathered step data OR if we reached Zinterview steps
  const hasMeaningfulProgress =
    (interview.status !== "CONSENT_GIVEN" &&
      (interview.zinterviewOpeningId || interview.zinterviewCandidateId)) ||
    hasMeaningfulStepData;

  if (hasMeaningfulProgress) {
    // Generate content hash for dedup based on key state fields
    const hashSource = [
      interview.user,
      interview.status,
      interview.currentStep,
      interview.zinterviewReportId || "",
      interview.zinterviewCandidateId || "",
      interview.zinterviewOpeningId || "",
      JSON.stringify(finalStepData), // include data in hash to allow multiple resets if data changed
    ].join("|");
    const contentHash = crypto
      .createHash("sha256")
      .update(hashSource)
      .digest("hex")
      .slice(0, 16);

    // Only create if no duplicate exists
    const existingHistory = await ProctoredInterviewHistory.findOne({
      originalInterviewId: interview._id,
      contentHash,
    });

    if (!existingHistory) {
      await ProctoredInterviewHistory.create({
        originalInterviewId: interview._id,
        user: interview.user,
        opening: interview.opening,
        candidate: interview.candidate,
        zinterviewReportId: interview.zinterviewReportId,
        zinterviewOpeningId: interview.zinterviewOpeningId,
        zinterviewCandidateId: interview.zinterviewCandidateId,
        statusAtReset: interview.status,
        stepAtReset: interview.currentStep,
        stepDataSnapshot: finalStepData,
        evaluation: interview.evaluation,
        communicationEvaluation: interview.communicationEvaluation,
        trustScore: interview.trustScore,
        reasonForReset: "User started over manually",
        contentHash,
      });
    }
  }

  // 2. Reset the active document — PRESERVE consent fields
  interview.status = "CONSENT_GIVEN";
  interview.currentStep = PROCTORED_STEPS.CONSENT;
  interview.resetCount = (interview.resetCount || 0) + 1;
  // NOTE: consentSignature, consentGivenAt, consentAcknowledged are intentionally preserved

  // Clear out specific references
  interview.opening = undefined;
  interview.candidate = undefined;
  interview.zinterviewReportId = "";
  interview.zinterviewOpeningId = "";
  interview.zinterviewCandidateId = "";
  interview.resumeToken = "";
  interview.shortCode = "";
  interview.interviewUrl = "";
  interview.adminProctorJoinUrl = "";

  // Clear schedule data
  interview.schedule = undefined;
  interview.interviewStartTime = undefined;
  interview.interviewEndTime = undefined;

  // Reset step forms and payloads
  interview.stepData = {};
  interview.rawSchedulePayload = {};
  interview.rawCandidatePayload = {};
  interview.rawReportPayload = {};

  // Reset booleans
  interview.interviewCompleted = false;
  interview.reportFetched = false;

  await interview.save();

  res.json({
    message: "Previous progress saved to history. Interview reset to start.",
    interview,
    consentAlreadyGiven: interview.consentAcknowledged === true,
  });
});

/**
 * POST /api/proctored/mark-in-progress
 * Called when the user opens the interview link.
 */
const markInProgress = asyncHandler(async (req, res) => {
  const interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: "SCHEDULED",
  });

  if (!interview) {
    res.status(400);
    throw new Error("No scheduled interview found");
  }

  interview.status = "IN_PROGRESS";
  interview.currentStep = PROCTORED_STEPS.JOIN;
  interview.interviewStartTime = new Date();
  await interview.save();

  res.json({ interview });
});

/**
 * POST /api/proctored/resume-interview
 * Resumes an interrupted interview by fetching the correct message index
 * and calling Zinterview's resumeInterview API.
 */
const resumeInterview = asyncHandler(async (req, res) => {
  const interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: { $in: ["IN_PROGRESS", "SCHEDULED"] },
  });

  if (!interview || !interview.zinterviewReportId) {
    res.status(400);
    throw new Error("No active interview found to resume");
  }

  // Fetch the latest candidate data to get messages count
  let messageIndex = 0;
  try {
    const apiResponse = await ZinterviewService.getCandidate(
      interview.zinterviewReportId,
    );
    const report = apiResponse?.report || apiResponse;

    if (Array.isArray(report?.messages) && report.messages.length > 0) {
      // messageIndex = total messages count - 1 (0-indexed)
      messageIndex = report.messages.length - 1;
    }
  } catch (err) {
    console.warn(
      "Could not fetch latest message count from Zinterview:",
      err.message,
    );
    // Try with 0 as fallback
  }

  // Call Zinterview resume API
  const resumeResponse = await ZinterviewService.resumeInterview({
    interviewReportId: interview.zinterviewReportId,
    messageIndex,
  });

  const resumeToken = resumeResponse?.resumeToken || "";

  // Build resume URL using the old UI format which supports resume tokens
  const host =
    process.env.NODE_ENV === "production"
      ? process.env.ZINTERVIEW_INTERVIEW_HOST_PROD ||
        "https://interview.zinterview.ai"
      : process.env.ZINTERVIEW_INTERVIEW_HOST_LOCAL || "http://localhost:4200";
  const resumeUrl = `${host}/interview/${interview.zinterviewOpeningId}/start/${interview.zinterviewReportId}/${resumeToken}`;

  // Update interview record with new resume token
  interview.resumeToken = resumeToken;
  await interview.save();

  res.json({ resumeUrl, resumeToken });
});

/**
 * POST /api/proctored/reset-session
 * Resets the active session flag in Zinterview.
 */
const resetSession = asyncHandler(async (req, res) => {
  const interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: { $in: ["IN_PROGRESS", "SCHEDULED", "COMPLETED"] },
  }).populate("opening");

  if (!interview || !interview.zinterviewReportId) {
    res.status(400);
    throw new Error("No active interview found to reset session");
  }

  // Use Zinterview API to reset the session
  const orgName = "MockMate";
  const title = interview.opening?.title || "Interview";
  
  try {
    const result = await ZinterviewService.resetActiveSession(
      interview.zinterviewReportId,
      title,
      orgName
    );
    res.json({ message: "Session reset successfully", result });
  } catch (err) {
    res.status(500);
    throw new Error(err.message || "Failed to reset session");
  }
});

/**
 * POST /api/proctored/check-completion
 * Polls Zinterview to see if the interview is complete.
 */
const checkCompletion = asyncHandler(async (req, res) => {
  // Look for IN_PROGRESS interviews, or COMPLETED ones with missing evaluation
  let interview = await ProctoredInterview.findOne({
    user: req.user._id,
    status: { $in: ["IN_PROGRESS", "COMPLETED"] },
  }).sort({ createdAt: -1 });

  if (!interview) {
    return res.json({ completed: false });
  }

  // If already COMPLETED but evaluation is empty, re-poll for evaluation
  if (interview.status === "COMPLETED" && !interview.evaluation) {
    try {
      const apiResponse = await ZinterviewService.getCandidate(
        interview.zinterviewReportId,
      );
      const report = apiResponse?.report || apiResponse;

      if (report?.evaluation) {
        interview.evaluation = report.evaluation;
        interview.performanceScore =
          extractPerformanceScore(report.evaluation) || 0;
        interview.communicationEvaluation =
          report.communicationEvaluation || "";
        interview.trustScore = report.trustScore || 0;
        interview.rawReportPayload = report;
        await interview.save();

        return res.json({
          completed: true,
          interview,
          evaluationPending: false,
        });
      }
    } catch (err) {
      console.warn(
        "Evaluation re-fetch failed during completion check:",
        err.message,
      );
    }

    // Still completed but evaluation not ready yet
    return res.json({
      completed: true,
      interview,
      evaluationPending: true,
    });
  }

  // Interview is IN_PROGRESS — check if it has completed on Zinterview's side
  if (interview.status === "IN_PROGRESS") {
    try {
      const candidatesResponse = await ZinterviewService.getCandidates(
        interview.zinterviewOpeningId,
      );
      const candidates =
        candidatesResponse?.interviewReportsData || candidatesResponse || [];

      const candidate = Array.isArray(candidates)
        ? candidates.find(
            (c) =>
              (c._id?.$oid || c._id || String(c._id)) ===
              interview.zinterviewCandidateId,
          )
        : null;

      if (candidate?.interviewCompleted) {
        interview.interviewCompleted = true;
        interview.status = "COMPLETED";
        interview.evaluation = candidate.evaluation || "";
        interview.performanceScore =
          extractPerformanceScore(candidate.evaluation) || 0;
        interview.communicationEvaluation =
          candidate.communicationEvaluation || "";
        interview.trustScore = candidate.trustScore || 0;
        interview.rawReportPayload = candidate;
        interview.reportFetched = true;
        await interview.save();

        // Enrich CentralisedResume with interview results (non-blocking)
        _triggerCentralisedResumeEnrichment(interview).catch((err) =>
          console.error('[CentralisedResume] Enrichment failed (non-fatal):', err.message)
        );

        const evaluationPending = !interview.evaluation;
        return res.json({ completed: true, interview, evaluationPending });
      }
    } catch (err) {
      console.warn("Completion check failed:", err.message);
    }
  }

  res.json({ completed: false });
});

// ── Admin endpoints ──────────────────────────────────────────────────────

/**
 * Helper: Extract interview results and enrich the CentralisedResume.
 * Called asynchronously after an interview completes in checkCompletion.
 */
async function _triggerCentralisedResumeEnrichment(interview) {
  const userId = interview.user;
  if (!userId) return;

  // Parse evaluation to extract per-skill data
  let evalParsed = null;
  try {
    evalParsed = typeof interview.evaluation === "string"
      ? JSON.parse(interview.evaluation)
      : interview.evaluation;
  } catch {
    // If evaluation isn't parsable, still enrich with trust scores
  }

  const evalReport = evalParsed?.evaluation_report || {};
  const skillEvals = evalReport?.per_skill_evaluation || evalReport?.skill_evaluations || [];

  // Build skill results from evaluation
  const skillResults = [];
  if (Array.isArray(skillEvals)) {
    for (const se of skillEvals) {
      skillResults.push({
        skillName: se.skill_name || se.skillName || "General",
        score: se.score_percentage || se.score || 0,
        depthLevel: _scoreToDepth(se.score_percentage || se.score || 0),
        subTopicsCovered: se.topics_covered || se.subTopics || [],
        questionCount: se.question_count || se.questions_asked || 0,
      });
    }
  }

  // Extract strengths and weaknesses from evaluation
  const strengths = [];
  const weaknesses = [];
  if (evalReport.strengths && Array.isArray(evalReport.strengths)) {
    for (const s of evalReport.strengths) {
      strengths.push(typeof s === "string" ? s : s.area || s.description || "");
    }
  }
  if (evalReport.weaknesses && Array.isArray(evalReport.weaknesses)) {
    for (const w of evalReport.weaknesses) {
      weaknesses.push({
        area: typeof w === "string" ? w : w.area || w.description || "",
        suggestion: typeof w === "object" ? w.suggestion || w.improvement || "" : "",
      });
    }
  }

  // Compute duration from interview times
  let duration = 0;
  if (interview.interviewStartTime && interview.interviewEndTime) {
    duration = Math.round(
      (new Date(interview.interviewEndTime) - new Date(interview.interviewStartTime)) / 60000,
    );
  }

  // Parse cheating score
  const cheatingLikelihood = interview.cheatingScore?.likelihood_of_cheating || 0;

  await enrichFromInterview(userId, {
    interviewId: interview._id,
    skillResults,
    problemSolvingScore: evalReport.problem_solving_score || evalReport.overall_score_in_percentage || 0,
    communicationScore: _parseCommunicationScore(interview.communicationEvaluation),
    codeQualityScore: evalReport.code_quality_score || 0,
    trustScore: interview.trustScore || 0,
    cheatingLikelihood,
    recordingUrl: interview.rawReportPayload?.botRecordingUrl || "",
    transcriptUrl: "",
    evaluationSummary: evalReport.overall_feedback || evalReport.summary || "",
    duration,
    strengths,
    weaknesses,
  });
}

/**
 * Helper: Map a numeric score to a depth level.
 */
function _scoreToDepth(score) {
  if (score >= 85) return "EXPERT";
  if (score >= 65) return "ADVANCED";
  if (score >= 40) return "INTERMEDIATE";
  return "BEGINNER";
}

/**
 * Helper: Extract a numeric communication score from the communication evaluation string.
 */
function _parseCommunicationScore(commEval) {
  if (!commEval) return 0;
  try {
    const parsed = typeof commEval === "string" ? JSON.parse(commEval) : commEval;
    return parsed?.overall_communication_score || parsed?.score || 0;
  } catch {
    // Try to extract a number from the string
    const match = String(commEval).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

/**
 * Helper: safely parse evaluation JSON and extract overall score
 */
function extractPerformanceScore(evaluationStr) {
  if (!evaluationStr) return null;
  try {
    const parsed =
      typeof evaluationStr === "string"
        ? JSON.parse(evaluationStr)
        : evaluationStr;
    const score = parsed?.evaluation_report?.overall_score_in_percentage;
    return typeof score === "number" ? score : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/proctored/admin/all
 * Query: { page, limit, search, status, role, experience, minScore, maxScore, date }
 *
 * Returns lean, projected data with only the fields needed for the admin table.
 */
const adminGetAll = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, status, role, experience, minScore, maxScore, date } =
    req.query;

  // ── Stage 1: Pre-filter on indexed fields ──
  const preFilter = {};
  if (status && status !== "all") {
    const statuses = status
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length === 1) preFilter.status = statuses[0];
    else if (statuses.length > 1) preFilter.status = { $in: statuses };
  }
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      preFilter.schedule = { $gte: dayStart, $lte: dayEnd };
    }
  }

  const pipeline = [
    { $match: preFilter },
    { $sort: { createdAt: -1 } },
    // Join user data (only needed fields)
    {
      $lookup: {
        from: "users",
        let: { userId: "$user" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
          { $project: { name: 1, email: 1, resumeUrl: 1, resumeS3Key: 1 } },
        ],
        as: "userData",
      },
    },
    { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },
    // Join opening data (only needed fields)
    {
      $lookup: {
        from: "proctoredopenings",
        let: { openingId: "$opening" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$openingId"] } } },
          { $project: { title: 1, minExperience: 1, maxExperience: 1 } },
        ],
        as: "openingData",
      },
    },
    { $unwind: { path: "$openingData", preserveNullAndEmptyArrays: true } },
    // Join candidate data (only resume fields)
    {
      $lookup: {
        from: "proctoredcandidates",
        let: { candidateId: "$candidate" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$candidateId"] } } },
          { $project: { resumeUrl: 1, resumeS3Key: 1, resumeFileName: 1 } },
        ],
        as: "candidateData",
      },
    },
    { $unwind: { path: "$candidateData", preserveNullAndEmptyArrays: true } },
  ];

  // ── Stage 2: Post-join filters ──
  const postFilter = {};

  // Search across user name, email, and opening title
  if (search) {
    postFilter.$or = [
      { "userData.name": { $regex: search, $options: "i" } },
      { "userData.email": { $regex: search, $options: "i" } },
      { "openingData.title": { $regex: search, $options: "i" } },
      {
        "stepData.candidateDetails.firstName": {
          $regex: search,
          $options: "i",
        },
      },
      {
        "stepData.candidateDetails.lastName": { $regex: search, $options: "i" },
      },
    ];
  }

  // Role filter (multi-value)
  if (role) {
    const roles = role
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    if (roles.length > 0) {
      postFilter.$or = [
        ...(postFilter.$or || []),
        ...roles.map((r) => ({
          "openingData.title": { $regex: r, $options: "i" },
        })),
        ...roles.map((r) => ({
          "stepData.openingDetails.role": { $regex: r, $options: "i" },
        })),
      ];
      // When we have both search and role, we need an $and wrapper
      if (search) {
        const searchOr = [
          { "userData.name": { $regex: search, $options: "i" } },
          { "userData.email": { $regex: search, $options: "i" } },
          { "openingData.title": { $regex: search, $options: "i" } },
          {
            "stepData.candidateDetails.firstName": {
              $regex: search,
              $options: "i",
            },
          },
          {
            "stepData.candidateDetails.lastName": {
              $regex: search,
              $options: "i",
            },
          },
        ];
        const roleOr = [
          ...roles.map((r) => ({
            "openingData.title": { $regex: r, $options: "i" },
          })),
          ...roles.map((r) => ({
            "stepData.openingDetails.role": { $regex: r, $options: "i" },
          })),
        ];
        delete postFilter.$or;
        postFilter.$and = [{ $or: searchOr }, { $or: roleOr }];
      }
    }
  }

  // Experience filter
  if (experience) {
    const expValues = experience
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (expValues.length > 0) {
      const expConditions = expValues.map((e) => ({
        "stepData.openingDetails.experience": { $regex: e, $options: "i" },
      }));
      if (postFilter.$and) postFilter.$and.push({ $or: expConditions });
      else if (Object.keys(postFilter).length > 0) {
        const existing = { ...postFilter };
        Object.keys(existing).forEach((k) => delete postFilter[k]);
        postFilter.$and = [existing, { $or: expConditions }];
      } else {
        postFilter.$or = expConditions;
      }
    }
  }

  if (Object.keys(postFilter).length > 0) {
    pipeline.push({ $match: postFilter });
  }

  // ── Stage 3: Project only needed fields + compute performanceScore ──
  pipeline.push({
    $project: {
      _id: 1,
      status: 1,
      trustScore: 1,
      schedule: 1,
      interviewStartTime: 1,
      interviewEndTime: 1,
      evaluation: 1,
      createdAt: 1,
      interviewCompleted: 1,
      // Cheating score
      "cheatingScore.verdict": 1,
      "cheatingScore.likelihood_of_cheating": 1,
      // User info
      "userData._id": 1,
      "userData.name": 1,
      "userData.email": 1,
      // Opening info
      "openingData.title": 1,
      "openingData.minExperience": 1,
      "openingData.maxExperience": 1,
      // Candidate info (resume S3 key for proctored-interview-specific resume)
      "candidateData.resumeS3Key": 1,
      "candidateData.resumeFileName": 1,
      // Step data (selected fields only)
      "stepData.candidateDetails.firstName": 1,
      "stepData.candidateDetails.lastName": 1,
      "stepData.candidateDetails.experience": 1,
      "stepData.candidateDetails.experienceYears": 1,
      "stepData.openingDetails.role": 1,
      "stepData.openingDetails.experience": 1,
      // Raw payloads (selected fields only)
      "rawCandidatePayload.candidateFitScore": 1,
      "rawCandidatePayload.resumeFileNameInS3": 1,
      "rawReportPayload.botRecordingUrl": 1,
      "rawReportPayload.recordingDuration": 1,
      "rawReportPayload.concatenationId": 1,
      "rawReportPayload.organizationName": 1,
    },
  });

  // ── Stage 3b: Compute performanceScore from evaluation JSON in pipeline ──
  pipeline.push({
    $addFields: {
      performanceScore: {
        $cond: {
          if: {
            $and: [
              { $ne: ["$evaluation", ""] },
              { $ne: ["$evaluation", null] },
            ],
          },
          then: "$evaluation", // placeholder — we'll parse in JS after query
          else: null,
        },
      },
    },
  });

  // ── Stage 4: Sort, Count + paginate ──
  const countPipeline = [...pipeline, { $count: "total" }];
  const dataPipeline = [
    ...pipeline,
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ];

  const [countResult, rawInterviews] = await Promise.all([
    ProctoredInterview.aggregate(countPipeline),
    ProctoredInterview.aggregate(dataPipeline),
  ]);

  const total = countResult[0]?.total || 0;

  // Extract performance score from evaluation JSON and strip the raw evaluation string
  const interviews = rawInterviews.map((iv) => {
    const performanceScore = extractPerformanceScore(iv.evaluation);
    const { evaluation, ...rest } = iv;
    return { ...rest, performanceScore };
  });

  // ── Stage 5: Score-range filtering ──
  // Since evaluation is a JSON string (not indexable in Mongo), score
  // filtering must happen after JS extraction. When active, we re-count.
  const minS = minScore ? parseFloat(minScore) : null;
  const maxS = maxScore ? parseFloat(maxScore) : null;
  let filtered = interviews;
  if (minS !== null || maxS !== null) {
    filtered = interviews.filter((iv) => {
      if (iv.performanceScore === null) return false;
      if (minS !== null && iv.performanceScore < minS) return false;
      if (maxS !== null && iv.performanceScore > maxS) return false;
      return true;
    });
  }

  const finalTotal = minS !== null || maxS !== null ? filtered.length : total;

  res.json({
    interviews: filtered,
    total: finalTotal,
    page,
    pages: Math.ceil(finalTotal / limit),
  });
});

/**
 * GET /api/proctored/admin/stats
 * Returns aggregated statistics for proctored interviews.
 */
const adminGetStats = asyncHandler(async (req, res) => {
  const [totalResult, byStatusResult, statsAggregation] = await Promise.all([
    ProctoredInterview.countDocuments(),
    ProctoredInterview.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    ProctoredInterview.aggregate([
      { $match: { status: "COMPLETED", evaluation: { $ne: "" } } },
      {
        $group: {
          _id: null,
          topScorersAbove75: {
            $sum: {
              $cond: [{ $gte: ["$performanceScore", 75] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  // Build status map
  const byStatus = {};
  for (const item of byStatusResult) {
    byStatus[item._id] = item.count;
  }

  const stats = statsAggregation[0] || {
    topScorersAbove75: 0,
  };

  const meaningful =
    (byStatus.SCHEDULED || 0) +
    (byStatus.IN_PROGRESS || 0) +
    (byStatus.COMPLETED || 0);

  res.json({
    totalProctored: totalResult,
    byStatus,
    completionRate:
      meaningful > 0
        ? Math.round(((byStatus.COMPLETED || 0) / meaningful) * 100)
        : 0,
    topScorersAbove75: stats.topScorersAbove75 || 0,
  });
});

/**
 * GET /api/proctored/admin/roles
 * Returns distinct role titles used in proctored interviews.
 */
const adminGetRoles = asyncHandler(async (req, res) => {
  const roles = await ProctoredInterview.aggregate([
    {
      $lookup: {
        from: "proctoredopenings",
        localField: "opening",
        foreignField: "_id",
        as: "openingData",
      },
    },
    { $unwind: { path: "$openingData", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          $ifNull: ["$openingData.title", "$stepData.openingDetails.role"],
        },
      },
    },
    { $match: { _id: { $ne: null } } },
    { $sort: { _id: 1 } },
  ]);

  res.json({ roles: roles.map((r) => r._id) });
});

/**
 * GET /api/proctored/admin/:id
 * Returns full detail for a single proctored interview (for report/resume/recording actions).
 */
const adminGetDetail = asyncHandler(async (req, res) => {
  const interview = await ProctoredInterview.findById(req.params.id)
    .select(
      "-consentSignature -rawSchedulePayload -rawCandidatePayload -rawReportPayload.messages",
    )
    .populate(
      "opening",
      "title minExperience maxExperience isTechnical coreSkills",
    )
    .populate(
      "candidate",
      "firstName lastName email resumeS3Key resumeFileName",
    )
    .populate(
      "user",
      "name email phone experienceLevel currentRole targetRole",
    );

  if (!interview) {
    res.status(404);
    throw new Error("Proctored interview not found");
  }

  res.json({ interview });
});

/**
 * GET /api/proctored/admin/:id/resume
 * Returns a presigned S3 URL for the candidate's proctored-interview resume.
 * This is specifically the resume uploaded/used during the proctored interview,
 * NOT the user's registration resume.
 */
const adminGetResumeUrl = asyncHandler(async (req, res) => {
  const interview = await ProctoredInterview.findById(req.params.id)
    .select("candidate rawCandidatePayload.resumeFileNameInS3")
    .populate("candidate", "resumeS3Key resumeFileName");

  if (!interview) {
    res.status(404);
    throw new Error("Proctored interview not found");
  }

  // Priority: ProctoredCandidate.resumeS3Key (our S3 copy)
  const s3Key = interview.candidate?.resumeS3Key;
  if (!s3Key) {
    res.status(404);
    throw new Error("No resume available for this proctored interview");
  }

  const bucketParams = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
  };

  if (req.query.download === "true") {
    // Force browser to download instead of inline display
    const downloadName = interview.candidate?.resumeFileName || "resume.pdf";
    bucketParams.ResponseContentDisposition = `attachment; filename="${downloadName}"`;
  }

  const command = new GetObjectCommand(bucketParams);
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  res.json({
    url,
    fileName: interview.candidate?.resumeFileName || "resume.pdf",
  });
});

/**
 * GET /api/proctored/admin/:id/recording-urls
 * Resolves recording URLs server-side to avoid CORS issues with S3 HEAD requests.
 * Returns { type: 'bot'|'chime'|'combined'|'none', botUrl, chimeUrl, duration }
 */
const adminGetRecordingUrls = asyncHandler(async (req, res) => {
  const interview = await ProctoredInterview.findById(req.params.id)
    .select(
      "rawReportPayload.botRecordingUrl rawReportPayload.concatenationId rawReportPayload.organizationName rawReportPayload.recordingDuration rawReportPayload._id",
    )
    .lean();

  if (!interview) {
    res.status(404);
    throw new Error("Proctored interview not found");
  }

  const report = interview.rawReportPayload || {};
  const concatenationId = report.concatenationId || "";
  const botUrl = report.botRecordingUrl || "";
  const recordingDuration = report.recordingDuration || "";
  const orgName = report.organizationName || "";
  // The Zinterview report _id (not the ProctoredInterview _id)
  const reportId = report._id
    ? report._id.$oid || report._id.toString?.() || report._id
    : "";

  const organizationId =
    process.env.NODE_ENV === "production"
      ? process.env.ZINTERVIEW_PROD_ORGANIZATION_ID
      : process.env.ZINTERVIEW_LOCAL_ORGANIZATION_ID;

  // Helper: sanitize org name for S3 ARN path
  const sanitizeOrgName = (name) =>
    name
      ?.trim()
      .replace(/[^a-zA-Z0-9\-_.]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "";

  // Helper: check if a video URL exists via HEAD request
  const checkVideo = async (url) => {
    if (!url) return false;
    try {
      const response = await fetch(encodeURI(url), {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const ct = response.headers.get("content-type");
        return ct && ct.startsWith("video/");
      }
      return false;
    } catch {
      return false;
    }
  };

  // Determine S3 config based on environment
  const isProduction = process.env.NODE_ENV === "production";
  const s3Bucket = isProduction
    ? "zinterview-bot-singapore-s3"
    : "zinterview-bot-s3";
  const s3Region = isProduction ? "ap-southeast-1" : "us-east-1";

  let chimeUrl = "";

  // Resolve Chime recording URL if concatenationId exists
  if (concatenationId && reportId) {
    const sanitizedOrg = sanitizeOrgName(orgName);
    const s3SanitizedUrl = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/zinterview/${sanitizedOrg}/${reportId}/chime/composited-video/${concatenationId}.mp4`;
    const s3UnsanitizedUrl = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/zinterview/${orgName}/${reportId}/chime/composited-video/${concatenationId}.mp4`;
    const legacyUrl = `https://procturemeet.s3.ap-southeast-1.amazonaws.com/recordings/${reportId}/composited-video/${concatenationId}.mp4`;

    if (await checkVideo(s3SanitizedUrl)) {
      chimeUrl = s3SanitizedUrl;
    } else if (await checkVideo(s3UnsanitizedUrl)) {
      chimeUrl = s3UnsanitizedUrl;
    } else if (await checkVideo(legacyUrl)) {
      chimeUrl = legacyUrl;
    }
  }

  // Check if bot URL is valid
  const botUrlValid = botUrl ? await checkVideo(botUrl) : false;

  // Determine recording type
  let type = "none";
  if (botUrlValid && chimeUrl) {
    type = "combined";
  } else if (botUrlValid) {
    type = "bot";
  } else if (chimeUrl) {
    type = "chime";
  }

  res.json({
    type,
    botUrl: botUrlValid ? botUrl : "",
    chimeUrl,
    duration: recordingDuration,
    organizationId,
  });
});

module.exports = {
  getStatus,
  saveConsent,
  findOrCreateOpening,
  createCandidate,
  scheduleInterview,
  cancelInterview,
  rescheduleInterview,
  getReport,
  saveProgress,
  startOver,
  markInProgress,
  checkCompletion,
  resumeInterview,
  resetSession,
  adminGetAll,
  adminGetDetail,
  adminGetResumeUrl,
  adminGetRecordingUrls,
  adminGetStats,
  adminGetRoles,
};
