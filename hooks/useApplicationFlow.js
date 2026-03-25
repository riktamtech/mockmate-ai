import { useState, useCallback, useEffect } from "react";
import { jobService } from "../services/jobService";

/**
 * useApplicationFlow — State machine for the complete job application flow.
 *
 * Stages:
 *   IDLE → LOADING_PROFILE → FORM → CALCULATING_FITNESS → FITNESS_RESULT
 *   → VALIDATING → VALIDATION_FAILED | SUBMITTING → SUCCESS
 *
 * Supports:
 *   - Saved-details bypass (auto-fill form from CandidateProfile)
 *   - 2-phase backend flow (submit-full → finalize)
 *   - All 4 scheduling modes + approval required
 *   - Feature flag gating
 */

export const FLOW_STAGES = {
  IDLE: "IDLE",
  LOADING_PROFILE: "LOADING_PROFILE",
  FORM: "FORM",
  CALCULATING_FITNESS: "CALCULATING_FITNESS",
  FITNESS_RESULT: "FITNESS_RESULT",
  VALIDATING: "VALIDATING",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  SUBMITTING: "SUBMITTING",
  SUCCESS: "SUCCESS",
  ERROR: "ERROR",
};

const LOADING_MESSAGES = [
  "Analyzing your profile…",
  "Matching skills with requirements…",
  "Evaluating experience relevance…",
  "Calculating your fitness score…",
  "Almost there…",
];

export function useApplicationFlow(job) {
  const [stage, setStage] = useState(FLOW_STAGES.IDLE);
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);

  // Data from backend
  const [fitnessScore, setFitnessScore] = useState(null);
  const [applicationResult, setApplicationResult] = useState(null);
  const [savedProfile, setSavedProfile] = useState(null);
  const [hasSavedDetails, setHasSavedDetails] = useState(false);
  const [cachedResumes, setCachedResumes] = useState([]);
  const [defaultResumeId, setDefaultResumeId] = useState(null);

  // Rotate loading messages during calculation
  useEffect(() => {
    if (stage !== FLOW_STAGES.CALCULATING_FITNESS) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[idx]);
    }, 3000);
    return () => clearInterval(interval);
  }, [stage]);

  /**
   * Internal: submit using saved profile + resume (for bypass flow).
   */
  const submitFormWithSavedData = async (profile, resume) => {
    try {
      setStage(FLOW_STAGES.CALCULATING_FITNESS);
      setLoadingMessage(LOADING_MESSAGES[0]);

      const result = await jobService.submitFullApplication(job._id, {
        resumeText: "", // Server will use cached extracted text from resumeId
        resumeId: resume._id?.toString() || null,
        resumeS3Key: resume.resumeKey || null,
        candidateDetails: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          preferredName: profile.preferredName || "",
          email: profile.email,
          phone: profile.phone,
          experience: profile.experience,
          country: profile.country || "",
        },
        saveDetails: true,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to process");
      }

      if (result.alreadyApplied) {
        setFitnessScore(result.data.fitnessScore);
        setApplicationResult(result.data);
        setStage(FLOW_STAGES.SUCCESS);
        return;
      }

      setFitnessScore(result.data.fitnessScore);
      setStage(FLOW_STAGES.FITNESS_RESULT);
    } catch (err) {
      console.error("submitFormWithSavedData error:", err);
      // Fall back to showing the form
      setStage(FLOW_STAGES.FORM);
    }
  };

  /**
   * Start the application flow: load saved profile + resumes, then show form.
   * If user previously consented to save details AND has a default resume,
   * skip form and go directly to fitness scoring.
   */
  const startFlow = useCallback(async () => {
    try {
      setStage(FLOW_STAGES.LOADING_PROFILE);
      setError(null);
      setFitnessScore(null);
      setApplicationResult(null);

      const profileRes = await jobService.getCandidateProfile();
      const profile = profileRes?.data || null;
      const resumes = profileRes?.resumes || [];
      const defResumeId = profileRes?.defaultResumeId || null;

      setSavedProfile(profile);
      setCachedResumes(resumes);
      setDefaultResumeId(defResumeId);

      const hasSaved = !!(profile && profile.savedDetails);
      setHasSavedDetails(hasSaved);

      // Skip form if user explicitly consented AND has profile + default resume
      if (hasSaved && profile.firstName && profile.email && defResumeId) {
        const defResume = resumes.find(
          (r) =>
            r._id === defResumeId ||
            r._id?.toString() === defResumeId?.toString(),
        );
        if (defResume) {
          await submitFormWithSavedData(profile, defResume);
          return;
        }
      }

      setStage(FLOW_STAGES.FORM);
    } catch (err) {
      console.error("Failed to load profile:", err);
      setStage(FLOW_STAGES.FORM);
    }
  }, []);

  /**
   * Phase 1: Submit form data + trigger fitness scoring.
   */
  const submitForm = useCallback(
    async (formData) => {
      try {
        setStage(FLOW_STAGES.CALCULATING_FITNESS);
        setError(null);
        setLoadingMessage(LOADING_MESSAGES[0]);

        const result = await jobService.submitFullApplication(job._id, {
          resumeText: formData.resumeText,
          resumeId: formData.resumeId || null,
          resumeS3Key: formData.resumeS3Key || null,
          candidateDetails: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            preferredName: formData.preferredName,
            email: formData.email,
            phone: formData.phone,
            experience: formData.experience,
            country: formData.country,
          },
          saveDetails: formData.saveDetails ?? false,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to process");
        }

        if (result.alreadyApplied) {
          setFitnessScore(result.data.fitnessScore);
          setApplicationResult(result.data);
          setStage(FLOW_STAGES.SUCCESS);
          return;
        }

        setFitnessScore(result.data.fitnessScore);
        setStage(FLOW_STAGES.FITNESS_RESULT);
      } catch (err) {
        console.error("submitForm error:", err);
        setError(err.message || "Something went wrong");
        setStage(FLOW_STAGES.ERROR);
      }
    },
    [job],
  );

  /**
   * Phase 2: After user reviews score and proceeds.
   */
  const finalizeApplication = useCallback(
    async (formData, scheduledAt = null) => {
      try {
        setStage(FLOW_STAGES.SUBMITTING);
        setError(null);

        const result = await jobService.finalizeApplication(job._id, {
          candidateDetails: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            preferredName: formData.preferredName,
            email: formData.email,
            phone: formData.phone,
            experience: formData.experience,
            country: formData.country,
          },
          resumeId: formData.resumeId || null,
          resumeS3Key: formData.resumeS3Key || null,
          scheduledAt,
        });

        if (!result.success && result.validationFailed) {
          setError(result.error);
          setStage(FLOW_STAGES.VALIDATION_FAILED);
          return;
        }

        if (!result.success) {
          throw new Error(result.error || "Failed to finalize");
        }

        setApplicationResult(result.data);
        setStage(FLOW_STAGES.SUCCESS);
      } catch (err) {
        console.error("finalizeApplication error:", err);
        setError(err.message || "Something went wrong");
        setStage(FLOW_STAGES.ERROR);
      }
    },
    [job],
  );

  /**
   * Reset the flow to idle state.
   */
  const resetFlow = useCallback(() => {
    setStage(FLOW_STAGES.IDLE);
    setError(null);
    setFitnessScore(null);
    setApplicationResult(null);
    setLoadingMessage(LOADING_MESSAGES[0]);
  }, []);

  /**
   * Go back to form from fitness result.
   */
  const goBackToForm = useCallback(() => {
    setStage(FLOW_STAGES.FORM);
  }, []);

  return {
    // State
    stage,
    error,
    loadingMessage,
    fitnessScore,
    applicationResult,
    savedProfile,
    hasSavedDetails,
    cachedResumes,
    defaultResumeId,

    // Actions
    startFlow,
    submitForm,
    finalizeApplication,
    resetFlow,
    goBackToForm,
    setStage,
  };
}
