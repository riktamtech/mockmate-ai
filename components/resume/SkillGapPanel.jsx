import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Target,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { api } from "../../services/api";

/**
 * SkillGapPanel — Shows skill gap analysis between a candidate's
 * CentralisedResume and a specific job opening's requirements.
 *
 * Props:
 *  - openingId: string - The job opening ID
 *  - compact: boolean - Use compact mode (for inline in job cards)
 */

export default function SkillGapPanel({ openingId, compact = false }) {
  const [gap, setGap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    if (!openingId) return;

    let cancelled = false;
    const fetchGap = async () => {
      try {
        setLoading(true);
        const res = await api.getSkillGap(openingId);
        if (!cancelled) setGap(res.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchGap();
    return () => { cancelled = true; };
  }, [openingId]);

  if (loading) {
    return (
      <div
        className="rounded-xl p-4 flex items-center gap-2"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="w-4 h-4 rounded-full animate-spin"
          style={{
            border: "2px solid var(--border)",
            borderTopColor: "var(--accent)",
          }}
        />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Analyzing skill gap...
        </span>
      </div>
    );
  }

  if (error || !gap) return null;

  const { matchedSkills = [], missingSkills = [], coveragePercent = 0 } = gap;

  const getBarColor = (pct) => {
    if (pct >= 80) return "var(--success)";
    if (pct >= 50) return "var(--warning)";
    return "var(--error)";
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Target size={16} style={{ color: "var(--accent)" }} />
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Skill Gap Analysis
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: `${getBarColor(coveragePercent)}20`,
              color: getBarColor(coveragePercent),
            }}
          >
            {Math.round(coveragePercent)}% match
          </span>
        </div>
        {compact && (
          expanded ? (
            <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
          )
        )}
      </div>

      {/* Coverage Bar */}
      <div className="px-4 pb-2">
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: "var(--border-subtle)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: getBarColor(coveragePercent) }}
            initial={{ width: 0 }}
            animate={{ width: `${coveragePercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Details */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 pb-4"
        >
          {/* Matched Skills */}
          {matchedSkills.length > 0 && (
            <div className="mb-3">
              <h4
                className="text-xs font-semibold mb-2 flex items-center gap-1"
                style={{ color: "var(--success)" }}
              >
                <CheckCircle2 size={12} /> Matched ({matchedSkills.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {matchedSkills.map((skill, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                    style={{
                      background: "rgba(34,197,94,0.1)",
                      color: "var(--success)",
                      border: "1px solid rgba(34,197,94,0.2)",
                    }}
                  >
                    {skill.skillName}
                    <span className="opacity-70">
                      {skill.score ? `${skill.score}` : ""}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills */}
          {missingSkills.length > 0 && (
            <div className="mb-3">
              <h4
                className="text-xs font-semibold mb-2 flex items-center gap-1"
                style={{ color: "var(--error)" }}
              >
                <XCircle size={12} /> Gap Skills ({missingSkills.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.map((skill, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      color: "var(--error)",
                      border: "1px solid rgba(239,68,68,0.2)",
                    }}
                  >
                    {typeof skill === "string" ? skill : skill.skillName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action suggestion */}
          {missingSkills.length > 0 && (
            <div
              className="mt-3 p-3 rounded-lg flex items-start gap-2"
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent)20",
              }}
            >
              <Zap
                size={14}
                className="flex-shrink-0 mt-0.5"
                style={{ color: "var(--accent)" }}
              />
              <p
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Take a proctored interview covering{" "}
                <strong>
                  {missingSkills
                    .slice(0, 3)
                    .map((s) => (typeof s === "string" ? s : s.skillName))
                    .join(", ")}
                </strong>{" "}
                to improve your fitness score for this role.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
