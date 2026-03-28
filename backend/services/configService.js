/**
 * Config Service — In-memory cached access to AppConfig.
 *
 * Avoids hitting MongoDB on every TTS call. Cache refreshes every 30s
 * or immediately on writes.
 */

const AppConfig = require("../models/AppConfig");

// ─── In-Memory Cache ────────────────────────────────────────────────────────────

let _cachedConfig = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

const TTS_PRIORITY = ["edge-tts", "google-tts", "web-speech-api", "gemini-tts"];

// ─── Default Config ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  _id: "app_config",
  tts: {
    activeService: "edge-tts",
    services: new Map([
      [
        "edge-tts",
        { enabled: true, lastFailureAt: null, failureReason: "" },
      ],
      [
        "google-tts",
        { enabled: true, lastFailureAt: null, failureReason: "" },
      ],
    ]),
    lastToggledAt: null,
  },
};

// ─── Core API ───────────────────────────────────────────────────────────────────

/**
 * Get the current app config. Uses cache if fresh, otherwise fetches from DB.
 * Auto-creates the config document if it doesn't exist (upsert).
 */
async function getConfig() {
  const now = Date.now();

  // Return cached if still fresh
  if (_cachedConfig && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedConfig;
  }

  try {
    let config = await AppConfig.findById("app_config");

    if (!config) {
      // First-time setup: create the singleton config document
      config = await AppConfig.create(DEFAULT_CONFIG);
      console.log("[ConfigService] Created default AppConfig document");
    }

    _cachedConfig = config;
    _cacheTimestamp = now;
    return config;
  } catch (err) {
    console.error("[ConfigService] Failed to load config from DB:", err.message);

    // Return cached (even if stale) or default
    if (_cachedConfig) return _cachedConfig;

    // Return a plain object as emergency fallback (not saved to DB)
    return DEFAULT_CONFIG;
  }
}

/**
 * Get the currently active TTS service name.
 * @returns {Promise<string>} One of: "edge-tts", "google-tts", "web-speech-api", "gemini-tts"
 */
async function getActiveTtsService() {
  const config = await getConfig();
  return config.tts?.activeService || "edge-tts";
}

/**
 * Check if a given TTS service requires client-side handling (no backend audio generation).
 * @param {string} service
 * @returns {boolean}
 */
function isClientSideService(service) {
  return service === "web-speech-api" || service === "gemini-tts";
}

/**
 * Disable a TTS service and cascade to the next available one.
 *
 * @param {string} serviceName - The service that failed (e.g., "edge-tts")
 * @param {string} reason - Why it failed
 * @returns {Promise<string>} The new active service
 */
async function disableService(serviceName, reason) {
  try {
    const config = await AppConfig.findById("app_config");
    if (!config) {
      console.error("[ConfigService] No config document found to update");
      return "edge-tts";
    }

    // Mark the service as disabled
    const serviceStatus = config.tts.services.get(serviceName);
    if (serviceStatus) {
      serviceStatus.enabled = false;
      serviceStatus.lastFailureAt = new Date();
      serviceStatus.failureReason = reason;
      config.tts.services.set(serviceName, serviceStatus);
    }

    // Find the next enabled service in priority order
    const currentIndex = TTS_PRIORITY.indexOf(serviceName);
    let newActiveService = "gemini-tts"; // Ultimate fallback

    for (let i = currentIndex + 1; i < TTS_PRIORITY.length; i++) {
      const candidate = TTS_PRIORITY[i];

      // web-speech-api and gemini-tts are always available (client-side)
      if (candidate === "web-speech-api" || candidate === "gemini-tts") {
        newActiveService = candidate;
        break;
      }

      const status = config.tts.services.get(candidate);
      if (!status || status.enabled) {
        newActiveService = candidate;
        break;
      }
    }

    config.tts.activeService = newActiveService;
    config.tts.lastToggledAt = new Date();

    await config.save();

    // Immediately update the cache
    _cachedConfig = config;
    _cacheTimestamp = Date.now();

    console.log(
      `[ConfigService] TTS service "${serviceName}" disabled (reason: ${reason}). ` +
        `Active service is now "${newActiveService}"`,
    );

    return newActiveService;
  } catch (err) {
    console.error("[ConfigService] Failed to disable service:", err.message);
    return "gemini-tts"; // Safe fallback
  }
}

/**
 * Force-refresh the cache from DB.
 * Useful after manual DB edits.
 */
async function refreshCache() {
  _cachedConfig = null;
  _cacheTimestamp = 0;
  return getConfig();
}

module.exports = {
  getConfig,
  getActiveTtsService,
  isClientSideService,
  disableService,
  refreshCache,
  TTS_PRIORITY,
};
