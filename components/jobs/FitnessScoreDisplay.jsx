import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, ChevronRight,
  ArrowLeft, Sparkles, Target, GraduationCap,
  KeyRound, Briefcase, Users,
} from "lucide-react";

/**
 * FitnessScoreDisplay — Animated gauge + 5-parameter breakdown.
 *
 * Shows: Animated ring gauge, score, rating label, justification bullets,
 * per-parameter bars, and action buttons (proceed / go back).
 */

const LABEL_CONFIG = {
  STRONG_MATCH: {
    color: "#10B981",
    bgColor: "rgba(16,185,129,0.12)",
    ringColor: "#10B981",
    text: "Strong Match",
    emoji: "🎯",
    message: "Your profile is an excellent fit for this role!",
  },
  GOOD_MATCH: {
    color: "#3B82F6",
    bgColor: "rgba(59,130,246,0.12)",
    ringColor: "#3B82F6",
    text: "Good Match",
    emoji: "👍",
    message: "You're a solid candidate for this position.",
  },
  FAIR_MATCH: {
    color: "#F59E0B",
    bgColor: "rgba(245,158,11,0.12)",
    ringColor: "#F59E0B",
    text: "Fair Match",
    emoji: "⚡",
    message: "Your profile has some overlap. Consider highlighting relevant experience.",
  },
  LOW_MATCH: {
    color: "#EF4444",
    bgColor: "rgba(239,68,68,0.12)",
    ringColor: "#EF4444",
    text: "Low Match",
    emoji: "📝",
    message: "Your profile may need improvement for this specific role.",
  },
};

const PARAM_CONFIG = [
  { key: "skillsMatch", label: "Skills Match", weight: "35%", icon: Target },
  { key: "experienceRelevance", label: "Experience", weight: "20%", icon: Briefcase },
  { key: "educationFit", label: "Education", weight: "10%", icon: GraduationCap },
  { key: "roleAlignment", label: "Role Fit", weight: "20%", icon: Users },
  { key: "keywordDensity", label: "Keywords", weight: "15%", icon: KeyRound },
];

function getParamColor(value) {
  if (value >= 75) return "#10B981";
  if (value >= 55) return "#3B82F6";
  if (value >= 35) return "#F59E0B";
  return "#EF4444";
}

export default function FitnessScoreDisplay({
  score, label, rating, justification,
  breakdown, cached, onProceed, onCancel,
}) {
  const config = LABEL_CONFIG[label] || LABEL_CONFIG.FAIR_MATCH;
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate score counting up
  useEffect(() => {
    if (score == null) return;
    let current = 0;
    const target = Math.round(score);
    const duration = 1200;
    const steps = 40;
    const increment = target / steps;
    const interval = duration / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setAnimatedScore(target);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, interval);

    return () => clearInterval(timer);
  }, [score]);

  // SVG ring gauge calculations
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const progress = ((animatedScore || 0) / 100) * circumference;

  // Parse justification bullets
  const bullets = justification
    ? justification
        .split(/\n|(?=- )/)
        .map((s) => s.replace(/^-\s*/, "").trim())
        .filter(Boolean)
    : [];

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: "24px",
      paddingTop: "8px",
    }}>
      {/* Animated Ring Gauge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "backOut" }}
        style={{ position: "relative" }}
      >
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* Background ring */}
          <circle
            cx="90" cy="90" r={radius}
            fill="none"
            stroke="var(--hover-overlay-medium)"
            strokeWidth="10"
          />
          {/* Progress ring */}
          <motion.circle
            cx="90" cy="90" r={radius}
            fill="none"
            stroke={config.ringColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "center",
              filter: `drop-shadow(0 0 8px ${config.ringColor}50)`,
            }}
          />
        </svg>

        {/* Center content */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              fontSize: "40px", fontWeight: 800,
              color: config.color,
              lineHeight: 1,
              fontFeatureSettings: "'tnum'",
            }}
          >
            {animatedScore}
          </motion.span>
          <span style={{
            fontSize: "12px", fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginTop: "2px",
          }}>
            MATCH
          </span>
        </div>
      </motion.div>

      {/* Label badge */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 16px",
          borderRadius: "100px",
          background: config.bgColor,
          border: `1px solid ${config.color}30`,
        }}
      >
        <span style={{ fontSize: "16px" }}>{config.emoji}</span>
        <span style={{
          fontSize: "14px", fontWeight: 700,
          color: config.color,
        }}>
          {config.text}
        </span>
        {cached && (
          <span style={{
            fontSize: "10px",
            color: "var(--text-muted)",
            background: "var(--hover-overlay-medium)",
            padding: "2px 6px",
            borderRadius: "4px",
          }}>
            cached
          </span>
        )}
      </motion.div>

      {/* Context message */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{
          margin: 0, textAlign: "center",
          fontSize: "13px", color: "var(--text-secondary)",
          lineHeight: 1.6, maxWidth: "400px",
        }}
      >
        {config.message}
      </motion.p>

      {/* 5-Parameter Breakdown */}
      {breakdown && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{
            width: "100%",
            padding: "16px 20px",
            borderRadius: "16px",
            background: "var(--bg-inset)",
            border: "1px solid var(--border-subtle)",
            display: "flex", flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{
            fontSize: "11px", fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            marginBottom: "4px",
          }}>
            Score Breakdown
          </div>

          {PARAM_CONFIG.map((param, idx) => {
            const value = breakdown[param.key] || 0;
            const Icon = param.icon;
            return (
              <motion.div
                key={param.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + idx * 0.08 }}
                style={{
                  display: "flex", alignItems: "center",
                  gap: "10px",
                }}
              >
                <Icon size={14} style={{
                  color: getParamColor(value),
                  flexShrink: 0,
                }} />
                <div style={{
                  width: "70px", flexShrink: 0,
                  fontSize: "12px", fontWeight: 600,
                  color: "var(--text-secondary)",
                }}>
                  {param.label}
                </div>
                <div style={{
                  flex: 1, height: "6px",
                  borderRadius: "6px",
                  background: "var(--hover-overlay-medium)",
                  overflow: "hidden",
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.8, delay: 0.7 + idx * 0.08 }}
                    style={{
                      height: "100%",
                      borderRadius: "6px",
                      background: getParamColor(value),
                    }}
                  />
                </div>
                <span style={{
                  width: "32px", textAlign: "right",
                  fontSize: "12px", fontWeight: 700,
                  color: getParamColor(value),
                  fontFeatureSettings: "'tnum'",
                }}>
                  {value}
                </span>
                <span style={{
                  width: "28px",
                  fontSize: "10px",
                  color: "var(--text-muted)",
                }}>
                  {param.weight}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Justification */}
      {bullets.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          style={{
            width: "100%",
            padding: "16px 20px",
            borderRadius: "16px",
            background: "var(--bg-inset)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{
            fontSize: "11px", fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            marginBottom: "10px",
          }}>
            AI Analysis
          </div>
          <ul style={{
            margin: 0, paddingLeft: "16px",
            listStyleType: "disc",
            display: "flex", flexDirection: "column",
            gap: "6px",
          }}>
            {bullets.slice(0, 6).map((bullet, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                {bullet}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        style={{
          display: "flex", gap: "12px",
          width: "100%", marginTop: "4px",
        }}
      >
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          style={{
            flex: 1, padding: "14px",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer", fontSize: "13px",
            fontWeight: 500,
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: "6px",
          }}
        >
          <ArrowLeft size={16} />
          Improve Resume
        </motion.button>
        <motion.button
          whileHover={{
            scale: 1.02,
            boxShadow: `0 8px 24px ${config.color}40`,
          }}
          whileTap={{ scale: 0.98 }}
          onClick={onProceed}
          style={{
            flex: 2, padding: "14px",
            borderRadius: "12px",
            background: "var(--accent-gradient)",
            border: "none", color: "#fff",
            cursor: "pointer", fontSize: "14px",
            fontWeight: 600,
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: "8px",
          }}
        >
          Proceed to Apply
          <ChevronRight size={18} />
        </motion.button>
      </motion.div>
    </div>
  );
}
