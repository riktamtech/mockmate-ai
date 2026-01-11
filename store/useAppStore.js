import { create } from 'zustand';
import { AppState } from '../types';

export const useAppStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  
  appState: AppState.LANDING,
  setAppState: (appState) => set({ appState }),
  
  language: 'English',
  setLanguage: (language) => set({ language }),
  
  activeInterviewId: null,
  setActiveInterviewId: (activeInterviewId) => set({ activeInterviewId }),
  
  interviewConfig: null,
  setInterviewConfig: (interviewConfig) => set({ interviewConfig }),
  
  feedbackData: null,
  setFeedbackData: (feedbackData) => set({ feedbackData }),
  
  resetSession: () => set({ 
    activeInterviewId: null, 
    interviewConfig: null,
    feedbackData: null,
    // Keep language and user
  })
}));