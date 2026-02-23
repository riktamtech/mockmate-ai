/**
 * Audio Transcription Service
 *
 * Transcribes audio from S3 via backend proxy with fallback chain:
 *   1. Backend Gemini (primary)
 */

import { api, axiosInstance } from "./api";

// ─── Fetch audio blob via backend proxy (avoids S3 CORS) ────────────
const fetchAudioBlob = async (interviewId, questionIndex) => {
  const res = await axiosInstance.get(
    `/api/admin/interviews/${interviewId}/audio/${questionIndex}`,
    { responseType: "blob" },
  );
  return res.data;
};

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Transcribe a single audio recording.
 * Delegates entirely to backend (Gemini).
 *
 * @param {string} interviewId - Interview ID
 * @param {Object} item - Object containing { historyId, interactionId }
 * @returns {Promise<{text: string, isNew: boolean}|null>} result object
 */
export const transcribeAudioUrl = async (interviewId, item) => {
  const historyId =
    typeof item === "object" && item !== null ? item.historyId : item;
  const interactionId =
    typeof item === "object" && item !== null ? item.interactionId : null;

  // ── Attempt 1: Backend Gemini ───────────────────────────────────
  try {
    console.log(
      `[Transcription] Requesting backend transcription for historyId=${historyId}...`,
    );
    const payload = {
      historyIds: [{ historyId, ...(interactionId && { interactionId }) }],
    };
    const result = await api.transcribeInterview(interviewId, payload);
    const text = result?.transcriptions?.[historyId];
    if (text) {
      console.log(
        `[Transcription] Backend succeeded for historyId=${historyId}`,
      );
      // isNew: false because it's already saved on backend during generation
      return { text, isNew: false };
    }
  } catch (err) {
    console.error(
      `[Transcription] Backend transcription failed for historyId=${historyId}:`,
      err.message,
    );
  }

  return null;
};

/**
 * Transcribe multiple questions.
 * Sends all indices to backend for parallel processing.
 *
 * @param {Object} params
 * @param {string} params.interviewId
 * @param {Object[]} params.missingItems - Array of objects containing historyId and interactionId
 * @param {Function} [params.onProgress] - Called with (historyId, text) as each completes
 * @returns {Promise<Object>} { "699d...": "text" }
 */
export const transcribeMultiple = async ({
  interviewId,
  missingItems,
  onProgress,
}) => {
  console.log(
    `[Transcription] Parallel transcribing ${missingItems.length} items...`,
  );

  const CONCURRENCY_LIMIT = 10;
  const results = {};
  const activePromises = [];

  const processIndex = async (item) => {
    try {
      // Request backend transcription for a single item
      const result = await api.transcribeInterview(interviewId, {
        historyIds: [item],
      });
      const text = result?.transcriptions?.[item.historyId];

      if (text) {
        results[item.historyId] = text;
        onProgress?.(item.historyId, text);
      }
    } catch (err) {
      console.error(
        `[Transcription] Failed to transcribe ${item.historyId}:`,
        err.message,
      );
    }
  };

  // Execution loop with concurrency control
  for (const item of missingItems) {
    const p = processIndex(item).then(() => {
      // Remove self from active list upon completion
      activePromises.splice(activePromises.indexOf(p), 1);
    });
    activePromises.push(p);

    if (activePromises.length >= CONCURRENCY_LIMIT) {
      await Promise.race(activePromises);
    }
  }

  // Wait for remaining
  await Promise.all(activePromises);

  return results;
};
