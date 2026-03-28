const mongoose = require("mongoose");

const SkillGroupSchema = new mongoose.Schema(
  {
    skillGroupName: { type: String, required: true },
    skills: [{ type: String }],
    criteria: { type: Number, default: 2 }, // 1=all required, 2=at least one, 3=none required
    weight: { type: Number, default: 1 },
  },
  { _id: false },
);

const ProctoredOpeningSchema = new mongoose.Schema(
  {
    // Zinterview reference
    zinterviewOpeningId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    organizationId: { type: String, required: true, index: true },

    // Core opening details
    title: { type: String, required: true },
    description: { type: String, default: "" },
    isTechnical: { type: Boolean, default: true },
    minExperience: { type: Number, default: 0 },
    maxExperience: { type: Number, default: 20 },

    // Skills & requirements
    skillsGroup: [SkillGroupSchema],
    coreSkills: [{ type: String }],
    jobRequirementsAndResponsibilities: [{ type: String }],
    interviewGuidelines: { type: String, default: "" },

    // Interview configuration
    maxQuestions: { type: Number, default: 12 },
    proctoring: { type: Boolean, default: true },
    isCodeEditorRequired: { type: Boolean, default: false },
    avatarMode: { type: Boolean, default: true },
    questionsBasedOnResume: { type: Boolean, default: true },
    isMobileInterviewAllowed: { type: Boolean, default: false },
    isRecordingEnabled: { type: Boolean, default: true },
    isCandidatePhotoRequired: { type: Boolean, default: true },
    isFaceMatchRequired: { type: Boolean, default: false },
    isSecondaryCameraRequired: { type: Boolean, default: false },
    editResponses: { type: Boolean, default: false },

    // Question configuration
    languageOfQuestions: { type: String, default: "en" },
    languageOfAnswers: { type: String, default: "en" },
    interviewMode: { type: String, default: "TRADITIONAL" },
    scoringLeniency: { type: Number, default: 2 },
    askIntroQuestion: { type: Boolean, default: true },
    askDailyWorkToolsQuestion: { type: Boolean, default: true },
    mixOfBothQuestions: { type: Boolean, default: true },
    isFollowUpQuestionsRequired: { type: Boolean, default: true },
    numberOfResumeBasedQuestions: { type: Number, default: 2 },
    autoSkipQTimeoutS: { type: Number, default: 60 },

    // Support & notifications
    allowSupportContact: { type: Boolean, default: true },
    supportPhone: { type: String, default: "+91 8000926262" },
    supportEmail: { type: String, default: "support@zinterview.ai" },
    supportName: { type: String, default: "" },
    emailRecipients: [{ type: String }],

    // Business context
    businessContext: { type: String, default: "" },

    // Status
    status: { type: Boolean, default: true },
    interviewReportsCount: { type: Number, default: 0 },

    // Full Zinterview response (for extensibility)
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  },
);

// Compound index for fast opening matching
ProctoredOpeningSchema.index({ organizationId: 1, title: 1 });
ProctoredOpeningSchema.index({ organizationId: 1, isTechnical: 1 });

module.exports = mongoose.model("ProctoredOpening", ProctoredOpeningSchema);
