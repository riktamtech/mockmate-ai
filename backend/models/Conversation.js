const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  interviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Interview",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ["user", "model"],
    required: true,
  },
  content: {
    type: String, // Plain text content (for display / transcript)
  },
  parts: [
    {
      text: String,
      inlineData: {
        mimeType: String,
        data: String, // S3 key reference (not raw base64)
      },
    },
  ],
  s3Key: {
    type: String, // S3 object key — signed URLs generated on demand
  },
  contentType: {
    type: String, // MIME type of stored audio (e.g., "audio/mp3", "audio/webm")
  },
  audioUrl: {
    type: String, // Public/Signed URL for playback (if applicable)
  },
  metadata: {
    type: Map,
    of: String, // Extensible metadata (e.g. { method: 'web-speech', model: 'gemini-1.5' })
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true, // Useful for sorting chronological order
  },
});

// Compound index for fast sorted lookups by interview
ConversationSchema.index({ interviewId: 1, createdAt: 1 });

module.exports = mongoose.model("Conversation", ConversationSchema);
