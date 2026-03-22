const mongoose = require("mongoose");

/**
 * CandidateResume — LRU cache of 5 most recent resumes per user.
 *
 * Maintains a rolling list of the candidate's recent resume uploads
 * to provide quick resume selection during job applications.
 */

const MAX_RESUMES = 5;

const resumeEntrySchema = new mongoose.Schema(
  {
    resumeKey: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: "application/pdf",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    // Cached parsed data
    parsedText: {
      type: String,
      default: "",
      select: false, // Don't return by default (large field)
    },
  },
  { _id: true },
);

const candidateResumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    resumes: {
      type: [resumeEntrySchema],
      default: [],
      validate: {
        validator: function (arr) {
          return arr.length <= MAX_RESUMES;
        },
        message: `Maximum of ${MAX_RESUMES} resumes can be stored.`,
      },
    },
    defaultResumeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "candidate_resumes",
  },
);

/**
 * Add a resume to the LRU cache.
 * If at capacity, removes the oldest resume.
 */
candidateResumeSchema.methods.addResume = function (resumeData) {
  // Remove oldest if at capacity
  if (this.resumes.length >= MAX_RESUMES) {
    this.resumes.sort((a, b) => a.uploadedAt - b.uploadedAt);
    this.resumes.shift();
  }
  this.resumes.push(resumeData);
  // Set as default if it's the first resume
  if (this.resumes.length === 1) {
    this.defaultResumeId = this.resumes[0]._id;
  }
};

candidateResumeSchema.statics.MAX_RESUMES = MAX_RESUMES;

const CandidateResume = mongoose.model("CandidateResume", candidateResumeSchema);

module.exports = CandidateResume;
