/**
 * Shared helper functions for Admin dashboard components.
 */

export const STATUS_COLORS = {
  COMPLETED: "bg-emerald-100 text-emerald-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  SCHEDULED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-700",
  CONSENT_GIVEN: "bg-slate-100 text-slate-600",
  DETAILS_COLLECTED: "bg-sky-100 text-sky-700",
  OPENING_CREATED: "bg-indigo-100 text-indigo-700",
  CANDIDATE_ADDED: "bg-teal-100 text-teal-700",
};

export const FIT_COLORS = {
  HIGH: "bg-emerald-100 text-emerald-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-red-100 text-red-700",
};

export const getFullName = (pi) => {
  if (pi.userData?.name) return pi.userData.name;
  const fn = pi.stepData?.candidateDetails?.firstName || "";
  const ln = pi.stepData?.candidateDetails?.lastName || "";
  return (fn + " " + ln).trim() || "Unknown";
};

export const getRole = (pi) =>
  pi.openingData?.title || pi.stepData?.openingDetails?.role || "—";

export const getExperience = (pi) => {
  if (pi.openingData?.minExperience != null) {
    const min = pi.openingData.minExperience;
    const max = pi.openingData.maxExperience;
    return max != null && max !== min ? `${min}-${max} yrs` : `${min} yrs`;
  }
  return (
    pi.stepData?.openingDetails?.experience ||
    pi.stepData?.candidateDetails?.experience ||
    "—"
  );
};

export const formatDuration = (seconds) => {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const formatDurationHMS = (totalSeconds) => {
  if (!totalSeconds || isNaN(totalSeconds)) return "00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const getScoreColor = (score) => {
  if (score >= 70) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#f43f5e";
};
