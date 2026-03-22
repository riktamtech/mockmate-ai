import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { LIFECYCLE_STAGES } from "../../constants/jobConstants";

/**
 * LifecycleTracker — Visual step-by-step progress indicator
 * for job application status.
 *
 * Shows animated transitions between lifecycle stages.
 */

function getStageStatus(stageKey, currentStage, history) {
  const stageIndex = LIFECYCLE_STAGES.findIndex((s) => s.key === stageKey);
  const currentIndex = LIFECYCLE_STAGES.findIndex(
    (s) => s.key === currentStage,
  );

  // Check if this stage exists in history
  const historyEntry = history?.find((h) => h.stage === stageKey);

  if (historyEntry) return "completed";
  if (stageIndex === currentIndex) return "current";
  if (stageIndex < currentIndex) return "completed";
  return "pending";
}

function StageIcon({ status }) {
  if (status === "completed") {
    return (
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <CheckCircle2 size={20} color="#10B981" />
      </motion.div>
    );
  }

  if (status === "current") {
    return (
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Loader2 size={20} color="#8B5CF6" className="animate-spin" />
      </motion.div>
    );
  }

  return <Circle size={20} color="rgba(255, 255, 255, 0.2)" />;
}

export default function LifecycleTracker({
  currentStage = "APPLIED",
  lifecycleHistory = [],
  compact = false,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: compact ? "row" : "column",
        gap: compact ? "4px" : "0px",
        padding: compact ? "8px 0" : "16px 0",
      }}
    >
      {LIFECYCLE_STAGES.map((stage, index) => {
        const status = getStageStatus(
          stage.key,
          currentStage,
          lifecycleHistory,
        );

        if (compact) {
          // Compact: horizontal dots
          return (
            <motion.div
              key={stage.key}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <div
                style={{
                  width: status === "current" ? "10px" : "8px",
                  height: status === "current" ? "10px" : "8px",
                  borderRadius: "50%",
                  background:
                    status === "completed"
                      ? "#10B981"
                      : status === "current"
                        ? "#8B5CF6"
                        : "rgba(255, 255, 255, 0.15)",
                  transition: "all 0.3s ease",
                }}
              />
              {index < LIFECYCLE_STAGES.length - 1 && (
                <div
                  style={{
                    width: "12px",
                    height: "2px",
                    background:
                      status === "completed"
                        ? "#10B981"
                        : "rgba(255, 255, 255, 0.1)",
                    borderRadius: "1px",
                  }}
                />
              )}
            </motion.div>
          );
        }

        // Full: vertical with labels
        return (
          <div key={stage.key} style={{ display: "flex", gap: "12px" }}>
            {/* Left: icon + connector line */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "24px",
              }}
            >
              <StageIcon status={status} />
              {index < LIFECYCLE_STAGES.length - 1 && (
                <div
                  style={{
                    width: "2px",
                    height: "28px",
                    background:
                      status === "completed"
                        ? "linear-gradient(to bottom, #10B981, rgba(16, 185, 129, 0.3))"
                        : "rgba(255, 255, 255, 0.08)",
                    borderRadius: "1px",
                    margin: "4px 0",
                  }}
                />
              )}
            </div>

            {/* Right: label + timestamp */}
            <div style={{ paddingBottom: "16px", flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: status === "current" ? 600 : 400,
                  color:
                    status === "completed"
                      ? "#10B981"
                      : status === "current"
                        ? "#f1f1f4"
                        : "rgba(255, 255, 255, 0.3)",
                  lineHeight: 1.4,
                }}
              >
                {stage.label}
              </p>
              {lifecycleHistory?.find((h) => h.stage === stage.key)
                ?.timestamp && (
                <p
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: "11px",
                    color: "rgba(255, 255, 255, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Clock size={10} />
                  {new Date(
                    lifecycleHistory.find(
                      (h) => h.stage === stage.key,
                    ).timestamp,
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
