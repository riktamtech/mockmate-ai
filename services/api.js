import axios from "axios";

const API_URL = "http://localhost:5001";
// const API_URL = '';

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || "Request failed";
    const newError = new Error(message);
    newError.response = error.response;
    return Promise.reject(newError);
  },
);

export { axiosInstance };

export const api = {
  login: async (email, password) => {
    const { data } = await axiosInstance.post("/api/auth/login", {
      email,
      password,
    });
    return data;
  },

  register: async (name, email, password) => {
    const { data } = await axiosInstance.post("/api/auth/register", {
      name,
      email,
      password,
    });
    return data;
  },

  sendOtp: async (email) => {
    const { data } = await axiosInstance.post("/api/auth/send-otp", { email });
    return data;
  },

  verifyOtp: async (email, otp) => {
    const { data } = await axiosInstance.post("/api/auth/verify-otp", {
      email,
      otp,
    });
    return data;
  },

  forgotPassword: async (email) => {
    const { data } = await axiosInstance.post("/api/auth/forgotpassword", {
      email,
    });
    return data;
  },

  resetPassword: async (resettoken, password) => {
    const { data } = await axiosInstance.put(
      `/api/auth/resetpassword/${resettoken}`,
      {
        password,
      },
    );
    return data;
  },

  googleLogin: async (token) => {
    const { data } = await axiosInstance.post("/api/auth/google", { token });
    return data;
  },

  getMe: async () => {
    const { data } = await axiosInstance.get("/api/auth/me");
    return data;
  },

  // User Profile
  getProfile: async () => {
    const { data } = await axiosInstance.get("/api/user/profile");
    return data;
  },

  updateProfile: async (profileData) => {
    const { data } = await axiosInstance.put("/api/user/profile", profileData);
    return data;
  },

  completeProfileSetup: async (profileData) => {
    const { data } = await axiosInstance.post(
      "/api/user/profile/complete",
      profileData,
    );
    return data;
  },

  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append("resume", file);
    const { data } = await axiosInstance.post("/api/user/resume", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  parseResume: async (file) => {
    const formData = new FormData();
    formData.append("resume", file);
    const { data } = await axiosInstance.post(
      "/api/user/resume/parse",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return data;
  },

  parseExistingResume: async () => {
    const { data } = await axiosInstance.post(
      "/api/user/resume/parse-existing",
    );
    return data;
  },

  getResumeBase64: async () => {
    const { data } = await axiosInstance.get("/api/user/resume/base64");
    return data;
  },

  deleteResume: async () => {
    const { data } = await axiosInstance.delete("/api/user/resume");
    return data;
  },

  createInterview: async (interviewData) => {
    const { data } = await axiosInstance.post("/api/interviews", interviewData);
    return data;
  },

  getMyInterviews: async () => {
    const { data } = await axiosInstance.get("/api/interviews");
    return data;
  },

  getInterview: async (id) => {
    const { data } = await axiosInstance.get(`/api/interviews/${id}`);
    return data;
  },

  updateInterview: async (id, updateData) => {
    const { data } = await axiosInstance.put(
      `/api/interviews/${id}`,
      updateData,
    );
    return data;
  },

  deleteInterview: async (id) => {
    const { data } = await axiosInstance.delete(`/api/interviews/${id}`);
    return data;
  },

  uploadAudioRecording: async (
    interviewId,
    audioBlob,
    questionIndex,
    durationSeconds,
    transcript,
    historyId = null,
    interactionId = null,
  ) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, `recording_q${questionIndex}.webm`);
    formData.append("interviewId", interviewId);
    formData.append("questionIndex", questionIndex);
    formData.append("durationSeconds", durationSeconds || 0);
    if (transcript) formData.append("transcript", transcript);
    if (historyId) formData.append("historyId", historyId);
    if (interactionId) formData.append("interactionId", interactionId);

    const { data } = await axiosInstance.post("/api/audio/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  transcribeAudio: async (audioBlob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    const { data } = await axiosInstance.post(
      "/api/audio/transcribe",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return data;
  },

  getAudioPlaybackUrl: async (interviewId, recordingId) => {
    const { data } = await axiosInstance.get(
      `/api/audio/${interviewId}/${recordingId}`,
    );
    return data;
  },

  getAdminStats: async () => {
    const { data } = await axiosInstance.get("/api/admin/stats");
    return data;
  },

  getUserGrowth: async () => {
    const { data } = await axiosInstance.get("/api/admin/user-growth");
    return data;
  },

  getAllUsers: async (page = 1, limit = 10, search = "") => {
    const { data } = await axiosInstance.get("/api/admin/users", {
      params: { page, limit, search },
    });
    return data;
  },

  getAdminUserDetails: async (id) => {
    const { data } = await axiosInstance.get(`/api/admin/users/${id}`);
    return data;
  },

  getAllInterviews: async (
    page = 1,
    limit = 20,
    status = "all",
    search = "",
  ) => {
    const { data } = await axiosInstance.get("/api/admin/interviews", {
      params: { page, limit, status, search },
    });
    return data;
  },

  getInterviewDetails: async (interviewId) => {
    const { data } = await axiosInstance.get(
      `/api/admin/interviews/${interviewId}`,
    );
    return data;
  },

  transcribeInterview: async (interviewId, payload) => {
    // payload can be { historyIds: [...] } or { transcriptions: {...} }
    const { data } = await axiosInstance.post(
      `/api/admin/interviews/${interviewId}/transcribe`,
      payload,
    );
    return data;
  },

  generateTtsForHistory: async (interviewId, historyId) => {
    const { data } = await axiosInstance.post(
      `/api/admin/interviews/${interviewId}/tts-fallback`,
      { historyId },
    );
    return data;
  },

  getInterviewAudioRecordings: async (interviewId) => {
    const { data } = await axiosInstance.get(
      `/api/audio/interview/${interviewId}`,
    );
    return data;
  },

  chatStream: async (history, message, config, onChunk, onMetadata) => {
    const token = localStorage.getItem("token");
    const payload = { history, message, ...config };

    const res = await fetch(`${API_URL}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) throw new Error("Chat API Error");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let accumulated = "";
    let processedLength = 0;
    let metadataFound = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        // flush anything remaining before \n[METADATA]
        const metaIdx = accumulated.lastIndexOf("\n[METADATA]");
        if (metaIdx !== -1) {
          const remainder = accumulated.slice(processedLength, metaIdx);
          if (remainder.length > 0) onChunk(remainder);

          const metaStr = accumulated.slice(metaIdx + 11);
          try {
            const metadata = JSON.parse(metaStr);
            if (onMetadata) onMetadata(metadata);
          } catch (_) {}
        } else {
          const remainder = accumulated.slice(processedLength);
          if (remainder.length > 0) onChunk(remainder);
        }
        break;
      }

      const text = decoder.decode(value, { stream: true });
      if (text) {
        accumulated += text;
        if (metadataFound) continue;

        const metaIdx = accumulated.indexOf("\n[METADATA]");
        if (metaIdx !== -1) {
          metadataFound = true;
          const remainder = accumulated.slice(processedLength, metaIdx);
          if (remainder.length > 0) onChunk(remainder);
          processedLength = metaIdx;
        } else {
          // Keep 11 chars buffered in case it's the start of \n[METADATA]
          const safeLength = Math.max(0, accumulated.length - 11);
          if (safeLength > processedLength) {
            const chunkToEmit = accumulated.slice(processedLength, safeLength);
            onChunk(chunkToEmit);
            processedLength = safeLength;
          }
        }
      }
    }
  },

  generateFeedback: async (transcript, language, interviewId = null) => {
    const { data } = await axiosInstance.post("/api/ai/feedback", {
      transcript,
      language,
      interviewId,
    });
    return data;
  },

  generateSpeech: async (
    text,
    interviewId = null,
    questionIndex = null,
    language = "English",
  ) => {
    const payload = { text, interviewId, questionIndex, language };
    const { data } = await axiosInstance.post("/api/ai/tts", payload);
    return data;
  },

  refreshAudioUrl: async (
    interviewId,
    questionIndex,
    conversationId = null,
  ) => {
    const { data } = await axiosInstance.post("/api/ai/refresh-audio-url", {
      interviewId,
      questionIndex,
      conversationId,
    });
    return data;
  },

  generateSpeechGeminiBackup: async (text, language = "English") => {
    const { data } = await axiosInstance.post("/api/ai/tts-gemini-backup", {
      text,
      language,
    });
    return data;
  },

  analyzeResume: async (base64, mimeType, language) => {
    const { data } = await axiosInstance.post("/api/ai/analyze-resume", {
      base64,
      mimeType,
      language,
    });
    return data;
  },

  ttsStream: async (
    text,
    interviewId = null,
    questionIndex = null,
    signal,
    isFinalMessage = false,
    historyId = null,
    language = "English",
  ) => {
    const token = localStorage.getItem("token");
    const payload = {
      text,
      interviewId,
      questionIndex,
      isFinalMessage,
      historyId,
      language,
    };

    // We use native fetch here because axios doesn't support streaming response bodies easily in browser
    const response = await fetch(`${API_URL}/api/ai/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });
    return response;
  },
};
