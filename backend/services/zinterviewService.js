/**
 * ZinterviewService — Centralised HTTP client for all Zinterview API calls.
 *
 * Features:
 *  - Environment-aware (local / prod) base URL + API key selection
 *  - Exponential-backoff retry (3 attempts: 1 s → 2 s → 4 s)
 *  - Structured error propagation
 *  - Multipart/form-data support (for candidate creation with resume)
 */

const axios = require("axios");
const FormData = require("form-data");

// ── Helpers ──────────────────────────────────────────────────────────────

const isProduction = () => process.env.NODE_ENV === "production";

const getBaseUrl = () =>
  isProduction()
    ? process.env.ZINTERVIEW_PROD_BACKEND_URL
    : process.env.ZINTERVIEW_LOCAL_BACKEND_URL;

const getApiKey = () =>
  isProduction()
    ? process.env.ZINTERVIEW_PROD_API_KEY
    : process.env.ZINTERVIEW_LOCAL_API_KEY;

const getOrganizationId = () =>
  isProduction()
    ? process.env.ZINTERVIEW_PROD_ORGANIZATION_ID
    : process.env.ZINTERVIEW_LOCAL_ORGANIZATION_ID;

const getInterviewHost = () =>
  isProduction()
    ? process.env.ZINTERVIEW_INTERVIEW_HOST_PROD || "https://interview.zinterview.ai"
    : process.env.ZINTERVIEW_INTERVIEW_HOST_LOCAL || "http://localhost:4200"; //3000 for old ui. Change according to your Local url

// ── Retry wrapper ────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * Execute a request fn with exponential‑backoff retry.
 * @param {Function} requestFn  – async () => axiosResponse
 * @returns {Promise<any>}      – response.data on success
 */
const withRetry = async (requestFn) => {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await requestFn();
      return response.data;
    } catch (err) {
      if (attempt === 0) {
        const config = err.config || {};
        console.error(
          `Zinterview API → ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        );
        try {
          console.error("Payload:", JSON.parse(config.data));
        } catch (e) {}
      }
      console.error(
        `Zinterview API request failed (Attempt ${attempt + 1}):`,
        err.response?.status,
        err.response?.data || err.message,
      );
      lastError = err;
      const isRetryable =
        !err.response || // network error
        err.response.status >= 500 || // server error
        err.response.status === 429; // rate‑limited

      if (!isRetryable || attempt === MAX_RETRIES - 1) break;

      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // Build a structured error
  const message =
    lastError.response?.data?.message ||
    lastError.message ||
    "Zinterview API request failed";
  const statusCode = lastError.response?.status || 500;
  const error = new Error(message);
  error.statusCode = statusCode;
  error.zinterviewError = true;
  error.details = lastError.response?.data || null;
  throw error;
};

// ── Axios instance factory ───────────────────────────────────────────────

const createClient = (extraHeaders = {}) =>
  axios.create({
    baseURL: getBaseUrl(),
    timeout: 30000,
    headers: {
      Authorization: getApiKey(),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });

// ── Service methods ──────────────────────────────────────────────────────

const ZinterviewService = {
  // ─── Openings ────────────────────────────────────────────────────────

  /** Create a new job opening. */
  createOpening: (payload) =>
    withRetry(() =>
      createClient().post("openings/create-opening", { data: payload }),
    ),

  /** Fetch all openings for the configured organisation. */
  getOpenings: () => withRetry(() => createClient().get(`openings`)),

  /** Update an existing opening by ID. */
  updateOpening: (openingId, payload) =>
    withRetry(() =>
      createClient().post(`openings/update-opening/${openingId}`, payload),
    ),

  /** Delete an opening by ID. */
  deleteOpening: (openingId) =>
    withRetry(() =>
      createClient().delete(`openings/delete-opening/${openingId}`),
    ),

  // ─── Candidates ──────────────────────────────────────────────────────

  /**
   * Create a candidate for an opening.
   * @param {Object}  fields       – { openingId, firstName, lastName, email, preferredName?, phoneNumber?, experience? }
   * @param {Buffer|null} resumeBuffer – file buffer (optional)
   * @param {string|null} resumeFileName
   */
  createCandidate: (fields, resumeBuffer = null, resumeFileName = null) => {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.append(key, String(value));
      }
    });
    if (resumeBuffer && resumeFileName) {
      form.append("resume", resumeBuffer, { filename: resumeFileName });
    }

    return withRetry(() =>
      createClient({
        ...form.getHeaders(),
      }).post("candidates/create-candidate", form),
    );
  },

  /**
   * Update an existing candidate.
   */
  updateCandidate: (fields, resumeBuffer = null, resumeFileName = null) => {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.append(key, String(value));
      }
    });
    if (resumeBuffer && resumeFileName) {
      form.append("resume", resumeBuffer, { filename: resumeFileName });
    }

    return withRetry(() =>
      createClient({
        ...form.getHeaders(),
      }).post("candidates/update-candidate", form),
    );
  },

  /** Get all candidates/interview reports for an opening. */
  getCandidates: (openingId) =>
    withRetry(() =>
      createClient().get(`candidates/get-candidates/${openingId}`),
    ),

  /** Get a single candidate/interview report by ID. */
  getCandidate: (candidateId) =>
    withRetry(() =>
      createClient().get(`candidates/get-candidate/${candidateId}`),
    ),

  // ─── Scheduling ──────────────────────────────────────────────────────

  /**
   * Schedule interviews for one or more candidates.
   * @param {Object} payload – { openingId, selectedCandidateIds, schedule, interviewBaseUrl, ... }
   */
  scheduleCandidates: (payload) =>
    withRetry(() =>
      createClient().post("candidates/schedule-candidates", payload),
    ),

  /**
   * Cancel interviews for candidates.
   * @param {Object} payload – { selectedCandidateIds, reason? }
   */
  cancelInterview: (payload) =>
    withRetry(() =>
      createClient().post("candidates/cancel-interview", payload),
    ),

  // ─── Reports / Scores ────────────────────────────────────────────────

  /** Fetch cheating score for a candidate. */
  getCheatingScore: (candidateId) =>
    withRetry(() =>
      createClient().get(`candidates/get-cheating-score/${candidateId}`),
    ),

  /** Resume an interrupted interview (generates a new resumeToken). */
  resumeInterview: (payload) =>
    withRetry(() => createClient().post("candidates/resumeInterview", payload)),

  /** Reset active session for a candidate */
  resetActiveSession: (interviewReportId, openingTitle, orgName) =>
    withRetry(() =>
      createClient().post("candidates/updateActiveSession", {
        activeSession: "false",
        interviewReportId,
        openingTitle: openingTitle || "noOpeningTitle",
        orgName: orgName || "noOrgName",
        proctorLink: `${getInterviewHost()}/admin/proctor/${interviewReportId}`,
        emailRecipients: [],
        isMobile: false,
        osName: "Mac OS",
      }),
    ),

  // ─── Utilities ───────────────────────────────────────────────────────

  /** Construct the full interview URL for a candidate. */
  buildInterviewUrl: (openingId, reportId, resumeToken) => {
    const host = getInterviewHost();
    return `${host}/interview/${reportId}`; //new ui
    // return `${host}/interview/${openingId}/start/${reportId}/${resumeToken}`; //old ui
  },

  /** Build the interviewBaseUrl needed by the schedule API. */
  buildInterviewBaseUrl: (openingId) => {
    const host = getInterviewHost();
    return `${host}/interview/${reportId}`; //new ui
    // return `${host}/interview/${openingId}/start`; //old ui
  },

  /** Get the organisation ID from env. */
  getOrganizationId,
};

module.exports = ZinterviewService;
