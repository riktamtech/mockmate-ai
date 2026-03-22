import { motion } from "framer-motion";
import { BarChart3, Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import { FITNESS_LABELS } from "../../constants/jobConstants";

/**
 * FitnessScoreDisplay — Animated gauge component showing resume fitness score.
 *
 * Features:
 * - Circular gauge with gradient arc
 * - Animated score counter
 * - Color-coded label (Excellent, Good, Fair, Low, Poor)
 * - Loading state with pulsing animation
 */

function getScoreConfig(score) {
  if (score >= 80) return { color: "#10B981", label: "Excellent Match", gradient: "conic-gradient(#10B981 0%, #34D399 100%)" };
  if (score >= 60) return { color: "#3B82F6", label: "Good Match", gradient: "conic-gradient(#3B82F6 0%, #60A5FA 100%)" };
  if (score >= 40) return { color: "#F59E0B", label: "Fair Match", gradient: "conic-gradient(#F59E0B 0%, #FBBF24 100%)" };
  if (score >= 20) return { color: "#EF4444", label: "Low Match", gradient: "conic-gradient(#EF4444 0%, #F87171 100%)" };
  return { color: "#6B7280", label: "Poor Match", gradient: "conic-gradient(#6B7280 0%, #9CA3AF 100%)" };
}

export function FitnessScoreLoader() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 20px",
        gap: "16px",
      }}
    >
      {/* Pulsing ring */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: "conic-gradient(rgba(139, 92, 246, 0.3) 0%, transparent 60%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(18, 18, 30, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={28} color="rgba(139, 92, 246, 0.6)" />
        </div>
      </motion.div>

      <motion.p
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          margin: 0,
          fontSize: "14px",
          fontWeight: 500,
          color: "rgba(255, 255, 255, 0.5)",
        }}
      >
        Analyzing your resume...
      </motion.p>
      <p
        style={{
          margin: 0,
          fontSize: "12px",
          color: "rgba(255, 255, 255, 0.25)",
        }}
      >
        Matching skills, experience, and qualifications
      </p>
    </div>
  );
}

export function FitnessScoreResult({
  score,
  passed,
  requiredScore = 0,
  onProceed,
  onCancel,
}) {
  const config = getScoreConfig(score);
  const percentage = score / 100;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 20px",
        gap: "20px",
      }}
    >
      {/* Gauge */}
      <div style={{ position: "relative", width: "140px", height: "140px" }}>
        {/* Background ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.04)",
          }}
        />
        {/* Score ring */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `conic-gradient(${config.color} 0%, ${config.color}40 ${percentage * 100}%, transparent ${percentage * 100}%)`,
            mask: "radial-gradient(circle at center, transparent 56px, black 57px)",
            WebkitMask:
              "radial-gradient(circle at center, transparent 56px, black 57px)",
          }}
        />
        {/* Center content */}
        <div
          style={{
            position: "absolute",
            inset: "12px",
            borderRadius: "50%",
            background: "rgba(18, 18, 30, 1)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: config.color,
              lineHeight: 1,
            }}
          >
            {score}
          </motion.span>
          <span
            style={{
              fontSize: "11px",
              color: "rgba(255, 255, 255, 0.3)",
              marginTop: "2px",
            }}
          >
            / 100
          </span>
        </div>
      </div>

      {/* Label */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ textAlign: "center" }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: 600,
            color: config.color,
          }}
        >
          {config.label}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.4)",
          }}
        >
          Based on your resume vs. job requirements
        </p>
      </motion.div>

      {/* Pass/Fail indicator */}
      {!passed && requiredScore > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            maxWidth: "300px",
          }}
        >
          <AlertCircle size={16} color="rgba(239, 68, 68, 0.8)" />
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "rgba(239, 68, 68, 0.8)",
            }}
          >
            Minimum score of {requiredScore}% required. Your score doesn't
            meet the threshold for this opening.
          </p>
        </motion.div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          width: "100%",
          maxWidth: "300px",
          marginTop: "8px",
        }}
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onCancel}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "transparent",
            color: "rgba(255, 255, 255, 0.5)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          Cancel
        </motion.button>
        {passed && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onProceed}
            style={{
              flex: 2,
              padding: "12px",
              borderRadius: "10px",
              background: `linear-gradient(135deg, ${config.color}, ${config.color}CC)`,
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Proceed to Apply
          </motion.button>
        )}
      </div>
    </div>
  );
}
