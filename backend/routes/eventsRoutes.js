const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getUpcomingEvents,
  getPastEvents,
} = require("../controllers/eventsController");
const {
  processWebhookEvent,
  verifyWebhookSignature,
} = require("../services/eventService");

const router = express.Router();

// ── Candidate-facing routes ─────────────────────────────────────
router.get("/upcoming", protect, getUpcomingEvents);
router.get("/past", protect, getPastEvents);

// ── Webhook ingestion (from Zinterview-backend) ─────────────────
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    // Verify HMAC signature if secret is configured
    const secret = process.env.WEBHOOK_HMAC_SECRET;
    if (secret) {
      const signature = req.headers["x-webhook-signature"];
      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      if (!verifyWebhookSignature(rawBody, signature, secret)) {
        return res.status(401).json({ success: false, error: "Invalid webhook signature" });
      }
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const result = await processWebhookEvent(body);

    if (result.alreadyProcessed) {
      return res.status(200).json({ success: true, duplicate: true, eventId: result.eventId });
    }

    res.status(result.processed ? 200 : 500).json({
      success: result.processed,
      eventId: result.eventId,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ success: false, error: "Webhook processing failed" });
  }
});

module.exports = router;
