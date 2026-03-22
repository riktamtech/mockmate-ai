import { axiosInstance } from "./api";

/**
 * Job Service — API client for job openings feature.
 *
 * Handles all API calls related to job openings, applications,
 * fitness scoring, and candidate profiles.
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
    experience = "",
    location = "",
    organisation = "",
    sort = "newest",
  } = {}) => {
    const params = { limit, sort };
    if (cursor) params.cursor = cursor;
    if (search) params.search = search;
    if (experience) params.experience = experience;
    if (location) params.location = location;
    if (organisation) params.organisation = organisation;

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

  // ── Candidate Profile ───────────────────────────────────────

  /**
   * Get candidate profile (pre-fill data).
   */
  getCandidateProfile: async () => {
    const { data } = await axiosInstance.get("/api/jobs/profile");
    return data;
  },

  /**
   * Save/update candidate profile.
   */
  saveCandidateProfile: async (profileData) => {
    const { data } = await axiosInstance.put("/api/jobs/profile", profileData);
    return data;
  },

  // ── Resumes ─────────────────────────────────────────────────

  /**
   * Get cached resumes for the current user.
   */
  getCachedResumes: async () => {
    const { data } = await axiosInstance.get("/api/jobs/resumes");
    return data;
  },

  /**
   * Upload a new resume for job applications.
   */
  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append("resume", file);
    const { data } = await axiosInstance.post("/api/jobs/resumes", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
