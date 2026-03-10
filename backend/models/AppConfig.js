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
