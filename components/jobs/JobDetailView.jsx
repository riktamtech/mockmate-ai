import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Briefcase,
  MapPin,
  Clock,
  Building2,
  BadgeCheck,
  ChevronRight,
  ExternalLink,
  Users,
  FileText,
} from "lucide-react";
import { jobService } from "../../services/jobService";
import LifecycleTracker from "./LifecycleTracker";

/**
 * JobDetailView — Slide-in drawer showing full job opening details.
 *
 * Features:
 * - Animated slide-in from right
 * - Full description, skills, requirements
 * - Application status with lifecycle tracker
 * - Apply button with dynamic states
 */

export default function JobDetailView({
  jobId,
  isOpen,
  onClose,
  onApply,
}) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && jobId) {
      fetchJobDetail();
    }
  }, [isOpen, jobId]);

  const fetchJobDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await jobService.getJobOpening(jobId);
      if (response.success) {
        setJob(response.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load job details");
    } finally {
      setLoading(false);
    }
  };

  const experienceText =
    job?.minExperience != null && job?.maxExperience != null
      ? `${job.minExperience}–${job.maxExperience} years`
      : job?.experience
        ? `${job.experience}+ years`
        : "";

  const postedDate = job?.createdAt
    ? new Date(job.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const hasApplied = !!job?.applicationStatus;
  const applicationStatus = job?.applicationStatus?.status;

  const getApplyButtonConfig = () => {
    if (!hasApplied) {
      return {
        text: "Apply Now",
        disabled: false,
        gradient: "linear-gradient(135deg, #8B5CF6, #3B82F6)",
      };
    }
    switch (applicationStatus) {
      case "PENDING_APPROVAL":
        return {
          text: "Application Pending",
          disabled: true,
          gradient: "linear-gradient(135deg, #F59E0B, #EF4444)",
        };
      case "APPROVED":
        return {
          text: "Start Interview",
          disabled: false,
          gradient: "linear-gradient(135deg, #10B981, #3B82F6)",
        };
      case "INTERVIEW_COMPLETED":
        return {
          text: "View Results",
          disabled: false,
          gradient: "linear-gradient(135deg, #6366F1, #8B5CF6)",
        };
      case "REJECTED":
        return {
          text: "Application Declined",
          disabled: true,
          gradient: "linear-gradient(135deg, #6B7280, #9CA3AF)",
        };
      default:
        return {
          text: "View Application",
          disabled: false,
          gradient: "linear-gradient(135deg, #8B5CF6, #3B82F6)",
        };
    }
  };

  const applyConfig = getApplyButtonConfig();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
              zIndex: 100,
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "520px",
              maxWidth: "100vw",
              background: "rgba(18, 18, 30, 0.98)",
              backdropFilter: "blur(20px)",
              borderLeft: "1px solid rgba(255, 255, 255, 0.06)",
              zIndex: 101,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "rgba(255, 255, 255, 0.6)",
                }}
              >
                Job Details
              </span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px",
                  cursor: "pointer",
                  color: "rgba(255, 255, 255, 0.4)",
                  display: "flex",
                }}
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
              }}
            >
              {loading && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "60px",
                  }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    style={{
                      width: "28px",
                      height: "28px",
                      border: "3px solid rgba(139, 92, 246, 0.2)",
                      borderTop: "3px solid #8B5CF6",
                      borderRadius: "50%",
                    }}
                  />
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    color: "rgba(239, 68, 68, 0.8)",
                    fontSize: "13px",
                  }}
                >
                  {error}
                </div>
              )}

              {job && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: "24px" }}
                >
                  {/* Title section */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "20px",
                          fontWeight: 700,
                          color: "#f1f1f4",
                          lineHeight: 1.3,
                        }}
                      >
                        {job.title}
                      </h2>
                      {job.source === "zinterview" && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            padding: "3px 10px",
                            borderRadius: "12px",
                            background: "rgba(16, 185, 129, 0.15)",
                            border: "1px solid rgba(16, 185, 129, 0.25)",
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#10B981",
                          }}
                        >
                          <BadgeCheck size={12} />
                          Verified
                        </span>
                      )}
                    </div>

                    {/* Org + meta */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          color: "rgba(255, 255, 255, 0.5)",
                          fontSize: "13px",
                        }}
                      >
                        <Building2 size={14} />
                        {job.orgName || "Company"}
                      </span>
                      {experienceText && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            color: "rgba(255, 255, 255, 0.4)",
                            fontSize: "13px",
                          }}
                        >
                          <Briefcase size={14} />
                          {experienceText}
                        </span>
                      )}
                      {postedDate && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            color: "rgba(255, 255, 255, 0.3)",
                            fontSize: "12px",
                          }}
                        >
                          <Clock size={12} />
                          {postedDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Skills */}
                  {job.coreSkills?.length > 0 && (
                    <div>
                      <h4
                        style={{
                          margin: "0 0 8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "rgba(255, 255, 255, 0.4)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Required Skills
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        {job.coreSkills.map((skill, i) => (
                          <span
                            key={i}
                            style={{
                              padding: "4px 12px",
                              borderRadius: "10px",
                              background: "rgba(139, 92, 246, 0.12)",
                              border: "1px solid rgba(139, 92, 246, 0.2)",
                              color: "rgba(167, 139, 250, 0.9)",
                              fontSize: "12px",
                              fontWeight: 500,
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {job.description && (
                    <div>
                      <h4
                        style={{
                          margin: "0 0 8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "rgba(255, 255, 255, 0.4)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Description
                      </h4>
                      <div
                        style={{
                          color: "rgba(255, 255, 255, 0.6)",
                          fontSize: "13px",
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {job.description}
                      </div>
                    </div>
                  )}

                  {/* Requirements */}
                  {job.jobRequirementsAndResponsibilities?.length > 0 && (
                    <div>
                      <h4
                        style={{
                          margin: "0 0 8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "rgba(255, 255, 255, 0.4)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Requirements
                      </h4>
                      <ul
                        style={{
                          margin: 0,
                          padding: "0 0 0 16px",
                          color: "rgba(255, 255, 255, 0.5)",
                          fontSize: "13px",
                          lineHeight: 1.8,
                        }}
                      >
                        {job.jobRequirementsAndResponsibilities.map(
                          (req, i) => (
                            <li key={i}>{req}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Interview info */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color: "rgba(255, 255, 255, 0.3)",
                          fontSize: "11px",
                          marginBottom: "4px",
                        }}
                      >
                        Interview Type
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "#f1f1f4",
                          fontSize: "13px",
                          fontWeight: 500,
                        }}
                      >
                        {job.interviewMode || "AI Interview"}
                      </p>
                    </div>
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color: "rgba(255, 255, 255, 0.3)",
                          fontSize: "11px",
                          marginBottom: "4px",
                        }}
                      >
                        Questions
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "#f1f1f4",
                          fontSize: "13px",
                          fontWeight: 500,
                        }}
                      >
                        {job.maxQuestions || "—"} questions
                      </p>
                    </div>
                  </div>

                  {/* Application Status */}
                  {hasApplied && (
                    <div>
                      <h4
                        style={{
                          margin: "0 0 8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "rgba(255, 255, 255, 0.4)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Application Status
                      </h4>
                      <LifecycleTracker
                        currentStage={applicationStatus}
                        lifecycleHistory={
                          job.applicationStatus?.lifecycleHistory || []
                        }
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Footer with Apply button */}
            {job && !loading && (
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <motion.button
                  whileHover={
                    !applyConfig.disabled ? { scale: 1.02 } : {}
                  }
                  whileTap={
                    !applyConfig.disabled ? { scale: 0.98 } : {}
                  }
                  onClick={() => {
                    if (!applyConfig.disabled) {
                      onApply?.(job);
                    }
                  }}
                  disabled={applyConfig.disabled}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    background: applyConfig.gradient,
                    border: "none",
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: applyConfig.disabled
                      ? "not-allowed"
                      : "pointer",
                    opacity: applyConfig.disabled ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {applyConfig.text}
                  {!applyConfig.disabled && (
                    <ChevronRight size={18} />
                  )}
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
