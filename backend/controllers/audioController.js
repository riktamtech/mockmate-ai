const mongoose = require("mongoose");
const Interview = require("../models/Interview");
const {
  uploadResponseAudio,
  getAudioUrl,
  deleteAudio,
} = require("../services/s3Service");
const { transcribeWithGemini } = require("../services/transcriptionService");

/**
 * Upload audio recording for an interview response
 * POST /api/audio/upload
 */
exports.uploadAudioRecording = async (req, res) => {
  try {
    const {
      interviewId,
      questionIndex,
      durationSeconds,
      transcript,
      historyId,
      interactionId,
    } = req.body;
    const audioFile = req.file;

    // ── Input Validation ──────────────────────────────────────────
    if (!audioFile || !audioFile.buffer || audioFile.buffer.length === 0) {
      return res
        .status(400)
        .json({ message: "No audio file provided or file is empty" });
    }

    if (!interviewId) {
      return res.status(400).json({ message: "Interview ID is required" });
    }

    const parsedQuestionIndex = Number(questionIndex);
    const parsedDuration = Number(durationSeconds) || 0;

    if (isNaN(parsedQuestionIndex) || parsedQuestionIndex < 0) {
      return res.status(400).json({ message: "Invalid question index" });
    }

    // ── Security Check ────────────────────────────────────────────
    const interview = await Interview.findOne({
      _id: interviewId,
      user: req.user._id,
    });

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // 1. Upload to S3
    const audioData = await uploadResponseAudio(
      audioFile.buffer,
      audioFile.mimetype,
      interviewId,
      parsedQuestionIndex,
      parsedDuration,
    );

    // 2. Determine Transcript
    let finalTranscript = transcript;

    // If frontend didn't provide a transcript (Web Speech failed/unsupported), use Backend Fallback
    if (
      !finalTranscript ||
      finalTranscript === "null" ||
      finalTranscript === "undefined" ||
      finalTranscript.trim() === ""
    ) {
      console.log(
        `[AudioUpload] No frontend transcript. Falling back to Gemini for Interview ${interviewId}`,
      );
      finalTranscript = await transcribeWithGemini(
        audioFile.buffer,
        audioFile.mimetype,
      );
    }

    // 3. Find the matching user message in embedded history and update it
    // The user message was already pushed by chatStream — we update it with audio details.
    // Re-read the document fresh to avoid stale data (chatStream may have pushed messages
    // after our initial read above).
    const freshInterview = await Interview.findById(interviewId)
      .select("history")
      .lean();
    const historyLength = freshInterview
      ? freshInterview.history.length
      : interview.history.length;
    const historyToSearch = freshInterview
      ? freshInterview.history
      : interview.history;
    let targetIndex = -1;

    // Priority 1: Exact match using custom frontend interactionId
    if (interactionId) {
      for (let i = historyLength - 1; i >= 0; i--) {
        const item = historyToSearch[i];
        if (item.interactionId === interactionId) {
          targetIndex = i;
          break;
        }
      }
    }

    // Secondary: find user message by historyId (_id)
    if (targetIndex === -1 && historyId) {
      for (let i = historyLength - 1; i >= 0; i--) {
        const item = historyToSearch[i];
        if (item._id?.toString() === historyId) {
          targetIndex = i;
          break;
        }
      }
    }

    // Secondary: find user message by questionIndex field
    if (targetIndex === -1) {
      for (let i = historyLength - 1; i >= 0; i--) {
        const item = historyToSearch[i];
        if (
          item.role === "user" &&
          item.questionIndex === parsedQuestionIndex
        ) {
          targetIndex = i;
          break;
        }
      }
    }

    // Fallback: find the most recent user message without an audioS3Key
    if (targetIndex === -1) {
      for (let i = historyLength - 1; i >= 0; i--) {
        const item = historyToSearch[i];
        if (item.role === "user" && !item.audioS3Key) {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex !== -1) {
      const setData = {
        [`history.${targetIndex}.audioS3Key`]: audioData.s3Key,
        [`history.${targetIndex}.audioMimeType`]: audioFile.mimetype,
        [`history.${targetIndex}.audioDurationSeconds`]: parsedDuration,
        [`history.${targetIndex}.questionIndex`]: parsedQuestionIndex,
        updatedAt: new Date(),
      };

      if (finalTranscript) {
        setData[`history.${targetIndex}.content`] = finalTranscript;
      }

      await Interview.updateOne({ _id: interview._id }, { $set: setData });
    } else {
      console.warn(
        `[AudioUpload] Could not find matching user message in history for question ${parsedQuestionIndex}`,
      );
      // Log warning but no fallback — transcript will be in history once chatStream runs
      if (finalTranscript) {
        console.warn(
          `[AudioUpload] Transcript available but no history item found for question ${parsedQuestionIndex}`,
        );
      }
    }

    // 4. Update audioRecordings array
    const recordingId = new mongoose.Types.ObjectId();

    // Capture the historyId from the matched history item for precise linking
    let matchedHistoryId = null;
    if (targetIndex !== -1) {
      const matchedItem = historyToSearch[targetIndex];
      matchedHistoryId = matchedItem?._id?.toString() || null;
    }

    const newRecording = {
      _id: recordingId,
      s3Key: audioData.s3Key,
      mimeType: audioData.mimeType,
      questionIndex: audioData.questionIndex,
      durationSeconds: audioData.durationSeconds,
      uploadedAt: audioData.uploadedAt,
    };
    // interactionId is the primary link between history and audioRecording
    if (interactionId) newRecording.interactionId = interactionId;
    // historyId provides a direct reference to the history message _id
    if (matchedHistoryId) newRecording.historyId = matchedHistoryId;

    // Always push the new recording instead of overwriting based on questionIndex.
    // Overwriting by questionIndex deleted earlier responses (like asking to repeat a question)
    // that happened to share the same index.
    await Interview.updateOne(
      { _id: interview._id },
      {
        $push: { audioRecordings: newRecording },
        $set: { updatedAt: new Date() },
      },
    );

    res.status(201).json({
      message: "Audio uploaded and saved successfully",
      transcript: finalTranscript,
      audioRecording: {
        s3Key: audioData.s3Key,
        questionIndex: audioData.questionIndex,
        durationSeconds: audioData.durationSeconds,
        id: recordingId,
      },
    });
  } catch (error) {
    console.error("[AudioUpload] Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get signed URL for an audio recording (on-demand).
 * GET /api/audio/:interviewId/:recordingId
 */
exports.getAudioPlaybackUrl = async (req, res) => {
  try {
    const { interviewId, recordingId } = req.params;

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const recording = interview.audioRecordings.id(recordingId);

    if (!recording) {
      return res.status(404).json({ message: "Recording not found" });
    }

    if (!recording.s3Key) {
      return res
        .status(404)
        .json({ message: "No audio file associated with this recording" });
    }

    // Generate a fresh 1-hour signed URL
    const url = await getAudioUrl(recording.s3Key, 86400);

    res.json({ url, recording });
  } catch (error) {
    console.error("[GetAudioURL] Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all audio recordings for an interview (Admin).
 * GET /api/audio/interview/:interviewId
 */
exports.getInterviewAudioRecordings = async (req, res) => {
  try {
    const { interviewId } = req.params;

    const interview = await Interview.findById(interviewId).populate(
      "user",
      "name email",
    );

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Generate fresh signed URLs for all recordings with valid s3Keys
    const recordingsWithUrls = await Promise.all(
      interview.audioRecordings
        .filter((recording) => recording.s3Key) // Skip recordings without s3Key
        .map(async (recording) => {
          try {
            const url = await getAudioUrl(recording.s3Key, 86400);
            return {
              id: recording._id,
              questionIndex: recording.questionIndex,
              durationSeconds: recording.durationSeconds,
              mimeType: recording.mimeType,
              uploadedAt: recording.uploadedAt,
              url,
            };
          } catch (err) {
            console.error(
              `[GetRecordings] Failed to sign URL for ${recording.s3Key}:`,
              err.message,
            );
            return null;
          }
        }),
    );

    res.json({
      interviewId: interview._id,
      user: interview.user,
      role: interview.role,
      status: interview.status,
      recordings: recordingsWithUrls.filter(Boolean),
    });
  } catch (error) {
    console.error("[GetRecordings] Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete an audio recording.
 * DELETE /api/audio/:interviewId/:recordingId
 */
exports.deleteAudioRecording = async (req, res) => {
  try {
    const { interviewId, recordingId } = req.params;

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const recording = interview.audioRecordings.id(recordingId);

    if (!recording) {
      return res.status(404).json({ message: "Recording not found" });
    }

    // Delete from S3 (gracefully handles missing key)
    if (recording.s3Key) {
      await deleteAudio(recording.s3Key);
    }

    // Remove from interview document
    interview.audioRecordings.pull(recordingId);
    await interview.save();

    res.json({ message: "Recording deleted successfully" });
  } catch (error) {
    console.error("[DeleteAudio] Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Transcribe audio using Gemini (dedicated endpoint for real-time UI updates).
 * POST /api/audio/transcribe
 */
exports.transcribeAudio = async (req, res) => {
  try {
    const audioFile = req.file;

    if (!audioFile || !audioFile.buffer || audioFile.buffer.length === 0) {
      return res
        .status(400)
        .json({ message: "No audio file provided or file is empty" });
    }

    console.log(
      `[Transcribe] Processing ${(audioFile.buffer.length / 1024).toFixed(1)} KB audio`,
    );

    const transcript = await transcribeWithGemini(
      audioFile.buffer,
      audioFile.mimetype,
    );

    res.json({ transcript: transcript || "[Silent]" });
  } catch (error) {
    console.error("[Transcribe] Error:", error);
    res.status(500).json({ message: error.message });
  }
};
