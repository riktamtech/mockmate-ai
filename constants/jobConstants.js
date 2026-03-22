/**
 * Job Constants — Enums and configuration for the job openings feature.
 */

// ── Application Status Enum ───────────────────────────────────

export const APPLICATION_STATUS = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  INTERVIEW_SCHEDULED: "INTERVIEW_SCHEDULED",
  INTERVIEW_IN_PROGRESS: "INTERVIEW_IN_PROGRESS",
  INTERVIEW_COMPLETED: "INTERVIEW_COMPLETED",
  WITHDRAWN: "WITHDRAWN",
  OPENING_CLOSED: "OPENING_CLOSED",
};

// ── Scheduling Modes ──────────────────────────────────────────

export const SCHEDULING_MODE = {
  TIMEFRAME: "TIMEFRAME",
  MANUAL: "MANUAL",
  IMMEDIATE: "IMMEDIATE",
  ANYTIME: "ANYTIME",
};

export const SCHEDULING_MODE_LABELS = {
  [SCHEDULING_MODE.TIMEFRAME]: "Select time within a window",
  [SCHEDULING_MODE.MANUAL]: "HR will schedule manually",
  [SCHEDULING_MODE.IMMEDIATE]: "Interview starts immediately",
  [SCHEDULING_MODE.ANYTIME]: "Interview anytime after application",
};

// ── Fitness Score Labels ──────────────────────────────────────

export const FITNESS_LABEL = {
  STRONG_MATCH: "STRONG_MATCH",
  GOOD_MATCH: "GOOD_MATCH",
  FAIR_MATCH: "FAIR_MATCH",
  LOW_MATCH: "LOW_MATCH",
};

export const FITNESS_RANGES = {
  [FITNESS_LABEL.STRONG_MATCH]: { min: 80, max: 100, color: "#10B981" },
  [FITNESS_LABEL.GOOD_MATCH]: { min: 60, max: 79, color: "#3B82F6" },
  [FITNESS_LABEL.FAIR_MATCH]: { min: 40, max: 59, color: "#F59E0B" },
  [FITNESS_LABEL.LOW_MATCH]: { min: 0, max: 39, color: "#EF4444" },
};

export const FITNESS_MESSAGES = {
  [FITNESS_LABEL.STRONG_MATCH]:
    "Excellent fit! Apply with confidence.",
  [FITNESS_LABEL.GOOD_MATCH]:
    "Good match. Consider highlighting your strongest skills.",
  [FITNESS_LABEL.FAIR_MATCH]:
    "Moderate fit. Upskilling in key areas is recommended.",
  [FITNESS_LABEL.LOW_MATCH]:
    "Below average fit. Consider improving your resume before applying.",
};

// ── Lifecycle Stages ──────────────────────────────────────────

export const LIFECYCLE_STAGES = [
  { key: "APPLIED", label: "Applied" },
  { key: "FITNESS_EVALUATED", label: "Fitness Evaluated" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "APPROVED", label: "Approved" },
  { key: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
  { key: "INTERVIEW_IN_PROGRESS", label: "Interview In Progress" },
  { key: "INTERVIEW_COMPLETED", label: "Interview Completed" },
];

// ── Apply Button States ───────────────────────────────────────

export const APPLY_BUTTON_STATE = {
  PROCTORED_REQUIRED: "PROCTORED_REQUIRED",
  NOT_APPLIED: "NOT_APPLIED",
  APPLIED: "APPLIED",
  CLOSED: "CLOSED",
};

// ── Filter Options ────────────────────────────────────────────

export const EXPERIENCE_LEVELS = [
  { value: "0-2", label: "0–2 years" },
  { value: "2-5", label: "2–5 years" },
  { value: "5-10", label: "5–10 years" },
  { value: "10+", label: "10+ years" },
];

export const JOB_FILTER_KEYS = {
  EXPERIENCE: "experience",
  LOCATION: "location",
  ORGANISATION: "organisation",
  APPLIED: "applied",
  SAVED: "saved",
  NEEDS_INTERVIEW: "needs_interview",
  INTERVIEW_IN_PROGRESS: "interview_in_progress",
  INTERVIEW_COMPLETED: "interview_completed",
};
