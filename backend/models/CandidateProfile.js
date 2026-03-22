const mongoose = require("mongoose");

/**
 * CandidateProfile — Pre-fill data for job applications.
 *
 * Stores candidate details that can be auto-filled into
 * application forms for faster repeat applications.
 */

const candidateProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      default: "",
    },
    firstName: {
      type: String,
      default: "",
    },
    lastName: {
      type: String,
      default: "",
    },
    preferredName: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    country: {
      type: String,
      default: "",
    },
    experience: {
      type: Number,
      default: 0,
    },
    linkedIn: {
      type: String,
      default: "",
    },
    portfolio: {
      type: String,
      default: "",
    },
    // Whether the user has consented to auto-fill on subsequent applies
    savedDetails: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "candidate_profiles",
  },
);

candidateProfileSchema.index({ userId: 1 });

const CandidateProfile = mongoose.model("CandidateProfile", candidateProfileSchema);

module.exports = CandidateProfile;
