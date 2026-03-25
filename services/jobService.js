import { axiosInstance } from "./api";

/**
 * Job Service — API client for job openings feature.
 *
 * Handles all API calls related to job openings, applications,
 * fitness scoring, candidate profiles, and meta lookups.
 */

export const jobService = {
  // ── Job Openings ────────────────────────────────────────────

  /**
   * Fetch paginated job openings with optional filters.
   */
  getJobOpenings: async ({
    cursor = null,
    limit = 20,
    search = "",
    minExp = "",
    maxExp = "",
    singleExp = "",
    location = "",
    organisation = "",
    jobType = "",
    applied = "",
    needsInterview = "",
    interviewInProgress = "",
    interviewCompleted = "",
    sort = "newest",
  } = {}) => {
    const params = { limit, sort };
    if (cursor) params.cursor = cursor;
    if (search) params.search = search;
    if (minExp !== "" && minExp !== null) params.minExp = minExp;
    if (maxExp !== "" && maxExp !== null) params.maxExp = maxExp;
    if (singleExp !== "" && singleExp !== null) params.singleExp = singleExp;
    if (location) params.location = location;
    if (organisation) params.organisation = organisation;
    if (jobType) params.jobType = jobType;
    if (applied === "true") params.applied = "true";
    if (needsInterview === "true") params.needsInterview = "true";
    if (interviewInProgress === "true") params.interviewInProgress = "true";
    if (interviewCompleted === "true") params.interviewCompleted = "true";

    const { data } = await axiosInstance.get("/api/jobs", { params });
    return data;
  },

  /**
   * Fetch a single job opening by ID.
   */
  getJobOpening: async (id) => {
    const { data } = await axiosInstance.get(`/api/jobs/${id}`);
    return data;
  },

  /**
   * Check application status for a job opening.
   */
  getApplyStatus: async (id) => {
    const { data } = await axiosInstance.get(`/api/jobs/${id}/apply-status`);
    return data;
  },

  // ── Meta / Lookups ──────────────────────────────────────────

  /**
   * Fetch all organisation names.
   */
  getOrganisations: async () => {
    const { data } = await axiosInstance.get("/api/jobs/meta/organisations");
    return data;
  },

  /**
   * Fetch distinct locations from job openings.
   */
  getLocations: async () => {
    const { data } = await axiosInstance.get("/api/jobs/meta/locations");
    return data;
  },

  /**
   * Fetch distinct job types.
   */
  getJobTypes: async () => {
    const { data } = await axiosInstance.get("/api/jobs/meta/job-types");
    return data;
  },

  /**
   * Fetch all countries for location dropdown.
   */
  getCountries: async () => {
    const { data } = await axiosInstance.get("/api/jobs/meta/countries");
    return data;
  },

  /**
   * Fetch states for a given country.
   */
  getStates: async (countryCode) => {
    const { data } = await axiosInstance.get("/api/jobs/meta/states", {
      params: { countryCode },
    });
    return data;
  },

  /**
   * Fetch cities for a given state.
   */
  getCities: async (countryCode, stateCode) => {
    const { data } = await axiosInstance.get("/api/jobs/meta/cities", {
      params: { countryCode, stateCode },
    });
    return data;
  },

  // ── Applications ────────────────────────────────────────────

  /**
   * Submit a job application.
   */
  submitApplication: async (openingId, applicationData) => {
    const { data } = await axiosInstance.post(
      `/api/jobs/${openingId}/apply`,
      applicationData,
    );
    return data;
  },

  /**
   * Get all applications for the current user.
   */
  getMyApplications: async ({ cursor = null, limit = 20, status = "" } = {}) => {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    if (status) params.status = status;

    const { data } = await axiosInstance.get("/api/jobs/applications", {
      params,
    });
    return data;
  },

  // ── Fitness Score ───────────────────────────────────────────

  /**
   * Calculate fitness score for a resume against a job opening.
   */
  calculateFitnessScore: async (openingId, resumeData) => {
    const { data } = await axiosInstance.post(
      `/api/jobs/${openingId}/fitness-score`,
      resumeData,
    );
    return data;
  },

  // ── Full Application Flow (OBJ-5) ────────────────────────────

  /**
   * Phase 1: Submit form + calculate fitness score.
   */
  submitFullApplication: async (openingId, applicationData) => {
    const { data } = await axiosInstance.post(
      "/api/applications/submit-full",
      { openingId, ...applicationData },
    );
    return data;
  },

  /**
   * Phase 2: Finalize after reviewing score.
   */
  finalizeApplication: async (openingId, finalData) => {
    const { data } = await axiosInstance.post(
      "/api/applications/finalize",
      { openingId, ...finalData },
    );
    return data;
  },

  /**
   * Get stored fitness score for an opening.
   */
  getStoredFitnessScore: async (openingId) => {
    const { data } = await axiosInstance.get(
      `/api/fitness/stored/${openingId}`,
    );
    return data;
  },

  // ── Candidate Profile ───────────────────────────────────────

  getCandidateProfile: async () => {
    const { data } = await axiosInstance.get("/api/applications/profile/me");
    return data;
  },

  saveCandidateProfile: async (profileData) => {
    const { data } = await axiosInstance.put(
      "/api/applications/profile/me",
      profileData,
    );
    return data;
  },

  // ── Resumes ─────────────────────────────────────────────────

  getCachedResumes: async () => {
    const { data } = await axiosInstance.get("/api/applications/resumes/cached");
    return data;
  },

  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append("resume", file);
    const { data } = await axiosInstance.post("/api/jobs/resumes", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /**
   * Upload a resume for application flow.
   * Server extracts text via Gemini Vision, generates summary, and caches.
   * Returns { resumeId, fileName, extractedText, resumeS3Key }.
   */
  uploadApplicationResume: async (file) => {
    const formData = new FormData();
    formData.append("resume", file);
    const { data } = await axiosInstance.post(
      "/api/applications/resumes/upload",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },
};
