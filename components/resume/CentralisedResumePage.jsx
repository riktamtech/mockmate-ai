import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Briefcase,
  GraduationCap,
  Code2,
  Star,
  Target,
  BarChart3,
  MessageSquare,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
} from "lucide-react";
import { api } from "../../services/api";

/**
 * CentralisedResumePage — Living candidate profile view.
 * Shows verified skills, performance metrics, integrity, interview history,
 * and profile completeness based on the CentralisedResume.
 */

// ── Skill Card ────────────────────────────────────────────────────
function SkillCard({ skill }) {
  const [expanded, setExpanded] = useState(false);

  const trendIcon = {
    IMPROVING: <TrendingUp size={14} style={{ color: "var(--success)" }} />,
    DECLINING: <TrendingDown size={14} style={{ color: "var(--error)" }} />,
    STABLE: <Minus size={14} style={{ color: "var(--text-muted)" }} />,
  };

  const depthColors = {
    EXPERT: "var(--accent)",
    ADVANCED: "var(--success)",
    INTERMEDIATE: "var(--warning)",
    BEGINNER: "var(--text-muted)",
  };

  return (
    <motion.div
      layout
      className="rounded-xl p-4"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{
              background: depthColors[skill.depthLevel] || "var(--accent)",
              opacity: 0.9,
            }}
          >
            {skill.bestScore}
          </div>
          <div>
            <h4
              className="font-semibold text-sm"
              style={{ color: "var(--text-primary)" }}
            >
              {skill.skillName}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: `${depthColors[skill.depthLevel]}20`,
                  color: depthColors[skill.depthLevel],
                }}
              >
                {skill.depthLevel}
              </span>
              {trendIcon[skill.trend]}
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {skill.totalAttempts} attempt{skill.totalAttempts !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
        )}
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 pt-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span style={{ color: "var(--text-muted)" }}>Best Score</span>
              <p
                className="font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {skill.bestScore}/100
              </p>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Current Score</span>
              <p
                className="font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {skill.currentScore}/100
              </p>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Questions</span>
              <p
                className="font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {skill.questionCount}
              </p>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Confidence</span>
              <p
                className="font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {skill.confidence}
              </p>
            </div>
          </div>
          {skill.subTopicsCovered?.length > 0 && (
            <div className="mt-2">
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Topics Covered
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {skill.subTopicsCovered.map((topic, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--hover-overlay)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, suffix = "", color }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col items-center text-center"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <Icon size={20} style={{ color: color || "var(--accent)", marginBottom: 8 }} />
      <span
        className="text-2xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {value !== undefined && value !== null ? value : "—"}
        {suffix}
      </span>
      <span
        className="text-xs mt-1"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Score Ring ─────────────────────────────────────────────────────
function ScoreRing({ score, size = 120, strokeWidth = 10, label }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s) => {
    if (s >= 80) return "var(--success)";
    if (s >= 60) return "var(--accent)";
    if (s >= 40) return "var(--warning)";
    return "var(--error)";
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span
          className="text-3xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {Math.round(score)}
        </span>
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          / 100
        </span>
      </div>
      {label && (
        <span
          className="text-xs mt-2 font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// ── Profile Completeness Bar ──────────────────────────────────────
function CompletenessBar({ value }) {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Profile Completeness
        </span>
        <span
          className="text-sm font-bold"
          style={{ color: "var(--accent)" }}
        >
          {Math.round(value)}%
        </span>
      </div>
      <div
        className="w-full h-2.5 rounded-full overflow-hidden"
        style={{ background: "var(--border-subtle)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--accent-gradient)" }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      {value < 100 && (
        <p
          className="text-xs mt-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          Take more interviews to improve your profile completeness.
        </p>
      )}
    </div>
  );
}

// ── Interview History Card ────────────────────────────────────────
function InterviewRef({ ref: interview }) {
  return (
    <div
      className="rounded-lg p-3 flex items-start gap-3"
      style={{
        background: "var(--hover-overlay)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--accent-bg)" }}
      >
        <FileText size={14} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {interview.skillsCovered?.join(", ") || "General"}
          </span>
          {interview.duration > 0 && (
            <span
              className="text-xs flex items-center gap-1"
              style={{ color: "var(--text-muted)" }}
            >
              <Clock size={10} /> {interview.duration}min
            </span>
          )}
        </div>
        <p
          className="text-xs mt-0.5 line-clamp-2"
          style={{ color: "var(--text-muted)" }}
        >
          {interview.evaluationSummary || "No evaluation summary"}
        </p>
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {interview.date
            ? new Date(interview.date).toLocaleDateString()
            : ""}
        </span>
      </div>
    </div>
  );
}

// ── Integrity Badge ───────────────────────────────────────────────
function IntegrityBadge({ verdict, trustScore, cheatingLikelihood }) {
  const config = {
    TRUSTED: {
      icon: ShieldCheck,
      color: "var(--success)",
      bg: "var(--success-bg, rgba(34,197,94,0.1))",
      label: "Trusted",
    },
    FLAGGED: {
      icon: ShieldAlert,
      color: "var(--warning)",
      bg: "var(--warning-bg, rgba(234,179,8,0.1))",
      label: "Flagged",
    },
    UNVERIFIED: {
      icon: ShieldOff,
      color: "var(--text-muted)",
      bg: "var(--hover-overlay)",
      label: "Unverified",
    },
  };

  const c = config[verdict] || config.UNVERIFIED;
  const Icon = c.icon;

  return (
    <div
      className="rounded-xl p-4 flex items-center gap-4"
      style={{ background: c.bg, border: `1px solid ${c.color}30` }}
    >
      <Icon size={32} style={{ color: c.color }} />
      <div>
        <h4
          className="font-semibold text-sm"
          style={{ color: "var(--text-primary)" }}
        >
          Integrity: {c.label}
        </h4>
        <div
          className="flex items-center gap-4 mt-1 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <span>Trust: {Math.round(trustScore || 0)}%</span>
          <span>
            Cheating Likelihood: {Math.round(cheatingLikelihood || 0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function CentralisedResumePage() {
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResume = async () => {
      try {
        const res = await api.getCentralisedResume();
        setResume(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResume();
  }, []);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        style={{ color: "var(--text-muted)" }}
      >
        <div
          className="w-8 h-8 rounded-full animate-spin mr-3"
          style={{
            border: "3px solid var(--border)",
            borderTopColor: "var(--accent)",
          }}
        />
        Loading your profile...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle size={32} style={{ color: "var(--error)" }} />
        <p style={{ color: "var(--text-muted)" }}>{error}</p>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--accent-bg)" }}
        >
          <FileText size={40} style={{ color: "var(--accent)" }} />
        </div>
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          No Profile Yet
        </h2>
        <p
          className="text-sm text-center max-w-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Upload a resume or complete a proctored interview to create your
          verified candidate profile.
        </p>
      </div>
    );
  }

  const sortedSkills = [...(resume.skills || [])].sort(
    (a, b) => b.bestScore - a.bestScore,
  );

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          My Verified Profile
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--text-muted)" }}
        >
          Your AI-verified candidate profile that evolves with each interview.
        </p>
      </div>

      {/* ── Profile Completeness ────────────────────────────────── */}
      <div
        className="rounded-xl p-5"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <CompletenessBar value={resume.profileCompleteness || 0} />
      </div>

      {/* ── Composite Score + Key Metrics ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div
          className="md:col-span-2 rounded-xl p-6 flex flex-col items-center justify-center relative"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <ScoreRing
            score={resume.overallCompositeScore || 0}
            label="Composite Score"
          />
        </div>
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard
            icon={Zap}
            label="Problem Solving"
            value={Math.round(resume.problemSolvingScore || 0)}
            color="var(--accent)"
          />
          <MetricCard
            icon={MessageSquare}
            label="Communication"
            value={Math.round(resume.communicationScore || 0)}
            color="var(--success)"
          />
          <MetricCard
            icon={Code2}
            label="Code Quality"
            value={Math.round(resume.codeQualityScore || 0)}
            color="var(--warning)"
          />
          <MetricCard
            icon={Target}
            label="Consistency"
            value={Math.round(resume.consistencyScore || 0)}
            color="var(--info, var(--accent))"
          />
          <MetricCard
            icon={BarChart3}
            label="Interviews"
            value={resume.totalInterviews || 0}
            color="var(--text-secondary)"
          />
          <MetricCard
            icon={Briefcase}
            label="Experience"
            value={resume.totalYearsExperience || 0}
            suffix=" yrs"
            color="var(--text-secondary)"
          />
        </div>
      </div>

      {/* ── Integrity Badge ─────────────────────────────────────── */}
      <IntegrityBadge
        verdict={resume.integrityVerdict}
        trustScore={resume.avgTrustScore}
        cheatingLikelihood={resume.avgCheatingLikelihood}
      />

      {/* ── Skills Grid ─────────────────────────────────────────── */}
      <div>
        <h2
          className="text-lg font-bold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          <Award
            size={18}
            style={{
              display: "inline",
              marginRight: 8,
              color: "var(--accent)",
            }}
          />
          Verified Skills ({sortedSkills.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedSkills.map((skill, i) => (
            <SkillCard key={skill.skillName || i} skill={skill} />
          ))}
          {sortedSkills.length === 0 && (
            <p
              className="text-sm col-span-full text-center py-8"
              style={{ color: "var(--text-muted)" }}
            >
              No verified skills yet. Complete a proctored interview to add
              skills.
            </p>
          )}
        </div>
      </div>

      {/* ── Strengths / Weaknesses ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <div
          className="rounded-xl p-5"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h3
            className="text-sm font-bold mb-3 flex items-center gap-2"
            style={{ color: "var(--success)" }}
          >
            <Star size={16} /> Strengths
          </h3>
          {resume.technicalStrengths?.length > 0 ? (
            <ul className="space-y-2">
              {resume.technicalStrengths.map((s, i) => (
                <li key={i} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {s.area}
                  </span>
                  {s.description && (
                    <span className="text-xs block" style={{ color: "var(--text-muted)" }}>
                      {s.description}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Complete interviews to discover your strengths.
            </p>
          )}
        </div>

        {/* Weaknesses */}
        <div
          className="rounded-xl p-5"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h3
            className="text-sm font-bold mb-3 flex items-center gap-2"
            style={{ color: "var(--warning)" }}
          >
            <AlertTriangle size={16} /> Areas for Improvement
          </h3>
          {resume.technicalWeaknesses?.length > 0 ? (
            <ul className="space-y-2">
              {resume.technicalWeaknesses.map((w, i) => (
                <li key={i} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {w.area}
                  </span>
                  {w.suggestedImprovement && (
                    <span className="text-xs block" style={{ color: "var(--text-muted)" }}>
                      💡 {w.suggestedImprovement}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Areas for improvement will appear after interviews.
            </p>
          )}
        </div>
      </div>

      {/* ── Interview History ───────────────────────────────────── */}
      {resume.interviewRecordingRefs?.length > 0 && (
        <div>
          <h2
            className="text-lg font-bold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Interview History
          </h2>
          <div className="space-y-2">
            {resume.interviewRecordingRefs.map((ref, i) => (
              <InterviewRef key={i} ref={ref} />
            ))}
          </div>
        </div>
      )}

      {/* ── Education / Work History (from resume parse) ────────── */}
      {(resume.resumeSourceData?.educationHistory?.length > 0 ||
        resume.resumeSourceData?.workHistory?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resume.resumeSourceData?.educationHistory?.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <h3
                className="text-sm font-bold mb-3 flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <GraduationCap size={16} /> Education
              </h3>
              <ul className="space-y-2">
                {resume.resumeSourceData.educationHistory.map((e, i) => (
                  <li key={i} className="text-sm">
                    <span
                      className="font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {e.degree} in {e.field}
                    </span>
                    <span
                      className="text-xs block"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {e.institution}
                      {e.graduationYear ? ` • ${e.graduationYear}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resume.resumeSourceData?.workHistory?.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <h3
                className="text-sm font-bold mb-3 flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <Briefcase size={16} /> Work Experience
              </h3>
              <ul className="space-y-2">
                {resume.resumeSourceData.workHistory.map((w, i) => (
                  <li key={i} className="text-sm">
                    <span
                      className="font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {w.role}
                    </span>
                    <span
                      className="text-xs block"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {w.company}
                      {w.durationMonths
                        ? ` • ${Math.round(w.durationMonths / 12)} yr${Math.round(w.durationMonths / 12) !== 1 ? "s" : ""}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
