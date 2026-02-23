const Interview = require("../models/Interview");
const { getAudioUrl } = require("../services/s3Service");

// Create new interview session
exports.createInterview = async (req, res) => {
  const { role, focusArea, level, language, history, totalQuestions } =
    req.body;

  try {
    const interview = await Interview.create({
      user: req.user._id,
      role,
      focusArea,
      level,
      language: language || "English",
      totalQuestions: totalQuestions || 7,
      status: "IN_PROGRESS",
      history: history || [],
    });
    res.status(201).json(interview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all non-deleted interviews for user
exports.getMyInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({
      user: req.user._id,
      isDeleted: false,
    })
      .select("-history -audioRecordings -tokenUsage.breakdown") // Exclude large fields
      .sort({ updatedAt: -1 })
      .lean();

    res.json(interviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single interview details
exports.getInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
      isDeleted: false,
    }).lean();

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Generate signed audio URLs on-the-fly for history items with audioS3Key
    if (interview.history && interview.history.length > 0) {
      await Promise.all(
        interview.history.map(async (item) => {
          if (item.audioS3Key) {
            try {
              item.audioUrl = await getAudioUrl(item.audioS3Key, 86400);
            } catch (err) {
              console.warn(
                `[getInterview] Failed to sign URL for ${item.audioS3Key}:`,
                err.message,
              );
            }
          }
        }),
      );
    }

    res.json(interview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update interview (Save progress or Complete)
exports.updateInterview = async (req, res) => {
  const { status, feedback, durationSeconds } = req.body;

  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Note: history is no longer updatable from this endpoint.
    // History is managed exclusively through aiController (chatStream).
    if (status) interview.status = status;
    if (feedback) interview.feedback = feedback;
    if (durationSeconds) interview.durationSeconds = durationSeconds;

    await interview.save();
    res.json(interview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Soft delete
exports.deleteInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    interview.isDeleted = true;
    await interview.save();
    res.json({ message: "Interview deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
