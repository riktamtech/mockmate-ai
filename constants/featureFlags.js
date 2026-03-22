/**
 * Feature Flags — Mockmate-AI Integration
 *
 * Centralized feature flag constants shared across
 * mockmate-ai frontend and backend.
 *
 * Each flag maps to a boolean field in the AppConfig
 * (backend) and is fetched by the frontend on app load.
 * Disabling a flag produces zero UI/API surface change.
 */

// ── Feature Flag Names ────────────────────────────────────────

/** Job openings page in sidebar + /jobs route */
export const FEATURE_JOB_OPENINGS_PAGE = "FEATURE_JOB_OPENINGS_PAGE";

/** Full application flow (form, fitness score, scheduling) */
export const FEATURE_JOB_APPLICATION_FLOW = "FEATURE_JOB_APPLICATION_FLOW";

/** Require proctored interview before applying to jobs */
export const FEATURE_REQUIRE_PROCTORED_INTERVIEW_BEFORE_APPLY =
  "FEATURE_REQUIRE_PROCTORED_INTERVIEW_BEFORE_APPLY";

/** Application lifecycle tracker on job cards/detail */
export const FEATURE_APPLICATION_LIFECYCLE = "FEATURE_APPLICATION_LIFECYCLE";

/** In-app + email notification system */
export const FEATURE_NOTIFICATION_SYSTEM = "FEATURE_NOTIFICATION_SYSTEM";

/** Upcoming/past events section */
export const FEATURE_UPCOMING_EVENTS = "FEATURE_UPCOMING_EVENTS";

/** Job analytics dashboard + admin view */
export const FEATURE_JOB_ANALYTICS = "FEATURE_JOB_ANALYTICS";

/** Data sync from Zinterview backend */
export const FEATURE_MOCKMATE_DB_SYNC = "FEATURE_MOCKMATE_DB_SYNC";

// ── Default Values ────────────────────────────────────────────

export const FEATURE_FLAG_DEFAULTS = {
  [FEATURE_JOB_OPENINGS_PAGE]: true,
  [FEATURE_JOB_APPLICATION_FLOW]: true,
  [FEATURE_REQUIRE_PROCTORED_INTERVIEW_BEFORE_APPLY]: true,
  [FEATURE_APPLICATION_LIFECYCLE]: true,
  [FEATURE_NOTIFICATION_SYSTEM]: true,
  [FEATURE_UPCOMING_EVENTS]: true,
  [FEATURE_JOB_ANALYTICS]: true,
  [FEATURE_MOCKMATE_DB_SYNC]: true,
};

// ── All flag names as array (for iteration) ───────────────────

export const ALL_FEATURE_FLAGS = Object.keys(FEATURE_FLAG_DEFAULTS);
