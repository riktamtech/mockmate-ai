import { motion } from "framer-motion";
import { Shield, ChevronRight, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * ProctoredGate — Pre-application blocker requiring proctored interview.
 * Feature flag: FEATURE_REQUIRE_PROCTORED_INTERVIEW_BEFORE_APPLY
 * Fully theme-aware via CSS custom properties.
 */

export default function ProctoredGate({ hasProctoredInterview = false, onProceed }) {
  const navigate = useNavigate();

  if (hasProctoredInterview) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        padding: "32px 24px",
        borderRadius: "20px",
        background: "var(--accent-bg)",
        border: "1px solid var(--accent-bg-hover)",
        textAlign: "center",
        maxWidth: "440px",
        margin: "40px auto",
      }}
    >
      {/* Shield icon */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: "64px", height: "64px", borderRadius: "18px",
          background: "var(--accent-gradient)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
          boxShadow: "0 12px 40px rgba(139,92,246,0.3)",
        }}
      >
        <Shield size={28} color="#fff" />
      </motion.div>

      <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
        Verification Required
      </h3>
      <p style={{ margin: "0 0 20px", fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
        Complete a quick proctored mock interview to verify your identity. This ensures only genuine candidates apply and gives you a verified profile badge.
      </p>

      {/* Benefits */}
      <div style={{
        display: "flex", flexDirection: "column", gap: "8px",
        marginBottom: "24px", textAlign: "left",
      }}>
        {[
          "Get a Verified Candidate badge on your profile",
          "Stand out to recruiters with proven interview skills",
          "Takes only 15-20 minutes to complete",
        ].map((benefit, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "18px", height: "18px", borderRadius: "6px",
              background: "var(--success-bg)", border: "1px solid var(--success)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ fontSize: "10px", color: "var(--success)" }}>✓</span>
            </div>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{benefit}</span>
          </div>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate("/mockmate/candidate/proctored-interview")}
        style={{
          width: "100%", padding: "14px",
          borderRadius: "12px",
          background: "var(--accent-gradient)",
          border: "none", color: "#fff", cursor: "pointer",
          fontSize: "15px", fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          boxShadow: "0 8px 30px rgba(139,92,246,0.3)",
        }}
      >
        Take Proctored Interview
        <ChevronRight size={18} />
      </motion.button>

      <p style={{ margin: "12px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
        You only need to do this once. After verification, you can apply to unlimited jobs.
      </p>
    </motion.div>
  );
}
