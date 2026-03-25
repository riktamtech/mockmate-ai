import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Clock,
  Building2,
  BadgeCheck,
  Briefcase,
  Sparkles,
  ChevronRight,
  Zap,
} from "lucide-react";
import VerifiedBadge from "../ui/VerifiedBadge";

/**
 * JobCard — Redesigned job listing card with 2-column grid layout.
 * Inspired by the Candidate Portal design mockups.
 * Features: status badge, left accent, skills tags, Apply Now button.
 */

// Removed hardcoded MAX_SKILLS_SHOWN

function getTimeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? "s" : ""} ago`;
}

function getStatusBadge(job) {
  const createdAt = job?.createdAt ? new Date(job.createdAt) : null;
  const now = new Date();
  const diffDays = createdAt ? Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)) : 999;

  if (job?.applicationStatus === "INTERVIEW_COMPLETED") {
    return { label: "Completed", color: "#6366F1", bgColor: "rgba(99, 102, 241, 0.1)" };
  }
  if (job?.applicationStatus === "INTERVIEW_IN_PROGRESS") {
    return { label: "In Progress", color: "#3B82F6", bgColor: "rgba(59, 130, 246, 0.1)" };
  }
  if (job?.applicationStatus) {
    return { label: "Applied", color: "#8B5CF6", bgColor: "rgba(139, 92, 246, 0.1)" };
  }
  if (diffDays <= 2) {
    return { label: "New", color: "#10B981", bgColor: "rgba(16, 185, 129, 0.1)" };
  }
  if (diffDays <= 7) {
    return { label: "Open", color: "#7c3aed", bgColor: "rgba(124, 58, 237, 0.1)" };
  }
  return { label: "Closing Soon", color: "#F59E0B", bgColor: "rgba(245, 158, 11, 0.1)" };
}

const accentColors = [
  "linear-gradient(180deg, #7c3aed, #a78bfa)",
  "linear-gradient(180deg, #3B82F6, #60a5fa)",
  "linear-gradient(180deg, #10B981, #34d399)",
  "linear-gradient(180deg, #F59E0B, #fbbf24)",
  "linear-gradient(180deg, #EF4444, #f87171)",
  "linear-gradient(180deg, #6366F1, #818cf8)",
];

export default function JobCard({ job, index = 0, onView }) {
  const [isHovered, setIsHovered] = useState(false);

  const coreSkills = job?.coreSkills || [];
  const groupedSkills = job?.skillsGroup ? job.skillsGroup.flatMap(g => g.skills || []) : [];
  const allSkills = [...new Set([...coreSkills, ...groupedSkills])];
  
  // Dynamically calculate visible skills based on character length 
  // to perfectly fit 2-3 lines (~90 characters total including padding)
  let visibleCount = 0;
  let currentChars = 0;
  const MAX_CHARS = 100;
  for (let skill of allSkills) {
    currentChars += skill.length + 4; // approximate padding per item
    if (currentChars > MAX_CHARS && visibleCount > 0) break;
    visibleCount++;
  }
  
  const visibleSkills = allSkills.slice(0, visibleCount);
  const extraSkillsCount = allSkills.length - visibleCount;
  const timeAgo = getTimeAgo(job?.createdAt);
  const statusBadge = getStatusBadge(job);
  const accentColor = accentColors[index % accentColors.length];

  const experienceText =
    job?.minExperience != null && job?.maxExperience != null
      ? `${job.minExperience}–${job.maxExperience} yrs`
      : job?.experience
        ? `${job.experience}+ yrs`
        : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => onView?.(job)}
      style={{
        background: "var(--bg-surface)",
        border: isHovered ? "1px solid var(--accent-bg-hover)" : "1px solid var(--border-subtle)",
        borderRadius: "16px",
        padding: 0,
        cursor: "pointer",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s",
        position: "relative",
        boxShadow: isHovered ? "var(--shadow-card-hover)" : "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: "absolute",
        top: "12px",
        left: 0,
        bottom: "12px",
        width: "4px",
        borderRadius: "16px 0 0 16px",
        background: accentColor,
        zIndex: 2,
      }} />

      {/* Floating Verified Badge with Text */}
      {job?.source === "zinterview" && (
        <div style={{
          position: "absolute",
          top: 0,
          right: "6px",
          transform: "translateY(-50%)",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "0 8px", // Cuts the border seamlessly
          background: "var(--bg-base)", // Matches the page background masking the border line beneath
        }}>
          <motion.span
            // animate={{ backgroundPosition: ["150% center", "-50% center"] }}
            // transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
            style={{
               background: "linear-gradient(-45deg, #F59E0B 40%, #FFF 15%, #F59E0B 60%)",
               backgroundSize: "200% auto",
               WebkitBackgroundClip: "text",
               WebkitTextFillColor: "transparent",
               color: "#F59E0B",
               textShadow: "0 0 8px rgba(245, 158, 11, 0.4)",
               fontSize: "10px",
               fontWeight: 800,
               letterSpacing: "0.5px",
               textTransform: "uppercase",
               whiteSpace: "nowrap"
            }}
          >
            ZI Verified Hiring
          </motion.span>
          <VerifiedBadge showText={false} />
        </div>
      )}

      {/* Gradient glow on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "100%",
              borderRadius: "16px",
              background: "radial-gradient(ellipse at top left, var(--accent-bg), transparent 70%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      <div style={{ padding: "20px 20px 16px 20px", flex: 1, position: "relative", zIndex: 1 }}>
        {/* Header: Company icon + status badge */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Company avatar */}
            <div style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: accentColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(124, 58, 237, 0.2)",
            }}>
              {job?.orgLogoUrl ? (
                <img src={job.orgLogoUrl} alt="" style={{ width: "24px", height: "24px", borderRadius: "6px", objectFit: "cover" }} />
              ) : (
                <Building2 size={18} color="#fff" />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {job?.title || "Untitled Opening"}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                  {job?.orgName || "Company"}
                </span>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <span style={{
            padding: "3px 10px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: 600,
            color: statusBadge.color,
            background: statusBadge.bgColor,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}>
            {statusBadge.label}
          </span>
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
          {job?.location && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-muted)", fontSize: "12px" }}>
              <MapPin size={12} />
              {job.location}
            </span>
          )}
          {job?.jobType && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-muted)", fontSize: "12px" }}>
              <Clock size={12} />
              {job.jobType}
            </span>
          )}
          {experienceText && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-muted)", fontSize: "12px" }}>
              <Briefcase size={12} />
              {experienceText}
            </span>
          )}
        </div>

        {/* Skills */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {visibleSkills.map((skill, i) => (
            <motion.span
              key={i}
              whileHover={{ scale: 1.05, y: -2 }}
              style={{
                padding: "4px 12px",
                borderRadius: "12px",
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-bg-hover)",
                color: "var(--accent-text)",
                fontSize: "11px",
                fontWeight: 600,
                boxShadow: "0 2px 6px var(--accent-bg-hover)",
              }}
            >
              {skill}
            </motion.span>
          ))}
          {extraSkillsCount > 0 && (
            <span style={{
              padding: "3px 10px",
              borderRadius: "8px",
              background: "var(--hover-overlay-medium)",
              color: "var(--text-muted)",
              fontSize: "11px",
            }}>
              +{extraSkillsCount}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 20px",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "relative",
        zIndex: 1,
      }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Posted {timeAgo}
        </span>

        {/* State-aware apply button */}
        {(() => {
          const appStatus = job?.applicationStatus;
          if (appStatus === "INTERVIEW_COMPLETED") {
            return (
              <span style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "7px 16px", borderRadius: "10px",
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "#10B981", fontSize: "12px", fontWeight: 600,
              }}>
                ✓ Completed
              </span>
            );
          }
          if (appStatus === "INTERVIEW_IN_PROGRESS") {
            return (
              <span style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "7px 16px", borderRadius: "10px",
                background: "rgba(59,130,246,0.1)",
                border: "1px solid rgba(59,130,246,0.3)",
                color: "#3B82F6", fontSize: "12px", fontWeight: 600,
              }}>
                ⏳ In Progress
              </span>
            );
          }
          if (appStatus) {
            return (
              <span style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "7px 16px", borderRadius: "10px",
                background: "rgba(139,92,246,0.1)",
                border: "1px solid rgba(139,92,246,0.3)",
                color: "#8B5CF6", fontSize: "12px", fontWeight: 600,
              }}>
                ✓ Applied
              </span>
            );
          }
          return (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={(e) => {
                e.stopPropagation();
                onView?.(job);
              }}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "7px 16px", borderRadius: "10px",
                background: "var(--accent-gradient)",
                border: "none", color: "#fff",
                fontSize: "12px", fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
              }}
            >
              <Zap size={12} />
              Apply Now
            </motion.button>
          );
        })()}
      </div>
    </motion.div>
  );
}
