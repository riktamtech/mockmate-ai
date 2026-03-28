import { create } from "zustand";
import { AppState } from "../types";

export const useAppStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  authLoading: true,
  setAuthLoading: (authLoading) => set({ authLoading }),

  appState: AppState.LANDING,
  setAppState: (appState) => set({ appState }),

  language: "English",
  setLanguage: (language) => set({ language }),

  activeInterviewId: null,
  setActiveInterviewId: (activeInterviewId) => set({ activeInterviewId }),

  interviewConfig: null,
  setInterviewConfig: (interviewConfig) => set({ interviewConfig }),

  feedbackData: null,
  setFeedbackData: (feedbackData) => set({ feedbackData }),

  // Proctored Interview state
  proctoredInterview: null,
  setProctoredInterview: (proctoredInterview) => set({ proctoredInterview }),

  proctoredStep: 0,
  setProctoredStep: (proctoredStep) => set({ proctoredStep }),

  resetSession: () =>
    set({
      activeInterviewId: null,
      interviewConfig: null,
      feedbackData: null,
      // Keep language, user, and proctored state
    }),

  resetProctoredSession: () =>
    set({
      proctoredInterview: null,
      proctoredStep: 0,
    }),
}));
