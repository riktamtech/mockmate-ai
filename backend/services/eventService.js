/**
 * EventService — Webhook ingestion + notification dispatch layer.
 *
 * Handles:
 *  1. Webhook ingestion from Zinterview-backend (idempotent via Event model)
 *  2. In-app notification creation
 *  3. Event emission to external platforms
 *
 * Event Types:
 *  - INTERVIEW_SCHEDULED      → Notify candidate of upcoming interview
 *  - INTERVIEW_COMPLETED      → Trigger CentralisedResume enrichment + notify
 *  - APPLICATION_STATUS_CHANGE → Update JobApplication + notify candidate
 *  - OPENING_UPDATED          → Re-sync opening data
 *  - OPENING_CLOSED           → Mark applications, notify candidates
 *  - CUSTOM_QUESTIONS_SET     → Store custom questions config
 *  - CANDIDATE_APPROVED       → Notify candidate of approval
 *  - CANDIDATE_REJECTED       → Notify candidate of rejection
 */

const crypto = require("crypto");
const Event = require("../models/Event");
const configService = require("./configService");

// ── Notification helper (uses existing notification system) ──────

let Notification;
try {
  Notification = require("../models/Notification");
} catch {
  // Model may not exist yet
  Notification = null;
}

// ── HMAC Verification ────────────────────────────────────────────

/**
 * Verify HMAC-SHA256 signature on incoming webhooks.
 * @param {string} payload  - Raw request body
 * @param {string} signature - X-Webhook-Signature header
 * @param {string} secret    - Shared HMAC secret
 * @returns {boolean}
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex"),
  );
}

// ── Event Handlers ───────────────────────────────────────────────

const handlers = {
  INTERVIEW_SCHEDULED: async (event) => {
    await _createNotification(event.targetUserId, {
      type: "INTERVIEW_SCHEDULED",
      title: "Interview Scheduled",
      message: `Your interview for "${event.payload?.openingTitle || "a position"}" has been scheduled.`,
      metadata: event.payload,
    });
  },

  INTERVIEW_COMPLETED: async (event) => {
    // CentralisedResume enrichment is handled by proctoredInterviewController.checkCompletion
    // This handler is for external Zinterview-triggered completions
    await _createNotification(event.targetUserId, {
      type: "INTERVIEW_COMPLETED",
      title: "Interview Completed",
      message: `Your interview for "${event.payload?.openingTitle || "a position"}" has been evaluated.`,
      metadata: event.payload,
    });
  },

  APPLICATION_STATUS_CHANGE: async (event) => {
    const { applicationId, newStatus, reason } = event.payload || {};
    if (applicationId) {
      const JobApplication = require("../models/JobApplication");
      await JobApplication.findByIdAndUpdate(applicationId, {
        status: newStatus,
        $push: {
          lifecycle: {
            status: newStatus,
            timestamp: new Date(),
            metadata: { reason, source: "zinterview_webhook" },
          },
        },
      });
    }

    const statusMessages = {
      APPROVED: "Your application has been approved! You can now schedule your interview.",
      REJECTED: "Your application status has been updated.",
      INTERVIEW_SCHEDULED: "Your interview has been scheduled.",
      WITHDRAWN: "Your application has been withdrawn.",
    };

    await _createNotification(event.targetUserId, {
      type: "APPLICATION_UPDATE",
      title: "Application Update",
      message: statusMessages[newStatus] || `Application status changed to ${newStatus}`,
      metadata: event.payload,
    });
  },

  OPENING_UPDATED: async (event) => {
    const { openingId, updates } = event.payload || {};
    if (openingId && updates) {
      const JobOpening = require("../models/JobOpening");
      await JobOpening.findOneAndUpdate(
        { zinterviewOpeningId: openingId },
        { $set: { ...updates, syncedAt: new Date() } },
      );
    }
  },

  OPENING_CLOSED: async (event) => {
    const { openingId, reason } = event.payload || {};
    if (openingId) {
      const JobOpening = require("../models/JobOpening");
      await JobOpening.findOneAndUpdate(
        { zinterviewOpeningId: openingId },
        { $set: { isEnabled: false, status: false, syncedAt: new Date() } },
      );

      // Update all active applications for this opening
      const JobApplication = require("../models/JobApplication");
      const opening = await JobOpening.findOne({ zinterviewOpeningId: openingId }).lean();
      if (opening) {
        const apps = await JobApplication.find({
          openingId: opening._id,
          status: { $nin: ["WITHDRAWN", "REJECTED", "INTERVIEW_COMPLETED", "OPENING_CLOSED"] },
        });

        for (const app of apps) {
          app.status = "OPENING_CLOSED";
          app.addLifecycleEntry("OPENING_CLOSED", { reason });
          await app.save();

          // Notify each affected candidate
          await _createNotification(app.candidateId, {
            type: "OPENING_CLOSED",
            title: "Position Closed",
            message: `The position "${opening.title}" has been closed.`,
            metadata: { openingId: opening._id, reason },
          });
        }
      }
    }
  },

  CUSTOM_QUESTIONS_SET: async (event) => {
    const { openingId, config } = event.payload || {};
    if (openingId && config) {
      const JobOpening = require("../models/JobOpening");
      await JobOpening.findOneAndUpdate(
        { zinterviewOpeningId: openingId },
        { $set: { "mockmateConfig.customQuestionsConfig": config } },
      );
    }
  },

  CANDIDATE_APPROVED: async (event) => {
    await _createNotification(event.targetUserId, {
      type: "CANDIDATE_APPROVED",
      title: "Application Approved!",
      message: `Your application for "${event.payload?.openingTitle || "a position"}" has been approved. You can now schedule your interview.`,
      metadata: event.payload,
    });
  },

  CANDIDATE_REJECTED: async (event) => {
    await _createNotification(event.targetUserId, {
      type: "CANDIDATE_REJECTED",
      title: "Application Update",
      message: `Your application for "${event.payload?.openingTitle || "a position"}" has been reviewed.`,
      metadata: event.payload,
    });
  },
};

// ── Core: Process Webhook Event ──────────────────────────────────

/**
 * Process an incoming webhook event.
 * Idempotent via idempotencyKey on the Event model.
 *
 * @param {Object} eventData - { eventType, idempotencyKey, targetUserId?, payload, source }
 * @returns {Object}         - { processed: boolean, eventId, alreadyProcessed: boolean }
 */
async function processWebhookEvent(eventData) {
  const config = await configService.getConfig();
  if (!config.FEATURE_EVENTS_SYNC) {
    console.log("[EventService] Events sync disabled, skipping");
    return { processed: false, reason: "feature_disabled" };
  }

  const {
    eventType,
    idempotencyKey,
    targetUserId,
    payload,
    source = "zinterview",
  } = eventData;

  // Idempotency check
  if (idempotencyKey) {
    const existing = await Event.findOne({ idempotencyKey });
    if (existing) {
      console.log(`[EventService] Duplicate event: ${idempotencyKey}`);
      return { processed: false, eventId: existing._id, alreadyProcessed: true };
    }
  }

  // Create event record
  const event = await Event.create({
    eventType,
    idempotencyKey: idempotencyKey || `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    targetUserId: targetUserId || null,
    source,
    payload: payload || {},
    status: "PENDING",
  });

  // Process event
  try {
    const handler = handlers[eventType];
    if (handler) {
      await handler(event);
      event.status = "PROCESSED";
      event.processedAt = new Date();
    } else {
      console.warn(`[EventService] No handler for event type: ${eventType}`);
      event.status = "FAILED";
      event.error = `Unknown event type: ${eventType}`;
    }
  } catch (err) {
    console.error(`[EventService] Error processing ${eventType}:`, err.message);
    event.status = "FAILED";
    event.error = err.message;
    event.retryCount = (event.retryCount || 0) + 1;
  }

  await event.save();
  return { processed: event.status === "PROCESSED", eventId: event._id };
}

// ── Event Emission (MockMate → Zinterview) ───────────────────────

/**
 * Emit an event to Zinterview-backend.
 * Used when MockMate-AI needs to notify Zinterview of changes.
 *
 * @param {string} eventType  - Event type
 * @param {Object} payload    - Event payload
 * @param {string} targetUrl  - Zinterview webhook endpoint URL
 */
async function emitEvent(eventType, payload, targetUrl) {
  const config = await configService.getConfig();
  if (!config.FEATURE_EVENTS_SYNC) return;

  const event = {
    eventType,
    payload,
    source: "mockmate",
    timestamp: new Date().toISOString(),
    idempotencyKey: `mm_${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };

  const body = JSON.stringify(event);

  // Sign with HMAC
  const secret = process.env.WEBHOOK_HMAC_SECRET;
  let signature = "";
  if (secret) {
    signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  try {
    const response = await fetch(targetUrl || process.env.ZINTERVIEW_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Event-Type": eventType,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[EventService] Emit failed: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error(`[EventService] Emit error for ${eventType}:`, err.message);
  }
}

// ── Internal: Create in-app notification ─────────────────────────

async function _createNotification(userId, data) {
  if (!userId || !Notification) return;

  try {
    await Notification.create({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      metadata: data.metadata || {},
      read: false,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[EventService] Notification creation failed:", err.message);
  }
}

// ── Exports ──────────────────────────────────────────────────────

module.exports = {
  verifyWebhookSignature,
  processWebhookEvent,
  emitEvent,
};
