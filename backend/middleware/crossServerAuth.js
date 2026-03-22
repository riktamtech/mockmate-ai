const crypto = require("crypto");

/**
 * Cross-Server Authentication Middleware for Mockmate-AI
 *
 * Verifies HMAC-signed requests from Zinterview-backend.
 * Mirror of the Zinterview middleware.
 */

const SHARED_SECRET = process.env.MOCKMATE_SHARED_SECRET || "";
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

function generateSignature(body, timestamp, secret = SHARED_SECRET) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return crypto
    .createHmac("sha256", secret)
    .update(payload + timestamp)
    .digest("hex");
}

const verifyCrossServerAuth = async (req, res, next) => {
  const signature = req.headers["x-signature"];
  const timestamp = req.headers["x-timestamp"];

  if (!signature || !timestamp) {
    return res.status(401).json({
      success: false,
      error: "Missing X-Signature or X-Timestamp headers",
    });
  }

  if (!SHARED_SECRET) {
    console.error("MOCKMATE_SHARED_SECRET is not configured");
    return res.status(500).json({
      success: false,
      error: "Server configuration error",
    });
  }

  const requestTime = new Date(timestamp).getTime();
  const now = Date.now();
  if (
    isNaN(requestTime) ||
    Math.abs(now - requestTime) > MAX_TIMESTAMP_DRIFT_MS
  ) {
    return res.status(401).json({
      success: false,
      error: "Request timestamp is stale or invalid",
    });
  }

  try {
    const body = req.body || {};
    const expectedSignature = generateSignature(body, timestamp);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid signature",
      });
    }
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Signature verification failed",
    });
  }

  next();
};

module.exports = { verifyCrossServerAuth, generateSignature };
