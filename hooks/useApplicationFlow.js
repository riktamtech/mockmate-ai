import { useState, useCallback } from "react";
import { jobService } from "../services/jobService";

/**
 * useApplicationFlow — State machine for the full job application flow.
 *
 * Stages:
 * 1. IDLE — Not applying
 * 2. CHECKING_GATE — Checking proctored interview prerequisite
 * 3. FORM — Filling application form
 * 4. UPLOADING_RESUME — Resume upload in progress
 * 5. CALCULATING_FITNESS — Fitness score being computed
 * 6. FITNESS_RESULT — Showing fitness score result
 * 7. SCHEDULING — Time slot selection (TIMEFRAME mode)
 * 8. SUBMITTING — Final submission in progress
 * 9. SUCCESS — Application submitted
 * 10. ERROR — Error occurred
 */

const STAGES = {
  IDLE: "IDLE",
  CHECKING_GATE: "CHECKING_GATE",
  FORM: "FORM",
  UPLOADING_RESUME: "UPLOADING_RESUME",
  CALCULATING_FITNESS: "CALCULATING_FITNESS",
  FITNESS_RESULT: "FITNESS_RESULT",
  SCHEDULING: "SCHEDULING",
  SUBMITTING: "SUBMITTING",
  SUCCESS: "SUCCESS",
  ERROR: "ERROR",
};

export function useApplicationFlow() {
  const [stage, setStage] = useState(STAGES.IDLE);
  const [error, setError] = useState(null);
  const [fitnessResult, setFitnessResult] = useState(null);
  const [applicationData, setApplicationData] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  const startApplication = useCallback((jobOpeningId) => {
    setOpeningId(jobOpeningId);
    setStage(STAGES.FORM);
    setError(null);
    setFitnessResult(null);
  }, []);

  const cancelApplication = useCallback(() => {
    setStage(STAGES.IDLE);
    setError(null);
    setFitnessResult(null);
    setApplicationData(null);
    setOpeningId(null);
  }, []);

  const submitForm = useCallback(async (formData) => {
    setApplicationData(formData);

    if (formData.resumeFile) {
      try {
        setStage(STAGES.UPLOADING_RESUME);
        const uploadResult = await jobService.uploadResume(
          formData.resumeFile,
        );
        formData.resumeId = uploadResult?.data?._id;
        formData.resumeS3Key = uploadResult?.data?.resumeKey;
      } catch (err) {
        setError("Failed to upload resume");
        setStage(STAGES.ERROR);
        return;
      }
    }

    // Calculate fitness score
    try {
      setStage(STAGES.CALCULATING_FITNESS);
      const result = await jobService.calculateFitnessScore(openingId, {
        resumeId: formData.resumeId,
        resumeS3Key: formData.resumeS3Key,
      });
      setFitnessResult(result?.data);
      setStage(STAGES.FITNESS_RESULT);
    } catch (err) {
      setError("Failed to calculate fitness score");
      setStage(STAGES.ERROR);
    }
  }, [openingId]);

  const proceedAfterFitness = useCallback((schedulingMode) => {
    if (schedulingMode === "TIMEFRAME") {
      setStage(STAGES.SCHEDULING);
    } else {
      submitApplication();
    }
  }, []);

  const submitApplication = useCallback(async (scheduledAt = null) => {
    try {
      setStage(STAGES.SUBMITTING);
      await jobService.submitApplication(openingId, {
        ...applicationData,
        fitnessScore: fitnessResult?.score,
        scheduledAt,
      });
      setStage(STAGES.SUCCESS);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit application");
      setStage(STAGES.ERROR);
    }
  }, [openingId, applicationData, fitnessResult]);

  const retry = useCallback(() => {
    setError(null);
    setStage(STAGES.FORM);
  }, []);

  return {
    stage,
    error,
    fitnessResult,
    applicationData,
    openingId,
    STAGES,
    startApplication,
    cancelApplication,
    submitForm,
    proceedAfterFitness,
    submitApplication,
    retry,
  };
}
