/**
 * Rate Limiting Middleware — Tiered rate limiters for different route groups.
 *
 * Tiers:
 *   - Global:  500 req / 1 min  (all routes)
 *   - Auth:     50 req / 15 min (login, register, password reset)
 *   - AI/TTS:  150 req / 1 min  (AI chat, TTS, audio processing)
 */

const rateLimit = require("express-rate-limit");

// ─── Helper: Standard JSON error response ────────────────────────────────────

function rateLimitHandler(_req, res) {
  res.status(429).json({
    message: "Too many requests. Please try again later.",
    retryAfter: res.getHeader("Retry-After"),
  });
}

// ─── Global Limiter ─────────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: rateLimitHandler,
  // Skip rate limiting for health check
  skip: (req) => req.path === "/" && req.method === "GET",
});

// ─── Auth Limiter (stricter — prevents brute force) ─────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: "Too many authentication attempts. Please try again in 15 minutes.",
});

// ─── AI/TTS Limiter (moderate — prevents abuse of expensive endpoints) ──────

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: "Too many AI/TTS requests. Please slow down.",
});

// ─── Proctored Interview Limiter ────────────────────────────────────────────

const proctoredLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = {
  globalLimiter,
  authLimiter,
  aiLimiter,
  proctoredLimiter,
};
