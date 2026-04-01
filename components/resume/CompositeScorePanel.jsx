import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Award,
  Zap,
  MessageSquare,
  Code2,
  Target,
  Shield,
  Briefcase,
} from "lucide-react";
import { api } from "../../services/api";

/**
 * CompositeScorePanel — Shows the composite fitness score for a candidate
 * against a specific job opening using the CentralisedResume data.
 *
 * Zero LLM cost — computed algorithmically from stored data.
 *
 * Props:
 *  - openingId: string - The job opening ID
 */

function ScoreBar({ label, value, color, icon: Icon }) {
  return (
    <div className="flex items-center gap-3">
      <Icon
        size={14}
        className="flex-shrink-0"
        style={{ color: color || "var(--text-muted)" }}
      />
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span
            className="text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {label}
          </span>
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {Math.round(value || 0)}
          </span>
        </div>
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--border-subtle)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: color || "var(--accent)" }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(value || 0, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          />
        </div>
      </div>
    </div>
  );
}

export default function CompositeScorePanel({ openingId }) {
  const [fitness, setFitness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!openingId) return;

    let cancelled = false;
    const fetchFitness = async () => {
      try {
        setLoading(true);
        const res = await api.getResumeFitness(openingId);
        if (!cancelled) setFitness(res.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchFitness();
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
          Computing fitness score...
        </span>
      </div>
    );
  }

  if (error || !fitness) return null;

  const {
    compositeScore = 0,
    components = {},
  } = fitness;

  const getScoreColor = (score) => {
    if (score >= 80) return "var(--success)";
    if (score >= 60) return "var(--accent)";
    if (score >= 40) return "var(--warning)";
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
      <div className="p-4">
        {/* Header with overall score */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award size={18} style={{ color: "var(--accent)" }} />
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Verified Fitness Score
            </span>
          </div>
          <div
            className="text-xl font-bold px-3 py-1 rounded-lg"
            style={{
              color: getScoreColor(compositeScore),
              background: `${getScoreColor(compositeScore)}15`,
            }}
          >
            {Math.round(compositeScore)}
          </div>
        </div>

        {/* Component breakdown */}
        <div className="space-y-3">
          <ScoreBar
            label="Skill Match"
            value={components.skillMatch || 0}
            color="var(--accent)"
            icon={Target}
          />
          <ScoreBar
            label="Experience"
            value={components.experience || 0}
            color="var(--success)"
            icon={Briefcase}
          />
          <ScoreBar
            label="Depth Coverage"
            value={components.depthCoverage || 0}
            color="var(--warning)"
            icon={Code2}
          />
          <ScoreBar
            label="Performance"
            value={components.performance || 0}
            color="var(--info, var(--accent))"
            icon={Zap}
          />
          <ScoreBar
            label="Consistency"
            value={components.consistency || 0}
            color="var(--text-secondary)"
            icon={MessageSquare}
          />
          <ScoreBar
            label="Trust"
            value={components.trust || 0}
            color="var(--success)"
            icon={Shield}
          />
        </div>

        <p
          className="text-xs mt-3 pt-3"
          style={{
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          Computed from your verified interview data — no AI cost involved.
        </p>
      </div>
    </div>
  );
}
