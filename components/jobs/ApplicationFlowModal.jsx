import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sparkles, ChevronRight, ArrowLeft,
  CheckCircle2, AlertTriangle, Clock, Zap,
  CalendarCheck, Send, Loader2, FileText,
} from "lucide-react";
import { useApplicationFlow, FLOW_STAGES } from "../../hooks/useApplicationFlow";
import ApplicationForm from "./ApplicationForm";
import FitnessScoreDisplay from "./FitnessScoreDisplay";
import SchedulingPicker from "./SchedulingPicker";

/**
 * ApplicationFlowModal — Orchestrator for the entire apply journey.
 *
 * Flow: Form → Cinematic Loading → FitnessScore → Finalize → Success
 * Fully theme-aware via CSS custom properties.
 */

const BACKDROP_STYLE = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(6px)",
  zIndex: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
};

const MODAL_STYLE = {
  width: "100%",
  maxWidth: "580px",
  maxHeight: "90vh",
  background: "var(--bg-surface)",
  borderRadius: "24px",
  boxShadow: "0 24px 80px rgba(0,0,0,0.3), 0 0 0 1px var(--border)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

export default function ApplicationFlowModal({ job, isOpen, onClose, onSuccess, editMode = false }) {
  const {
    stage, error, loadingMessage, fitnessScore,
    applicationResult, savedProfile, hasSavedDetails,
    cachedResumes, defaultResumeId,
    startFlow, submitForm, finalizeApplication, resetFlow, goBackToForm,
  } = useApplicationFlow(job);

  const [formData, setFormData] = useState(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  useEffect(() => {
    if (isOpen && (job || editMode)) {
      startFlow();
    }
    return () => {
      if (!isOpen) resetFlow();
    };
  }, [isOpen, job, editMode]);

  const handleFormSubmit = useCallback(async (data) => {
    if (editMode) {
      // In edit mode, save profile and close
      try {
        const { jobService } = await import("../../services/jobService");
        await jobService.saveCandidateProfile({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          experience: data.experience,
          country: data.country,
          savedDetails: data.saveDetails ?? true,
        });
        onSuccess?.();
        handleClose();
      } catch (err) {
        console.error("Save profile error:", err);
      }
      return;
    }
    setFormData(data);
    submitForm(data);
  }, [submitForm, editMode, onSuccess]);

  const handleProceed = useCallback(() => {
    if (!formData) return;
    const schedulingMode = job?.mockmateConfig?.schedulingMode || "ANYTIME";
    if (schedulingMode === "TIMEFRAME") {
      setShowSchedulePicker(true);
    } else {
      finalizeApplication(formData);
    }
  }, [formData, job, finalizeApplication]);

  const handleScheduleSelect = useCallback((isoDate) => {
    setShowSchedulePicker(false);
    finalizeApplication(formData, isoDate);
  }, [formData, finalizeApplication]);

  const handleClose = () => {
    resetFlow();
    onClose?.();
  };

  const handleSuccessAction = () => {
    onSuccess?.(applicationResult);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={BACKDROP_STYLE}
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          style={MODAL_STYLE}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <ModalHeader
            stage={stage}
            jobTitle={job?.title}
            orgName={job?.orgName}
            onClose={handleClose}
            onBack={stage === FLOW_STAGES.FITNESS_RESULT ? goBackToForm : null}
            editMode={editMode}
          />

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 28px" }}>
            <AnimatePresence mode="wait">
              {/* Loading Profile */}
              {stage === FLOW_STAGES.LOADING_PROFILE && (
                <StageAnimation key="loading-profile">
                  <LoadingSpinner message="Loading your profile…" />
                </StageAnimation>
              )}

              {/* Application Form */}
              {stage === FLOW_STAGES.FORM && (
                <StageAnimation key="form">
                  <ApplicationForm
                    job={job}
                    savedProfile={savedProfile}
                    cachedResumes={cachedResumes}
                    defaultResumeId={defaultResumeId}
                    onSubmit={handleFormSubmit}
                    onCancel={handleClose}
                    editMode={editMode}
                  />
                </StageAnimation>
              )}

              {/* Calculating Fitness */}
              {stage === FLOW_STAGES.CALCULATING_FITNESS && (
                <StageAnimation key="calculating">
                  <CinematicLoading message={loadingMessage} />
                </StageAnimation>
              )}

              {/* Fitness Result */}
              {stage === FLOW_STAGES.FITNESS_RESULT && (
                <StageAnimation key="fitness-result">
                  {showSchedulePicker ? (
                    <SchedulingPicker
                      timeFrame={job?.mockmateConfig?.schedulingTimeFrame}
                      onSelect={handleScheduleSelect}
                      onCancel={() => setShowSchedulePicker(false)}
                    />
                  ) : (
                    <FitnessScoreDisplay
                      score={fitnessScore?.score}
                      label={fitnessScore?.fitnessLabel}
                      rating={fitnessScore?.candidateFitRating}
                      justification={fitnessScore?.justification}
                      breakdown={fitnessScore?.breakdown}
                      cached={fitnessScore?.cached}
                      onProceed={handleProceed}
                      onCancel={goBackToForm}
                    />
                  )}
                </StageAnimation>
              )}

              {/* Submitting */}
              {stage === FLOW_STAGES.SUBMITTING && (
                <StageAnimation key="submitting">
                  <LoadingSpinner message="Finalizing your application…" />
                </StageAnimation>
              )}

              {/* Validation Failed */}
              {stage === FLOW_STAGES.VALIDATION_FAILED && (
                <StageAnimation key="validation-failed">
                  <ValidationFailed
                    error={error}
                    onRetry={goBackToForm}
                    onClose={handleClose}
                  />
                </StageAnimation>
              )}

              {/* Success */}
              {stage === FLOW_STAGES.SUCCESS && (
                <StageAnimation key="success">
                  <SuccessState
                    result={applicationResult}
                    jobTitle={job?.title}
                    onAction={handleSuccessAction}
                  />
                </StageAnimation>
              )}

              {/* Error */}
              {stage === FLOW_STAGES.ERROR && (
                <StageAnimation key="error">
                  <ErrorState error={error} onRetry={startFlow} onClose={handleClose} />
                </StageAnimation>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function StageAnimation({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

function ModalHeader({ stage, jobTitle, orgName, onClose, onBack, editMode }) {
  const getStageLabel = () => {
    switch (stage) {
      case FLOW_STAGES.FORM: return "Apply";
      case FLOW_STAGES.CALCULATING_FITNESS: return "Analyzing";
      case FLOW_STAGES.FITNESS_RESULT: return "Your Fit Score";
      case FLOW_STAGES.SUBMITTING: return "Submitting";
      case FLOW_STAGES.SUCCESS: return "Success!";
      case FLOW_STAGES.VALIDATION_FAILED: return "Not Eligible";
      case FLOW_STAGES.ERROR: return "Error";
      default: return "Apply";
    }
  };

  return (
    <div style={{
      padding: "20px 28px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid var(--border-subtle)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {onBack && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            style={{
              background: "var(--hover-overlay-medium)",
              border: "none", borderRadius: "10px",
              padding: "6px", cursor: "pointer",
              color: "var(--text-muted)", display: "flex",
            }}
          >
            <ArrowLeft size={18} />
          </motion.button>
        )}
        <div>
          <div style={{
            fontSize: "10px", fontWeight: 700,
            color: "var(--accent-text)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            marginBottom: "2px",
          }}>
            {editMode ? "Settings" : getStageLabel()}
          </div>
          <div style={{
            fontSize: "16px", fontWeight: 700,
            color: "var(--text-primary)",
          }}>
            {editMode ? "Application Profile" : (jobTitle || "Job Application")}
          </div>
          {!editMode && orgName && (
            <div style={{
              fontSize: "12px", color: "var(--text-muted)",
            }}>
              {orgName}
            </div>
          )}
        </div>
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        style={{
          background: "var(--hover-overlay-medium)",
          border: "none", borderRadius: "12px",
          padding: "8px", cursor: "pointer",
          color: "var(--text-muted)", display: "flex",
        }}
      >
        <X size={18} />
      </motion.button>
    </div>
  );
}

function CinematicLoading({ message }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "60px 20px",
      gap: "24px",
    }}>
      <motion.div
        animate={{
          rotate: [0, 360],
          scale: [1, 1.15, 1],
        }}
        transition={{
          rotate: { duration: 3, repeat: Infinity, ease: "linear" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
        style={{
          width: "72px", height: "72px",
          borderRadius: "20px",
          background: "var(--accent-gradient)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 16px 48px rgba(139,92,246,0.4)",
        }}
      >
        <Sparkles size={32} color="#fff" />
      </motion.div>

      <motion.p
        key={message}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        style={{
          fontSize: "15px", fontWeight: 600,
          color: "var(--text-secondary)",
          textAlign: "center",
          margin: 0,
        }}
      >
        {message}
      </motion.p>

      {/* Progress bar */}
      <div style={{
        width: "180px", height: "4px",
        borderRadius: "4px",
        background: "var(--hover-overlay-medium)",
        overflow: "hidden",
      }}>
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: "40%", height: "100%",
            borderRadius: "4px",
            background: "var(--accent-gradient)",
          }}
        />
      </div>
    </div>
  );
}

function LoadingSpinner({ message }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "60px 20px",
      gap: "16px",
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 size={28} style={{ color: "var(--accent)" }} />
      </motion.div>
      <p style={{
        fontSize: "14px", color: "var(--text-secondary)",
        fontWeight: 500, margin: 0,
      }}>
        {message}
      </p>
    </div>
  );
}

function ValidationFailed({ error, onRetry, onClose }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "40px 20px",
      gap: "20px",
    }}>
      <div style={{
        width: "64px", height: "64px",
        borderRadius: "18px",
        background: "linear-gradient(135deg, #F59E0B, #EF4444)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 12px 40px rgba(239,68,68,0.3)",
      }}>
        <AlertTriangle size={28} color="#fff" />
      </div>
      <h3 style={{
        margin: 0, fontSize: "18px", fontWeight: 700,
        color: "var(--text-primary)", textAlign: "center",
      }}>
        Below Minimum Threshold
      </h3>
      <p style={{
        margin: 0, fontSize: "14px",
        color: "var(--text-secondary)",
        textAlign: "center", lineHeight: 1.7,
      }}>
        {error || "Your profile doesn't meet the minimum requirements for this position."}
      </p>
      <div style={{ display: "flex", gap: "12px", width: "100%" }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          style={{
            flex: 1, padding: "12px",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer", fontSize: "13px", fontWeight: 500,
          }}
        >
          Close
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRetry}
          style={{
            flex: 2, padding: "12px",
            borderRadius: "12px",
            background: "var(--accent-gradient)",
            border: "none", color: "#fff",
            cursor: "pointer", fontSize: "13px", fontWeight: 600,
          }}
        >
          Try with Different Resume
        </motion.button>
      </div>
    </div>
  );
}

function SuccessState({ result, jobTitle, onAction }) {
  const schedulingMode = result?.schedulingMode || "ANYTIME";
  const approvalRequired = result?.approvalRequired;
  const interviewUrl = result?.interviewUrl;

  const getConfig = () => {
    if (approvalRequired) {
      return {
        icon: <Clock size={28} color="#fff" />,
        gradient: "linear-gradient(135deg, #F59E0B, #F97316)",
        title: "Application Submitted",
        subtitle: "Your application has been sent to the hiring team. They'll review your profile and get back to you soon.",
        buttonText: "Done",
        buttonAction: onAction,
      };
    }
    switch (schedulingMode) {
      case "MANUAL":
        return {
          icon: <CalendarCheck size={28} color="#fff" />,
          gradient: "linear-gradient(135deg, #3B82F6, #6366F1)",
          title: "Application Approved!",
          subtitle: "The HR team will reach out to schedule your interview. Keep an eye on your notifications.",
          buttonText: "Done",
          buttonAction: onAction,
        };
      case "IMMEDIATE":
        return {
          icon: <Zap size={28} color="#fff" />,
          gradient: "linear-gradient(135deg, #10B981, #059669)",
          title: "Ready to Interview!",
          subtitle: "Your application was approved instantly. Start your interview now.",
          buttonText: "Start Interview Now",
          buttonAction: () => {
            if (interviewUrl) window.open(interviewUrl, "_blank");
            onAction();
          },
        };
      case "TIMEFRAME":
        return {
          icon: <CalendarCheck size={28} color="#fff" />,
          gradient: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
          title: "Interview Scheduled!",
          subtitle: "Your interview has been scheduled. You'll receive a reminder before it begins.",
          buttonText: "View Details",
          buttonAction: onAction,
        };
      case "ANYTIME":
      default:
        return {
          icon: <Send size={28} color="#fff" />,
          gradient: "linear-gradient(135deg, #10B981, #3B82F6)",
          title: "Application Approved!",
          subtitle: "You can start your interview at any time that suits you.",
          buttonText: interviewUrl ? "Start Interview" : "Done",
          buttonAction: () => {
            if (interviewUrl) window.open(interviewUrl, "_blank");
            onAction();
          },
        };
    }
  };

  const config = getConfig();

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "40px 20px",
      gap: "20px",
    }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 12, stiffness: 200 }}
        style={{
          width: "72px", height: "72px",
          borderRadius: "20px",
          background: config.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 16px 48px rgba(16,185,129,0.3)",
        }}
      >
        {config.icon}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ textAlign: "center" }}
      >
        <h3 style={{
          margin: "0 0 8px", fontSize: "20px",
          fontWeight: 700, color: "var(--text-primary)",
        }}>
          {config.title}
        </h3>
        <p style={{
          margin: 0, fontSize: "14px",
          color: "var(--text-secondary)",
          lineHeight: 1.7,
        }}>
          {config.subtitle}
        </p>
      </motion.div>

      {result?.fitnessScore != null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            padding: "12px 20px",
            borderRadius: "12px",
            background: "var(--bg-inset)",
            border: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", gap: "10px",
          }}
        >
          <Sparkles size={16} style={{ color: "var(--accent)" }} />
          <span style={{
            fontSize: "13px", fontWeight: 600,
            color: "var(--text-primary)",
          }}>
            {result.fitnessScore}% Match
          </span>
          <span style={{
            fontSize: "12px",
            color: "var(--text-muted)",
          }}>
            {result.fitnessLabel?.replace("_", " ")}
          </span>
        </motion.div>
      )}

      <motion.button
        whileHover={{ scale: 1.02, boxShadow: "0 8px 24px rgba(124,58,237,0.3)" }}
        whileTap={{ scale: 0.98 }}
        onClick={config.buttonAction}
        style={{
          width: "100%", padding: "14px",
          borderRadius: "12px",
          background: config.gradient,
          border: "none", color: "#fff",
          cursor: "pointer", fontSize: "15px",
          fontWeight: 600,
          display: "flex", alignItems: "center",
          justifyContent: "center", gap: "8px",
        }}
      >
        {config.buttonText}
        <ChevronRight size={18} />
      </motion.button>
    </div>
  );
}

function ErrorState({ error, onRetry, onClose }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "40px 20px",
      gap: "20px",
    }}>
      <div style={{
        width: "64px", height: "64px",
        borderRadius: "18px",
        background: "linear-gradient(135deg, #EF4444, #DC2626)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <AlertTriangle size={28} color="#fff" />
      </div>
      <h3 style={{
        margin: 0, fontSize: "18px", fontWeight: 700,
        color: "var(--text-primary)", textAlign: "center",
      }}>
        Something went wrong
      </h3>
      <p style={{
        margin: 0, fontSize: "14px",
        color: "var(--text-secondary)",
        textAlign: "center",
      }}>
        {error || "Please try again later."}
      </p>
      <div style={{ display: "flex", gap: "12px", width: "100%" }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          style={{
            flex: 1, padding: "12px", borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            background: "transparent", color: "var(--text-muted)",
            cursor: "pointer", fontSize: "13px",
          }}
        >
          Close
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onRetry}
          style={{
            flex: 2, padding: "12px", borderRadius: "12px",
            background: "var(--accent-gradient)", border: "none",
            color: "#fff", cursor: "pointer",
            fontSize: "13px", fontWeight: 600,
          }}
        >
          Try Again
        </motion.button>
      </div>
    </div>
  );
}
