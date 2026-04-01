const mongoose = require("mongoose");

/**
 * AppConfig — Singleton application configuration document.
 *
 * Uses a fixed _id ("app_config") so there's exactly one document.
 * Stores TTS service flags and other app-wide settings.
 */

const TTS_SERVICES = ["edge-tts", "google-tts", "web-speech-api", "gemini-tts"];

const serviceStatusSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    lastFailureAt: { type: Date, default: null },
    failureReason: { type: String, default: "" },
  },
  { _id: false },
);

const appConfigSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "app_config" },
    tts: {
      // Current active TTS service (highest priority that is still enabled)
      activeService: {
        type: String,
        enum: TTS_SERVICES,
        default: "edge-tts",
      },
      // Per-service status tracking
      services: {
        type: Map,
        of: serviceStatusSchema,
        default: () =>
          new Map([
            [
              "edge-tts",
              { enabled: true, lastFailureAt: null, failureReason: "" },
            ],
            [
              "google-tts",
              { enabled: true, lastFailureAt: null, failureReason: "" },
            ],
          ]),
      },
      lastToggledAt: { type: Date, default: null },
    },
    // ── Mockmate-AI Integration Feature Flags ───────────────────
    FEATURE_JOB_OPENINGS_PAGE: { type: Boolean, default: true },
    FEATURE_JOB_APPLICATION_FLOW: { type: Boolean, default: true },
    FEATURE_REQUIRE_PROCTORED_INTERVIEW_BEFORE_APPLY: {
      type: Boolean,
      default: true,
    },
    FEATURE_APPLICATION_LIFECYCLE: { type: Boolean, default: true },
    FEATURE_NOTIFICATION_SYSTEM: { type: Boolean, default: true },
    FEATURE_UPCOMING_EVENTS: { type: Boolean, default: true },
    FEATURE_JOB_ANALYTICS: { type: Boolean, default: true },
    FEATURE_MOCKMATE_DB_SYNC: { type: Boolean, default: true },

    // ── Cross-Platform Integration Feature Flags ────────────────
    FEATURE_CENTRALISED_RESUME: { type: Boolean, default: true },
    FEATURE_INTERVIEW_OVERHAUL: { type: Boolean, default: true },
    INTERVIEW_LIMIT_ENABLED: { type: Boolean, default: false },
    MAX_INTERVIEWS_ALLOWED: { type: Number, default: 999 },
    FEATURE_GLOBAL_CANDIDATE_POOL: { type: Boolean, default: true },
    FEATURE_OPENING_MOCKMATE_TAB: { type: Boolean, default: true },
    FEATURE_EVENTS_SYNC: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    // Prevent mongoose from adding __v or trying to pluralize oddly
    collection: "appconfigs",
  },
);

// Priority order for fallback cascade
appConfigSchema.statics.TTS_PRIORITY = TTS_SERVICES;

const AppConfig = mongoose.model("AppConfig", appConfigSchema);

module.exports = AppConfig;
