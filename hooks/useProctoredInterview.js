import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api } from "../services/api";
import { useAppStore } from "../store/useAppStore";

/**
 * Custom hook managing the proctored interview lifecycle.
 * Handles: status fetching, step navigation, auto-resume,
 * completion polling, and memoized state derivations.
 */
export function useProctoredInterview() {
  const {
    proctoredInterview,
    setProctoredInterview,
    proctoredStep,
    setProctoredStep,
  } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const pollRef = useRef(null);

  // ── Fetch current status ────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { interview } = await api.getProctoredStatus();
      setProctoredInterview(interview);
      if (interview?.currentStep) {
        setProctoredStep(interview.currentStep);
      }
      return interview;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setProctoredInterview, setProctoredStep]);

  // ── Auto-fetch on mount ─────────────────────────────────────────────
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchStatus();
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  // ── Save consent ────────────────────────────────────────────────────
  const saveConsent = useCallback(
    async (signature) => {
      try {
        setActionLoading(true);
        setError(null);
        const { interview } = await api.saveConsent(signature);
        setProctoredInterview(interview);
        setProctoredStep(interview.currentStep);
        return interview;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [setProctoredInterview, setProctoredStep],
  );

  // ── Find or create opening ──────────────────────────────────────────
  const findOrCreateOpening = useCallback(
    async (details) => {
      try {
        setActionLoading(true);
        setError(null);
        const result = await api.findOrCreateOpening(details);
        setProctoredInterview(result.interview);
        setProctoredStep(result.interview.currentStep);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [setProctoredInterview, setProctoredStep],
  );

  // ── Create candidate ────────────────────────────────────────────────
  const createCandidate = useCallback(
    async (candidateData) => {
      try {
        setActionLoading(true);
        setError(null);
        const result = await api.createProctoredCandidate(candidateData);
        setProctoredInterview(result.interview);
        setProctoredStep(result.interview.currentStep);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [setProctoredInterview, setProctoredStep],
  );

  // ── Schedule interview ──────────────────────────────────────────────
  const scheduleInterview = useCallback(
    async (scheduleData) => {
      try {
        setActionLoading(true);
        setError(null);
        const result = await api.scheduleProctoredInterview(scheduleData);
        setProctoredInterview(result.interview);
        setProctoredStep(result.interview.currentStep);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [setProctoredInterview, setProctoredStep],
  );

  // ── Cancel interview ────────────────────────────────────────────────
  const cancelInterview = useCallback(
    async (reason) => {
      try {
        setActionLoading(true);
        setError(null);
        const result = await api.cancelProctoredInterview(reason);
        setProctoredInterview(result.interview);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [setProctoredInterview],
  );

  // ── Reschedule interview ────────────────────────────────────────────
  const rescheduleInterview = useCallback(
    async (scheduleData) => {
      try {
        setActionLoading(true);
        setError(null);
        const result = await api.rescheduleProctoredInterview(scheduleData);
        setProctoredInterview(result.interview);
        setProctoredStep(result.interview.currentStep);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [setProctoredInterview, setProctoredStep],
  );

  // ── Mark in progress ────────────────────────────────────────────────
  const markInProgress = useCallback(async () => {
    try {
      setError(null);
      const result = await api.markProctoredInProgress();
      setProctoredInterview(result.interview);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [setProctoredInterview]);

  // ── Save progress ──────────────────────────────────────────────────
  const saveProgress = useCallback(
    async (progressData) => {
      try {
        setError(null);
        const result = await api.saveProctoredProgress(progressData);
        setProctoredInterview(result.interview);
        return result;
      } catch (err) {
        console.warn("Failed to save progress:", err.message);
      }
    },
    [setProctoredInterview],
  );

  // ── Start over ──────────────────────────────────────────────────────
  const startOver = useCallback(
    async (payload = {}) => {
      try {
        setActionLoading(true);
        setError(null);
        const result = await api.startOverProctored(payload);
        // Keep the reset interview in state so the UI knows consent is already given
        if (result?.interview) {
          setProctoredInterview(result.interview);
          setProctoredStep(result.interview.currentStep);
        } else {
          setProctoredInterview(null);
          setProctoredStep(0);
        }
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [setProctoredInterview, setProctoredStep],
  );

  // ── Fetch report ────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    try {
      setActionLoading(true);
      setError(null);
      const { interview } = await api.getProctoredReport();
      setProctoredInterview(interview);
      return interview;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [setProctoredInterview]);

  // ── Poll for completion ─────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const result = await api.checkProctoredCompletion();
        if (result.completed) {
          setProctoredInterview(result.interview);
          // Only stop polling when evaluation is also ready
          if (!result.evaluationPending) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (err) {
        console.warn("Completion poll failed:", err.message);
      }
    }, 30000); // Poll every 30 seconds
  }, [setProctoredInterview]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── Resume interview ────────────────────────────────────────────────
  const resumeInterviewAction = useCallback(
    async () => {
      try {
        setActionLoading(true);
        setError(null);
        const result = await api.resumeProctoredInterview();
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [],
  );

  // ── Reset active session ────────────────────────────────────────────────
  const resetActiveSessionAction = useCallback(async () => {
    try {
      setActionLoading(true);
      setError(null);
      const result = await api.resetProctoredSession();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, []);

  // ── Derived state ───────────────────────────────────────────────────
  const isCompleted = useMemo(
    () => proctoredInterview?.status === "COMPLETED",
    [proctoredInterview],
  );

  const isInProgress = useMemo(
    () => proctoredInterview?.status === "IN_PROGRESS",
    [proctoredInterview],
  );

  const isScheduled = useMemo(
    () => proctoredInterview?.status === "SCHEDULED",
    [proctoredInterview],
  );

  const hasExistingInterview = useMemo(
    () =>
      proctoredInterview != null &&
      proctoredInterview.status !== "COMPLETED" &&
      proctoredInterview.status !== "CANCELLED" &&
      proctoredInterview.currentStep > 1,
    [proctoredInterview],
  );

  const interviewUrl = useMemo(
    () => proctoredInterview?.interviewUrl || "",
    [proctoredInterview],
  );

  const isEvaluationPending = useMemo(
    () =>
      proctoredInterview?.status === "COMPLETED" &&
      !proctoredInterview?.evaluation,
    [proctoredInterview],
  );

  const consentAlreadyGiven = useMemo(
    () => proctoredInterview?.consentAcknowledged === true,
    [proctoredInterview],
  );

  // Manual refresh for evaluation status (powers the "Refresh" button)
  const refreshEvaluation = useCallback(async () => {
    try {
      setActionLoading(true);
      setError(null);
      const { interview } = await api.getProctoredStatus();
      setProctoredInterview(interview);
      if (interview?.currentStep) {
        setProctoredStep(interview.currentStep);
      }
      return interview;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setActionLoading(false);
    }
  }, [setProctoredInterview, setProctoredStep]);

  return {
    // State
    interview: proctoredInterview,
    step: proctoredStep,
    loading,
    actionLoading,
    error,
    // Derived
    isCompleted,
    isInProgress,
    isScheduled,
    isEvaluationPending,
    hasExistingInterview,
    interviewUrl,
    consentAlreadyGiven,
    // Actions
    fetchStatus,
    saveConsent,
    findOrCreateOpening,
    createCandidate,
    scheduleInterview,
    cancelInterview,
    rescheduleInterview,
    markInProgress,
    saveProgress,
    startOver,
    fetchReport,
    startPolling,
    stopPolling,
    resumeInterviewAction,
    resetActiveSessionAction,
    refreshEvaluation,
    setError,
  };
}
