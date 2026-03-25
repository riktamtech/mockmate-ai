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
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import VerifiedBadge from "../ui/VerifiedBadge";
import { jobService } from "../../services/jobService";
import LifecycleTracker from "./LifecycleTracker";

/**
 * JobDetailView — Slide-in drawer showing full job opening details.
 * Fully theme-aware via CSS custom properties.
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
        gradient: "var(--accent-gradient)",
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
          gradient: "var(--accent-gradient)",
        };
    }
  };

  const applyConfig = getApplyButtonConfig();

  const coreSkills = job?.coreSkills || [];
  const groupedSkills = job?.skillsGroup ? job.skillsGroup.flatMap(g => g.skills || []) : [];
  const allSkills = [...new Set([...coreSkills, ...groupedSkills])];

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
              background: "var(--backdrop)",
              backdropFilter: "blur(4px)",
              zIndex: 100,
            }}
          />

          {/* Modal Container */}
          <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 101,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            pointerEvents: "none",
          }}>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              style={{
                width: "100%",
                maxWidth: "640px",
                maxHeight: "90vh",
                background: "var(--bg-surface)",
                backdropFilter: "blur(20px)",
                borderRadius: "24px",
                boxShadow: "0 24px 48px rgba(0, 0, 0, 0.2), 0 0 0 1px var(--border)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "auto",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "24px 28px 20px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "22px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {job?.title || "Loading..."}
                    </h2>
                    {job?.source === "zinterview" && (
                      <VerifiedBadge />
                    )}
                  </div>
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                    {job?.orgName || "Company"}
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  style={{
                    background: "var(--hover-overlay-medium)",
                    border: "none",
                    borderRadius: "12px",
                    padding: "8px",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex",
                  }}
                >
                  <X size={20} />
                </motion.button>
              </div>

            {/* Content Area */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "0 28px 24px",
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
                      border: "3px solid var(--spinner-track)",
                      borderTop: "3px solid var(--spinner-fill)",
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
                    background: "var(--error-bg)",
                    border: "1px solid var(--error)",
                    color: "var(--error)",
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
                  style={{ display: "flex", flexDirection: "column", gap: "28px" }}
                >
                  {/* Top Metric Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
                    <div style={{ padding: "16px", borderRadius: "16px", background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <Briefcase size={14} /> Role
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Engineering</div>
                    </div>
                    <div style={{ padding: "16px", borderRadius: "16px", background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <Clock size={14} /> Type
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{job.jobType || "Full-time"}</div>
                    </div>
                    <div style={{ padding: "16px", borderRadius: "16px", background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <MapPin size={14} /> Location
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{job.location || "Remote"}</div>
                    </div>
                    <div style={{ padding: "16px", borderRadius: "16px", background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <Users size={14} /> Experience
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{experienceText || "Not specified"}</div>
                    </div>
                  </div>

                  {/* About the Role */}
                  {job.description && (
                    <div>
                      <h4
                        style={{
                          margin: "0 0 12px",
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        About the role
                      </h4>
                      <div
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "14px",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {job.description}
                      </div>
                    </div>
                  )}

                  {/* Requirements List */}
                  {job.jobRequirementsAndResponsibilities?.length > 0 && (
                    <div>
                      <h4
                        style={{
                          margin: "0 0 16px",
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        Requirements
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        {job.jobRequirementsAndResponsibilities.map(
                          (req, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "10px",
                              }}
                            >
                              <div style={{ marginTop: "3px", color: "var(--success)" }}>
                                <CheckCircle2 size={16} />
                              </div>
                              <span style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5 }}>
                                {req}
                              </span>
                            </motion.div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Enhanced Skills Section */}
                  <div>
                    <h4
                      style={{
                        margin: "0 0 16px",
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      Skills & Technologies
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      {allSkills.map((skill, i) => (
                        <motion.span
                          key={i}
                          whileHover={{ scale: 1.05, y: -2 }}
                          style={{
                            padding: "6px 16px",
                            borderRadius: "20px",
                            background: "var(--accent-bg)",
                            border: "1px solid var(--accent-bg-hover)",
                            color: "var(--accent-text)",
                            fontSize: "13px",
                            fontWeight: 600,
                            backdropFilter: "blur(8px)",
                            boxShadow: "0 4px 12px var(--accent-bg-hover)",
                          }}
                        >
                          {skill}
                        </motion.span>
                      ))}
                      {allSkills.length === 0 && (
                        <div style={{
                          color: "var(--text-muted)",
                          fontSize: "13px",
                          fontStyle: "italic",
                          padding: "16px",
                          background: "var(--bg-inset)",
                          borderRadius: "16px",
                          width: "100%",
                          textAlign: "center",
                          border: "1px dashed var(--border-subtle)"
                        }}>
                          No specific skills mentioned for this role
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            {job && !loading && (
              <div
                style={{
                  padding: "20px 28px",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--bg-surface)",
                }}
              >
                {/* Resume Match Info */}
                {job.applicationStatus?.fitnessScore != null ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ padding: "8px", background: "var(--success-bg)", color: "var(--success)", borderRadius: "10px" }}>
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                        {job.applicationStatus.fitnessScore}% Match
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        Based on your profile
                      </div>
                    </div>
                  </div>
                ) : (
                  <div /> /* Empty div for flex space-between if no match info */
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <motion.button
                    whileHover={{ backgroundColor: "var(--hover-overlay-medium)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    style={{
                      padding: "12px 20px",
                      borderRadius: "12px",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-primary)",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={!applyConfig.disabled ? { scale: 1.02, boxShadow: "0 8px 16px rgba(124, 58, 237, 0.3)" } : {}}
                    whileTap={!applyConfig.disabled ? { scale: 0.98 } : {}}
                    onClick={() => {
                      if (!applyConfig.disabled) {
                        onApply?.(job);
                      }
                    }}
                    disabled={applyConfig.disabled}
                    style={{
                      padding: "12px 32px",
                      borderRadius: "12px",
                      background: applyConfig.gradient,
                      border: "none",
                      color: "#fff",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: applyConfig.disabled ? "not-allowed" : "pointer",
                      opacity: applyConfig.disabled ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {applyConfig.text}
                    {!applyConfig.disabled && <ChevronRight size={18} />}
                  </motion.button>
                </div>
              </div>
            )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
