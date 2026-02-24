const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const User = require("../models/User");
const Interview = require("../models/Interview");
const { getAudioBuffer, getAudioUrl } = require("../services/s3Service");

// Filter to IDENTIFY test users (inverted logic for optimization)
const TEST_USER_REGEX = /(@riktamtech\.com$|test|example)/i;

// @desc    Get admin stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getStats = asyncHandler(async (req, res) => {
  const testUsers = await User.find({
    $or: [{ email: { $regex: TEST_USER_REGEX } }, { isTestUser: true }],
  })
    .select("_id")
    .lean();

  const testUserIds = testUsers.map((u) => u._id);

  const [validUserCount, interviewStats, tokenStats] = await Promise.all([
    User.countDocuments({
      email: { $not: { $regex: TEST_USER_REGEX } },
      isTestUser: { $ne: true },
    }),

    Interview.aggregate([
      {
        $match:
          process.env.NODE_ENV === "production"
            ? { user: { $nin: testUserIds } }
            : {},
      },
      {
        $facet: {
          totalInterviews: [{ $count: "count" }],
          interviewsByStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ],
          activeUsers: [{ $group: { _id: "$user" } }, { $count: "count" }],
        },
      },
    ]),
    Interview.aggregate([
      {
        $match:
          process.env.NODE_ENV === "production"
            ? { user: { $nin: testUserIds } }
            : {},
      },
      {
        $group: {
          _id: null,
          totalInputTokens: { $sum: "$tokenUsage.totalInputTokens" },
          totalOutputTokens: { $sum: "$tokenUsage.totalOutputTokens" },
          totalTokens: { $sum: "$tokenUsage.totalTokens" },
          totalCost: { $sum: "$tokenUsage.estimatedCost" },
        },
      },
    ]),
  ]);

  const stats = interviewStats[0] || {};
  const tokens = tokenStats[0] || {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
  };

  const interviewsByStatus = (stats.interviewsByStatus || []).reduce(
    (acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    },
    {},
  );

  res.json({
    totalUsers: validUserCount,
    totalInterviews: stats.totalInterviews?.[0]?.count || 0,
    activeUsersCount: stats.activeUsers?.[0]?.count || 0,
    interviewsByStatus,
    tokenStats: tokens,
  });
});

// @desc    Get all users with pagination
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const pageSize = 10;
  const page = Number(req.query.page) || 1;

  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};

  const [count, users] = await Promise.all([
    User.countDocuments(keyword),
    User.aggregate([
      { $match: keyword },
      {
        $addFields: {
          isRegexMatch: {
            $regexMatch: {
              input: "$email",
              regex: TEST_USER_REGEX.source,
              options: "i",
            },
          },
        },
      },
      {
        $sort: {
          isTestUser: 1,
          isRegexMatch: 1,
          createdAt: -1,
        },
      },
      { $skip: pageSize * (page - 1) },
      { $limit: pageSize },
      { $project: { password: 0, isRegexMatch: 0 } },
    ]),
  ]);

  if (users.length > 0) {
    const userIds = users.map((u) => u._id);

    const interviewStats = await Interview.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: "$user",
          interviewCount: { $sum: 1 },
          lastInterviewDate: { $max: "$date" },
        },
      },
    ]);

    const statsMap = new Map(interviewStats.map((s) => [s._id.toString(), s]));

    for (const user of users) {
      const stat = statsMap.get(user._id.toString());
      user.interviewCount = stat?.interviewCount || 0;
      user.lastInterviewDate = stat?.lastInterviewDate || null;
    }
  }

  res.json({
    users,
    page,
    pages: Math.ceil(count / pageSize),
    totalUsers: count,
  });
});

// @desc    Get specific user details and interviews
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserDetails = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password").lean();

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const interviews = await Interview.find({ user: user._id })
    .select("-history -audioRecordings -tokenUsage.breakdown") // Exclude blobs
    .sort({ date: -1 })
    .lean();

  res.json({ user, interviews });
});

// @desc    Get all interviews with pagination and filtering
// @route   GET /api/admin/interviews
// @access  Private/Admin
const getAllInterviews = asyncHandler(async (req, res) => {
  const pageSize = 20;
  const page = Number(req.query.page) || 1;
  const matchConditions = {};

  if (req.query.status && req.query.status !== "all") {
    matchConditions.status = req.query.status;
  }

  if (req.query.search) {
    const users = await User.find({
      $or: [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();

    if (users.length === 0) {
      return res.json({ interviews: [], page, pages: 0, totalInterviews: 0 });
    }

    matchConditions.user = { $in: users.map((u) => u._id) };
  }

  const [totalInterviews, interviews] = await Promise.all([
    Interview.countDocuments(matchConditions),
    Interview.find(matchConditions)
      .sort({ date: -1 })
      .skip(pageSize * (page - 1))
      .limit(pageSize)
      .populate("user", "name email")
      .select("-history -audioRecordings -tokenUsage.breakdown")
      .lean(),
  ]);

  res.json({
    interviews,
    page,
    pages: Math.ceil(totalInterviews / pageSize),
    totalInterviews,
  });
});

// @desc    Get interview details by ID (Admin)
// @route   GET /api/admin/interviews/:id
// @access  Private/Admin
const getInterviewDetails = asyncHandler(async (req, res) => {
  const interview = await Interview.findById(req.params.id)
    .populate("user", "name email")
    .lean();

  if (!interview) {
    res.status(404);
    throw new Error("Interview not found");
  }

  // ── Build audioRecordings lookup by interactionId for cross-referencing ──
  const audioByInteractionId = new Map();
  const audioByHistoryId = new Map();
  if (interview.audioRecordings && interview.audioRecordings.length > 0) {
    for (const rec of interview.audioRecordings) {
      if (rec.interactionId) {
        audioByInteractionId.set(rec.interactionId, rec);
      }
      if (rec.historyId) {
        audioByHistoryId.set(rec.historyId, rec);
      }
    }
  }

  // ── Generate signed audio URLs for all history items ─────────────────
  if (interview.history && interview.history.length > 0) {
    await Promise.all(
      interview.history.map(async (msg) => {
        // If message already has audioS3Key, sign it
        if (msg.audioS3Key) {
          try {
            msg.audioUrl = await getAudioUrl(msg.audioS3Key, 86400);
          } catch (err) {
            console.warn(
              `[Admin] Failed to sign URL for ${msg.audioS3Key}:`,
              err.message,
            );
          }
        } else if (msg.role === "user") {
          // Backfill from audioRecordings using interactionId (primary) or historyId
          const recording =
            (msg.interactionId &&
              audioByInteractionId.get(msg.interactionId)) ||
            audioByHistoryId.get(msg._id?.toString());

          if (recording && recording.s3Key) {
            try {
              msg.audioUrl = await getAudioUrl(recording.s3Key, 86400);
              msg.audioS3Key = recording.s3Key;
              msg.audioMimeType = recording.mimeType;
            } catch (err) {
              console.warn(
                `[Admin] Failed to sign URL for ${recording.s3Key}:`,
                err.message,
              );
            }
          }
        }
      }),
    );
  }

  res.json(interview);
});

// @desc    Transcribe interview audio (persist frontend transcriptions or Gemini fallback)
// @route   POST /api/admin/interviews/:id/transcribe
// @access  Private/Admin
const transcribeInterviewAudio = asyncHandler(async (req, res) => {
  const { historyIds, transcriptions: frontendTranscriptions } = req.body;

  const interview = await Interview.findById(req.params.id);
  if (!interview) {
    res.status(404);
    throw new Error("Interview not found");
  }

  const results = {};

  // ── Mode 1: Persist frontend-generated transcriptions ──
  // Expected: frontendTranscriptions = { "699d...": "text" }
  if (
    frontendTranscriptions &&
    Object.keys(frontendTranscriptions).length > 0
  ) {
    const updateOps = {};
    for (const [histId, text] of Object.entries(frontendTranscriptions)) {
      if (!text || text.trim() === "") continue;

      results[histId] = text;

      // Update the EXACT history message safely
      for (let i = 0; i < interview.history.length; i++) {
        const msg = interview.history[i];
        if (msg._id && msg._id.toString() === histId) {
          updateOps[`history.${i}.content`] = text;
          break;
        }
      }
    }

    if (Object.keys(updateOps).length > 0) {
      updateOps.updatedAt = new Date();
      await Interview.updateOne({ _id: interview._id }, { $set: updateOps });
    }

    return res.json({ transcriptions: results });
  }

  // ── Mode 2: Backend Gemini fallback ────
  const { transcribeWithGemini } = require("../services/transcriptionService");

  // If no explicit array provided, find ALL user messages that have audio but lack valid content
  let indicesToProcess = historyIds;
  if (!indicesToProcess || indicesToProcess.length === 0) {
    indicesToProcess = [];
    for (const msg of interview.history) {
      if (msg.role === "user" && (msg.audioS3Key || msg.audioUrl)) {
        const isPlaceholder =
          msg.content ===
            "Please evaluate my answer and ask the next question." ||
          msg.content === "🎤 Audio Answer Submitted";

        if (!msg.content || isPlaceholder) {
          indicesToProcess.push({
            historyId: msg._id.toString(),
            interactionId: msg.interactionId || null,
          });
        }
      }
    }
  }

  const CONCURRENCY_LIMIT = 5;
  const queue = [...indicesToProcess];

  const processItem = async (item) => {
    const histId =
      typeof item === "object" && item !== null ? item.historyId : item;
    const intId =
      typeof item === "object" && item !== null ? item.interactionId : null;

    // Find the exact message. Priority 1: interactionId. Priority 2: historyId.
    let msgIndex = -1;
    if (intId) {
      msgIndex = interview.history.findIndex((m) => m.interactionId === intId);
    }
    if (msgIndex === -1 && histId) {
      msgIndex = interview.history.findIndex(
        (m) => m._id && m._id.toString() === histId,
      );
    }

    if (msgIndex === -1) return;
    const msg = interview.history[msgIndex];

    const s3Key =
      msg.audioS3Key ||
      (interview.audioRecordings || []).find(
        (r) => r.s3Key && r.s3Key.includes(msg.audioUrl),
      )?.s3Key;
    if (!s3Key) return;

    try {
      console.log(
        `[Transcribe] Gemini fallback for Interview ${interview._id}, HistoryID: ${histId}`,
      );
      const audioBuffer = await getAudioBuffer(s3Key);
      if (!audioBuffer) return;

      const text = await transcribeWithGemini(
        audioBuffer,
        msg.audioMimeType || "audio/webm",
      );

      if (text) {
        const setOps = {
          [`history.${msgIndex}.content`]: text,
          updatedAt: new Date(),
        };

        await Interview.updateOne({ _id: interview._id }, { $set: setOps });
        results[histId] = text;
      }
    } catch (err) {
      console.error(
        `[Transcribe] Failed for HistoryID: ${histId}:`,
        err.message,
      );
      results[histId] = "[Transcription failed]";
    }
  };

  const processBatch = async () => {
    while (queue.length > 0) {
      const batch = queue.splice(0, CONCURRENCY_LIMIT);
      await Promise.allSettled(batch.map((qIdx) => processItem(qIdx)));
    }
  };

  await processBatch();

  res.json({ transcriptions: results });
});

// @desc    Get user growth data (last 7 days)
// @route   GET /api/admin/user-growth
// @access  Private/Admin
const getUserGrowth = asyncHandler(async (req, res) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const dailyCounts = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo },
        email: { $not: { $regex: TEST_USER_REGEX } },
        isTestUser: { $ne: true },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
  ]);

  const countMap = new Map(
    dailyCounts.map((d) => [
      `${d._id.year}-${d._id.month}-${d._id.day}`,
      d.count,
    ]),
  );

  const result = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(sevenDaysAgo);
    date.setDate(sevenDaysAgo.getDate() + i);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const label = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    result.push({ date: label, count: countMap.get(key) || 0 });
  }

  res.json(result);
});

// @desc    Proxy S3 audio stream (avoids browser CORS issues)
// @route   GET /api/admin/interviews/:id/audio/:questionIndex
// @access  Private/Admin
const proxyAudioStream = asyncHandler(async (req, res) => {
  const { id, questionIndex } = req.params;
  const qIdx = Number(questionIndex);

  const interview = await Interview.findById(id).lean();
  if (!interview) {
    res.status(404);
    throw new Error("Interview not found");
  }

  // Build audioRecordings lookup by interactionId/historyId
  const audioByInteractionId = new Map();
  const audioByHistoryId = new Map();
  if (interview.audioRecordings) {
    for (const rec of interview.audioRecordings) {
      if (rec.interactionId) audioByInteractionId.set(rec.interactionId, rec);
      if (rec.historyId) audioByHistoryId.set(rec.historyId, rec);
    }
  }

  // Try embedded history first — find the user message at the given question index
  if (interview.history && interview.history.length > 0) {
    let userIdx = 0;
    for (const msg of interview.history) {
      if (msg.role === "user") {
        userIdx++;
        if (userIdx === qIdx) {
          // Priority 1: Direct audioS3Key on the history item
          if (msg.audioS3Key) {
            const { streamAudioToResponse } = require("../services/s3Service");
            return streamAudioToResponse(msg.audioS3Key, res);
          }
          // Priority 2: Match via interactionId from audioRecordings
          const recording =
            (msg.interactionId &&
              audioByInteractionId.get(msg.interactionId)) ||
            audioByHistoryId.get(msg._id?.toString());
          if (recording && recording.s3Key) {
            const { streamAudioToResponse } = require("../services/s3Service");
            return streamAudioToResponse(recording.s3Key, res);
          }
        }
      }
    }
  }

  // Fallback: try audioRecordings sorted by uploadedAt (legacy)
  const recordings = (interview.audioRecordings || [])
    .filter((r) => r.s3Key)
    .sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));

  if (recordings[qIdx - 1]) {
    const { streamAudioToResponse } = require("../services/s3Service");
    return streamAudioToResponse(recordings[qIdx - 1].s3Key, res);
  }

  res.status(404).json({ message: "Audio recording not found" });
});

// @desc    Generate TTS audio for a history message on-demand (fallback if background TTS failed)
// @route   POST /api/admin/interviews/:id/tts-fallback
// @access  Private/Admin
const generateTtsForHistory = asyncHandler(async (req, res) => {
  const { historyId } = req.body;

  if (!historyId) {
    res.status(400);
    throw new Error("historyId is required");
  }

  const interview = await Interview.findById(req.params.id);
  if (!interview) {
    res.status(404);
    throw new Error("Interview not found");
  }

  // Find the history item
  const msgIndex = interview.history.findIndex(
    (m) => m._id && m._id.toString() === historyId,
  );

  if (msgIndex === -1) {
    res.status(404);
    throw new Error("History message not found");
  }

  const msg = interview.history[msgIndex];

  // If audio already exists, just return the signed URL
  if (msg.audioS3Key) {
    const audioUrl = await getAudioUrl(msg.audioS3Key, 86400);
    return res.json({ audioUrl, isCached: true });
  }

  // Need text content to generate TTS
  const extractedContent =
    msg.content ||
    (msg.parts && msg.parts.length > 0 ? msg.parts[0].text : null);
  if (!extractedContent || extractedContent.trim() === "") {
    res.status(400);
    throw new Error("No text content available for TTS generation");
  }

  // Generate TTS
  const ttsService = require("../services/ttsService");
  const { uploadAIResponseAudio } = require("../services/s3Service");

  const ttsBuffer = await ttsService.synthesizeFull(
    extractedContent,
    interview.language || "English",
  );

  if (!ttsBuffer || ttsBuffer.length === 0) {
    res.status(500);
    throw new Error("TTS generation failed");
  }

  // Upload to S3 and update history
  const uploadResult = await uploadAIResponseAudio(
    ttsBuffer,
    interview._id.toString(),
    msg.questionIndex || 0,
    "audio/mp3",
  );

  if (uploadResult?.s3Key) {
    await Interview.updateOne(
      { _id: interview._id, "history._id": msg._id },
      {
        $set: {
          "history.$.audioS3Key": uploadResult.s3Key,
          "history.$.audioMimeType": "audio/mp3",
          updatedAt: new Date(),
          ...(msg.interactionId
            ? {
                "history.$.interactionId": msg.interactionId,
              }
            : {}),
        },
        $push: {
          audioRecordings: {
            _id: new mongoose.Types.ObjectId(),
            s3Key: uploadResult.s3Key,
            mimeType: "audio/mp3",
            questionIndex: msg.questionIndex || 0,
            durationSeconds: 0,
            uploadedAt: new Date(),
            ...(msg.interactionId && { interactionId: msg.interactionId }),
            historyId: msg._id.toString(),
          },
        },
      },
    );

    const audioUrl = await getAudioUrl(uploadResult.s3Key, 86400);
    return res.json({ audioUrl, isCached: false });
  }

  res.status(500);
  throw new Error("Failed to upload TTS audio to S3");
});

module.exports = {
  getStats,
  getUsers,
  getUserDetails,
  getAllInterviews,
  getInterviewDetails,
  getUserGrowth,
  transcribeInterviewAudio,
  proxyAudioStream,
  generateTtsForHistory,
};
