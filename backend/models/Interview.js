const mongoose = require("mongoose");

const AudioRecordingSchema = new mongoose.Schema(
  {
    s3Key: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: "audio/webm",
    },
    questionIndex: {
      type: Number, // Kept for backward compatibility, no longer required
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    interactionId: {
      type: String, // Primary linking ID: bridges history item and audio recording
    },
    historyId: {
      type: String, // MongoDB _id of the corresponding history message
    },
  },
  { _id: true },
);

// ── Embedded Message Schema (replaces Conversation collection) ──────
const MessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "model"],
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    audioS3Key: {
      type: String, // S3 object key for audio (user recording or AI TTS)
    },
    audioMimeType: {
      type: String, // MIME type of audio (e.g., "audio/webm", "audio/mp3")
    },
    audioDurationSeconds: {
      type: Number,
      default: 0,
    },
    questionIndex: {
      type: Number, // Which question this message corresponds to
    },
    metadata: {
      type: Map,
      of: String, // Extensible metadata (e.g., transcriptionSource, model)
    },
    interactionId: {
      type: String, // Unique frontend-generated ID linking to AudioRecording and S3
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const InterviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  focusArea: String,
  level: String,
  language: {
    type: String,
    default: "English",
  },
  totalQuestions: {
    type: Number,
    default: 7,
  },
  status: {
    type: String,
    enum: ["IN_PROGRESS", "COMPLETED", "ARCHIVED"],
    default: "IN_PROGRESS",
  },
  // history: [mongoose.Schema.Types.Mixed], // Supports legacy object structure AND new ObjectId references
  history: [MessageSchema],
  audioRecordings: [AudioRecordingSchema], // Kept for backward compatibility
  date: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  durationSeconds: {
    type: Number,
    default: 0,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  feedback: {
    overallScore: Number,
    communicationScore: Number,
    technicalScore: Number,
    strengths: [String],
    weaknesses: [String],
    suggestion: String,
  },
  tokenUsage: {
    totalInputTokens: { type: Number, default: 0 },
    totalOutputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 }, // in USD
    breakdown: [
      {
        timestamp: { type: Date, default: Date.now },
        operation: String, // 'chat', 'feedback', 'resume_analysis', 'tts'
        model: String,
        inputTokens: Number,
        outputTokens: Number,
        cost: Number,
      },
    ],
  },
});

InterviewSchema.index({ user: 1, date: -1 });
InterviewSchema.index({ status: 1, date: -1 });
InterviewSchema.index({ date: -1 });
InterviewSchema.index({ user: 1, isDeleted: 1, updatedAt: -1 });

InterviewSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model("Interview", InterviewSchema);
