import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  MapPin,
  Clock,
  ChevronRight,
  Building2,
  BadgeCheck,
} from "lucide-react";

/**
 * JobCard — Animated job listing card for the Mockmate AI portal.
 *
 * Shows title, org, location, skills, posted date, status badges.
 * Framer Motion entrance + hover animations.
 */

const MAX_SKILLS_SHOWN = 4;

export default function JobCard({ job, index = 0, onView, onApply }) {
  const [isHovered, setIsHovered] = useState(false);

  const postedDate = job?.createdAt
    ? new Date(job.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const skills = job?.coreSkills || [];
  const visibleSkills = skills.slice(0, MAX_SKILLS_SHOWN);
  const extraSkillsCount = Math.max(0, skills.length - MAX_SKILLS_SHOWN);

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
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.01, y: -2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => onView?.(job)}
      style={{
        background: "rgba(30, 30, 45, 0.6)",
        backdropFilter: "blur(12px)",
        border: isHovered
          ? "1px solid rgba(139, 92, 246, 0.4)"
          : "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "16px",
        padding: "20px 24px",
        cursor: "pointer",
        transition: "border-color 0.3s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Gradient glow on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "radial-gradient(ellipse at top left, rgba(139, 92, 246, 0.08), transparent 60%)",
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Left content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + Org */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "6px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                color: "#f1f1f4",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {job?.title || "Untitled Opening"}
            </h3>
            {job?.source === "zinterview" && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#10B981",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <BadgeCheck size={12} />
                Verified
              </motion.span>
            )}
          </div>

          {/* Org name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "12px",
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: "13px",
            }}
          >
            <Building2 size={13} />
            <span>{job?.orgName || "Company"}</span>
          </div>

          {/* Meta row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "12px",
              flexWrap: "wrap",
            }}
          >
            {job?.location && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "rgba(255, 255, 255, 0.45)",
                  fontSize: "12px",
                }}
              >
                <MapPin size={12} />
                {job.location}
              </span>
            )}
            {experienceText && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "rgba(255, 255, 255, 0.45)",
                  fontSize: "12px",
                }}
              >
                <Briefcase size={12} />
                {experienceText}
              </span>
            )}
            {postedDate && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "rgba(255, 255, 255, 0.35)",
                  fontSize: "12px",
                }}
              >
                <Clock size={12} />
                {postedDate}
              </span>
            )}
          </div>

          {/* Skills */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            {visibleSkills.map((skill, i) => (
              <span
                key={i}
                style={{
                  padding: "3px 10px",
                  borderRadius: "10px",
                  background: "rgba(139, 92, 246, 0.12)",
                  border: "1px solid rgba(139, 92, 246, 0.2)",
                  color: "rgba(167, 139, 250, 0.9)",
                  fontSize: "11px",
                  fontWeight: 500,
                }}
              >
                {skill}
              </span>
            ))}
            {extraSkillsCount > 0 && (
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "rgba(255, 255, 255, 0.4)",
                  fontSize: "11px",
                }}
              >
                +{extraSkillsCount}
              </span>
            )}
          </div>
        </div>

        {/* Right: CTA */}
        <motion.div
          animate={{
            x: isHovered ? 4 : 0,
            opacity: isHovered ? 1 : 0.4,
          }}
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            paddingTop: "8px",
          }}
        >
          <ChevronRight size={20} color="rgba(139, 92, 246, 0.8)" />
        </motion.div>
      </div>
    </motion.div>
  );
}
