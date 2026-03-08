import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  ArrowLeft,
  Award,
  MessageSquare,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Briefcase,
  Star,
  BarChart3,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Target,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Zap,
  User,
  Bot,
  Hash,
  Mic,
  Sparkles,
  Loader2,
  BookOpen,
  Trophy,
  Brain,
  Code,
  ChevronRight,
} from "lucide-react";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";
import { useProctoredInterview } from "../hooks/useProctoredInterview";
import { DashboardHeader } from "./Dashboard";
import { SideDrawer } from "./SideDrawer";

// ═══════════════════════════════════════════════════════════════════
//  PARSERS & HELPERS
// ═══════════════════════════════════════════════════════════════════
function parseEvaluation(raw) {
  if (!raw) return null;
  try {
    if (typeof raw === "string") {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      }
      if (parsed) {
        // evaluation_report holds summary fields (score, verdict, etc.)
        // but interview_questions_evaluation & ratings_for_skills may live
        // as siblings of evaluation_report — merge them into one object.
        if (parsed.evaluation_report) {
          const report = parsed.evaluation_report;
          return {
            ...report,
            interview_questions_evaluation:
              report.interview_questions_evaluation ||
              parsed.interview_questions_evaluation ||
              [],
            ratings_for_skills:
              report.ratings_for_skills || parsed.ratings_for_skills || [],
          };
        }
        return parsed;
      }
      return { overall_verdict: raw };
    }
    if (typeof raw === "object") {
      if (raw.evaluation_report) {
        const report = raw.evaluation_report;
        return {
          ...report,
          interview_questions_evaluation:
            report.interview_questions_evaluation ||
            raw.interview_questions_evaluation ||
            [],
          ratings_for_skills:
            report.ratings_for_skills || raw.ratings_for_skills || [],
        };
      }
      return raw;
    }
  } catch {
    return { overall_verdict: String(raw) };
  }
  return null;
}

function parseMarkdownBold(text) {
  if (!text) return { title: "", body: text || "" };
  const m = text.match(/^\*\*(.+?):\*\*:?\s*([\s\S]*)$/);
  if (m) return { title: m[1].trim(), body: m[2].trim() };
  return { title: "", body: text };
}

function getScoreColor(score) {
  if (score >= 85)
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-500",
      bgLight: "bg-emerald-50",
      border: "border-emerald-200",
      hex: "#10b981",
      label: "Excellent",
    };
  if (score >= 70)
    return {
      text: "text-blue-600",
      bg: "bg-blue-500",
      bgLight: "bg-blue-50",
      border: "border-blue-200",
      hex: "#3b82f6",
      label: "Good",
    };
  if (score >= 50)
    return {
      text: "text-amber-600",
      bg: "bg-amber-500",
      bgLight: "bg-amber-50",
      border: "border-amber-200",
      hex: "#f59e0b",
      label: "Average",
    };
  return {
    text: "text-rose-600",
    bg: "bg-rose-500",
    bgLight: "bg-rose-50",
    border: "border-rose-200",
    hex: "#f43f5e",
    label: "Needs Work",
  };
}

function getMessages(interview) {
  const msgs =
    interview?.messages ||
    interview?.rawReportPayload?.messages ||
    interview?.candidate?.rawPayload?.messages ||
    [];
  return Array.isArray(msgs) ? msgs : [];
}

// ═══════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

const Counter = React.memo(
  ({ end, duration = 1200, suffix = "", decimals = 0 }) => {
    const [val, setVal] = useState(0);
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    useEffect(() => {
      if (!inView || end == null) return;
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(+(eased * end).toFixed(decimals));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, [inView, end, duration, decimals]);
    return (
      <span ref={ref}>
        {val}
        {suffix}
      </span>
    );
  },
);
Counter.displayName = "Counter";

const ScoreGauge = React.memo(({ score, size = 180 }) => {
  const sc = getScoreColor(score);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="78%"
          outerRadius="100%"
          barSize={14}
          data={[{ value: Math.min(score, 100), fill: sc.hex }]}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={8}
            background={{ fill: "#f1f5f9" }}
            isAnimationActive
            animationDuration={1800}
            animationEasing="ease-out"
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-extrabold ${sc.text}`}>
          <Counter end={score} suffix="%" decimals={1} />
        </span>
        <span className={`text-xs font-semibold mt-1 ${sc.text} opacity-70`}>
          {sc.label}
        </span>
      </div>
    </div>
  );
});
ScoreGauge.displayName = "ScoreGauge";

const ScoreBar = React.memo(({ score, label, delay = 0 }) => {
  const sc = getScoreColor(score);
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (inView) {
      const t = setTimeout(() => setShow(true), delay);
      return () => clearTimeout(t);
    }
  }, [inView, delay]);
  return (
    <div ref={ref}>
      {label && (
        <div className="flex justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-500">{label}</span>
          <span className={`text-xs font-bold ${sc.text}`}>{score}%</span>
        </div>
      )}
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-[1200ms] ease-out ${sc.bg}`}
          style={{ width: show ? `${Math.min(score, 100)}%` : "0%" }}
        />
      </div>
    </div>
  );
});
ScoreBar.displayName = "ScoreBar";

const StarRating = React.memo(({ rating, max = 5 }) => (
  <div className="flex gap-0.5 items-center">
    {Array.from({ length: max }, (_, i) => (
      <span
        key={i}
        className={`text-[18px] leading-none ${
          i < rating ? "text-amber-400" : "text-slate-200"
        }`}
      >
        ★
      </span>
    ))}
  </div>
));
StarRating.displayName = "StarRating";

/* Section wrapper — light glassmorphism */
const Section = React.memo(
  ({
    children,
    icon: Icon,
    title,
    iconBg = "bg-blue-50",
    iconColor = "text-blue-600",
    className = "",
  }) => (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45 }}
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden ${className}`}
    >
      {title && (
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className={`p-2 rounded-xl ${iconBg}`}>
            <Icon size={18} className={iconColor} />
          </div>
          <h2 className="font-bold text-slate-800 text-base">{title}</h2>
        </div>
      )}
      <div className="p-6">{children}</div>
    </motion.section>
  ),
);
Section.displayName = "Section";

/* Collapsible text with Read more / Read less */
const CollapsibleText = React.memo(({ text, maxLines = 4 }) => {
  const [expanded, setExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current) {
      const lineHeight =
        parseFloat(getComputedStyle(textRef.current).lineHeight) || 20;
      setNeedsTruncation(
        textRef.current.scrollHeight > lineHeight * (maxLines + 0.5),
      );
    }
  }, [text, maxLines]);

  return (
    <div>
      <p
        ref={textRef}
        className={`text-sm text-slate-600 leading-relaxed whitespace-pre-line ${
          !expanded && needsTruncation ? `line-clamp-${maxLines}` : ""
        }`}
        style={
          !expanded && needsTruncation
            ? {
                display: "-webkit-box",
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : {}
        }
      >
        {text}
      </p>
      {needsTruncation && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-xs font-medium text-violet-600 hover:text-violet-700 mt-1.5 transition-colors"
        >
          {expanded ? "Read less" : "...Read more"}
        </button>
      )}
    </div>
  );
});
CollapsibleText.displayName = "CollapsibleText";

/* Per-question evaluation card — shows actual candidate answer, evaluation, positives & negatives */
const QuestionCard = React.memo(({ q, index, messages }) => {
  const [open, setOpen] = useState(false);
  const score = q.score_in_percentage ?? q.score ?? null;
  const sc = score !== null ? getScoreColor(score) : null;

  // Get actual candidate answer from messages using indexes_of_the_answer
  const candidateAnswer = useMemo(() => {
    if (!q.indexes_of_the_answer?.length || !messages?.length) return null;
    const idx = q.indexes_of_the_answer[0];
    if (idx >= 0 && idx < messages.length && messages[idx]?.role === "user") {
      return messages[idx].content;
    }
    return null;
  }, [q.indexes_of_the_answer, messages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04 }}
      className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center gap-3 text-left bg-white hover:bg-slate-50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center text-sm font-bold text-violet-600 flex-shrink-0">
          {index + 1}
        </div>
        <p className="text-sm font-medium text-slate-700 flex-1 line-clamp-2 leading-relaxed">
          {q.question}
        </p>
        {sc && (
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${sc.text} ${sc.bgLight} border ${sc.border}`}
          >
            {score}%
          </div>
        )}
        {open ? (
          <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4 bg-slate-50/50">
              {/* Candidate's Answer */}
              {candidateAnswer && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <User size={13} className="text-blue-500" />
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      Candidate's Answer
                    </span>
                  </div>
                  <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-4 py-3">
                    <CollapsibleText text={candidateAnswer} maxLines={4} />
                  </div>
                </div>
              )}

              {/* Score */}
              {score !== null && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <BarChart3 size={13} className="text-slate-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Score
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${sc.text}`}>
                      {score}%
                    </span>
                    <div className="flex-1">
                      <ScoreBar score={score} />
                    </div>
                  </div>
                </div>
              )}

              {/* Evaluation */}
              {q.evaluation && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen size={13} className="text-violet-500" />
                    <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
                      Evaluation
                    </span>
                  </div>
                  <div className="bg-violet-50/60 border border-violet-100 rounded-lg px-4 py-3">
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {q.evaluation}
                    </p>
                  </div>
                </div>
              )}

              {/* Positives */}
              {q.positives?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ThumbsUp size={13} className="text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                      Positives
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {q.positives.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-slate-600 bg-emerald-50/60 border border-emerald-100 rounded-lg px-3.5 py-2.5"
                      >
                        <CheckCircle2
                          size={14}
                          className="text-emerald-500 mt-0.5 flex-shrink-0"
                        />
                        <span className="leading-relaxed">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Negatives */}
              {q.negatives?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={13} className="text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                      Areas to Improve
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {q.negatives.map((n, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-slate-600 bg-amber-50/60 border border-amber-100 rounded-lg px-3.5 py-2.5"
                      >
                        <AlertTriangle
                          size={14}
                          className="text-amber-500 mt-0.5 flex-shrink-0"
                        />
                        <span className="leading-relaxed">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
QuestionCard.displayName = "QuestionCard";

/* Skill rating card — evaluation is shown by default */
const SkillCard = React.memo(({ skill, index }) => {
  const ratingPercent = ((skill.rating || 0) / 5) * 100;
  const sc = getScoreColor(ratingPercent);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className={`bg-white border-l-4 rounded-xl p-5 shadow-sm transition-all border ${sc.border}`}
      style={{ borderLeftColor: sc.hex }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-800">
          {skill.skill_name || skill.skillName}
        </h4>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold ${sc.text} px-2 py-0.5 rounded-full ${sc.bgLight}`}
          >
            {skill.rating}/5
          </span>
          <StarRating rating={skill.rating} />
        </div>
      </div>
      <ScoreBar score={ratingPercent} delay={index * 80} />
      {skill.evaluation && (
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          {skill.evaluation}
        </p>
      )}
    </motion.div>
  );
});
SkillCard.displayName = "SkillCard";

/* Trust meter */
const TrustMeter = React.memo(({ score }) => {
  const radius = 42,
    circ = 2 * Math.PI * radius;
  const offset = circ - (Math.min(score, 100) / 100) * circ;
  let color, label, Icon, bgColor;
  if (score >= 80) {
    color = "#10b981";
    label = "High Trust";
    Icon = ShieldCheck;
    bgColor = "bg-emerald-50";
  } else if (score >= 50) {
    color = "#f59e0b";
    label = "Moderate";
    Icon = Shield;
    bgColor = "bg-amber-50";
  } else {
    color = "#f43f5e";
    label = "Low Trust";
    Icon = ShieldAlert;
    bgColor = "bg-rose-50";
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg width={100} height={100} className="-rotate-90">
          <circle
            cx={50}
            cy={50}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={7}
          />
          <circle
            cx={50}
            cy={50}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="animate-draw-circle"
            style={{ "--circumference": circ, "--dash-offset": offset }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={18} style={{ color }} />
          <span className="text-base font-bold text-slate-700 mt-0.5">
            {score}%
          </span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">Trust Level</p>
      </div>
    </div>
  );
});
TrustMeter.displayName = "TrustMeter";

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export const ProctoredReport = () => {
  const navigate = useNavigate();
  const { interview, loading, fetchReport } = useProctoredInterview();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("evaluation");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!loading && !interview)
      navigate("/mockmate/candidate/proctored-interview");
    else if (!loading && interview && !interview.reportFetched)
      fetchReport().catch(() => {});
  }, [loading, interview, fetchReport, navigate]);

  // ── Data ────────────────────────────────────────────────────────
  const evaluation = useMemo(
    () => parseEvaluation(interview?.evaluation),
    [interview],
  );
  const trustScore = useMemo(
    () => Math.round(Math.max(0, Math.min(100, interview?.trustScore || 0))),
    [interview],
  );
  const cheating = useMemo(() => interview?.cheatingScore || {}, [interview]);
  const messages = useMemo(() => getMessages(interview), [interview]);

  const overallScore = useMemo(() => {
    const v =
      evaluation?.overall_score_in_percentage ?? evaluation?.overall_score;
    return v != null ? Math.round(v * 10) / 10 : null;
  }, [evaluation]);

  const overallVerdict = evaluation?.overall_verdict || "";
  const interviewSummary = evaluation?.interview_summary || "";

  const questions = useMemo(() => {
    const qs =
      evaluation?.interview_questions_evaluation || evaluation?.questions || [];
    return Array.isArray(qs) ? qs : [];
  }, [evaluation]);

  const skills = useMemo(() => {
    const s = evaluation?.ratings_for_skills || evaluation?.skill_ratings || [];
    return Array.isArray(s) ? s : [];
  }, [evaluation]);

  const strengths = useMemo(() => {
    const s = evaluation?.strengths || [];
    return (Array.isArray(s) ? s : [s]).map(parseMarkdownBold);
  }, [evaluation]);

  const weaknesses = useMemo(() => {
    const w = evaluation?.weaknesses || [];
    return (Array.isArray(w) ? w : [w]).map(parseMarkdownBold);
  }, [evaluation]);

  const candidateName = useMemo(() => {
    const c = interview?.candidate;
    if (c) return `${c.firstName || ""} ${c.lastName || ""}`.trim();
    const sd = interview?.stepData?.candidateDetails;
    if (sd) return `${sd.firstName || ""} ${sd.lastName || ""}`.trim();
    return "";
  }, [interview]);

  const opening = interview?.opening;
  const avgScore = useMemo(() => {
    if (!questions.length) return null;
    const total = questions.reduce(
      (a, q) => a + (q.score_in_percentage ?? q.score ?? 0),
      0,
    );
    return Math.round(total / questions.length);
  }, [questions]);

  // Transcript from actual messages
  const transcript = useMemo(() => {
    if (!messages.length) return [];
    return messages.filter((m) => m.content && m.content.trim());
  }, [messages]);

  // ── PDF: Report ────────────────────────────────────────────────
  const handleDownloadReport = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const M = 15;
      let y = M;

      // Header
      doc.setFillColor(99, 102, 241);
      doc.rect(0, 0, 210, 50, "F");
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("Interview Evaluation Report", M, 22);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${opening?.title || "Interview"} • ${interview?.interviewEndTime ? new Date(interview.interviewEndTime).toLocaleDateString() : ""}`,
        M,
        32,
      );
      if (candidateName) doc.text(`Candidate: ${candidateName}`, M, 40);
      y = 60;

      const printH = (t) => {
        if (y > 265) {
          doc.addPage();
          y = M;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text(t, M, y);
        y += 8;
      };
      const printP = (t, indent = 0) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const ls = doc.splitTextToSize(String(t), 175 - indent);
        for (const l of ls) {
          if (y > 280) {
            doc.addPage();
            y = M;
          }
          doc.text(l, M + indent, y);
          y += 4.5;
        }
      };

      // Scores
      printH("Score Summary");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      if (overallScore != null) {
        doc.text(`Overall Score: ${overallScore}%`, M, y);
        y += 6;
      }
      doc.text(`Trust Score: ${trustScore}%`, M, y);
      y += 6;
      doc.text(`Questions Evaluated: ${questions.length}`, M, y);
      y += 6;
      if (avgScore != null) {
        doc.text(`Average Question Score: ${avgScore}%`, M, y);
        y += 6;
      }
      y += 4;

      if (interviewSummary) {
        printH("Interview Summary");
        printP(interviewSummary);
        y += 6;
      }
      if (overallVerdict) {
        printH("Overall Verdict");
        printP(overallVerdict);
        y += 6;
      }

      if (strengths.length) {
        printH("Key Strengths");
        strengths.forEach((s) => {
          if (s.title) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(16, 185, 129);
            if (y > 280) {
              doc.addPage();
              y = M;
            }
            doc.text(`• ${s.title}`, M + 2, y);
            y += 4.5;
          }
          if (s.body) printP(s.body, 4);
          y += 2;
        });
        y += 4;
      }

      if (weaknesses.length) {
        printH("Areas for Improvement");
        weaknesses.forEach((w) => {
          if (w.title) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(245, 158, 11);
            if (y > 280) {
              doc.addPage();
              y = M;
            }
            doc.text(`• ${w.title}`, M + 2, y);
            y += 4.5;
          }
          if (w.body) printP(w.body, 4);
          y += 2;
        });
        y += 4;
      }

      if (skills.length) {
        printH("Skill Ratings");
        skills.forEach((sk) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(99, 102, 241);
          if (y > 275) {
            doc.addPage();
            y = M;
          }
          doc.text(
            `${sk.skill_name || sk.skillName}  -  Score: ${sk.rating}/5`,
            M + 2,
            y,
          );
          y += 5;
          if (sk.evaluation) {
            printP(sk.evaluation, 2);
            y += 3;
          }
        });
        y += 4;
      }

      if (questions.length) {
        doc.addPage();
        y = M;
        printH("Question-by-Question Evaluation");
        y += 2;
        questions.forEach((q, i) => {
          if (y > 240) {
            doc.addPage();
            y = M;
          }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(99, 102, 241);
          const qL = doc.splitTextToSize(`Q${i + 1}: ${q.question || ""}`, 175);
          for (const l of qL) {
            if (y > 280) {
              doc.addPage();
              y = M;
            }
            doc.text(l, M, y);
            y += 5;
          }
          const sc = q.score_in_percentage ?? q.score;
          if (sc != null) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(`Score: ${sc}%`, M + 2, y);
            y += 5;
          }

          // Candidate answer from messages
          const ansIdx = q.indexes_of_the_answer?.[0];
          if (ansIdx != null && messages[ansIdx]?.role === "user") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(37, 99, 235);
            if (y > 275) {
              doc.addPage();
              y = M;
            }
            doc.text("Candidate's Answer:", M + 2, y);
            y += 4;
            printP(messages[ansIdx].content, 4);
            y += 2;
          }

          if (q.positives?.length) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(16, 185, 129);
            if (y > 275) {
              doc.addPage();
              y = M;
            }
            doc.text("Positives:", M + 2, y);
            y += 4;
            q.positives.forEach((p) => {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
              doc.setTextColor(71, 85, 105);
              const ls = doc.splitTextToSize(`• ${p}`, 168);
              for (const l of ls) {
                if (y > 280) {
                  doc.addPage();
                  y = M;
                }
                doc.text(l, M + 4, y);
                y += 4;
              }
              y += 1;
            });
          }
          if (q.negatives?.length) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(245, 158, 11);
            if (y > 275) {
              doc.addPage();
              y = M;
            }
            doc.text("Areas to Improve:", M + 2, y);
            y += 4;
            q.negatives.forEach((n) => {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
              doc.setTextColor(71, 85, 105);
              const ls = doc.splitTextToSize(`• ${n}`, 168);
              for (const l of ls) {
                if (y > 280) {
                  doc.addPage();
                  y = M;
                }
                doc.text(l, M + 4, y);
                y += 4;
              }
              y += 1;
            });
          }
          y += 6;
        });
      }

      // Trust
      if (y > 250) {
        doc.addPage();
        y = M;
      }
      printH("Trust & Integrity");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Trust Score: ${trustScore}%`, M, y);
      y += 6;
      if (cheating.verdict) {
        doc.text(`Verdict: ${cheating.verdict}`, M, y);
        y += 6;
      }
      if (cheating.summary) printP(cheating.summary);

      doc.save(
        `report_${(opening?.title || "interview").replace(/\s+/g, "_")}.pdf`,
      );
    } catch (err) {
      console.error("Report PDF:", err);
    } finally {
      setIsDownloading(false);
    }
  }, [
    interview,
    overallScore,
    trustScore,
    overallVerdict,
    interviewSummary,
    strengths,
    weaknesses,
    skills,
    questions,
    cheating,
    candidateName,
    avgScore,
    isDownloading,
    opening,
    messages,
  ]);

  // ── PDF: Transcript ────────────────────────────────────────────
  const handleDownloadTranscript = useCallback(async () => {
    if (isDownloading || !transcript.length) return;
    setIsDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const M = 15;
      let y = M;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text("Interview Transcript", M, y);
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(
        `${opening?.title || "Interview"} • ${candidateName || "Candidate"}`,
        M,
        y,
      );
      y += 10;
      doc.setDrawColor(200);
      doc.line(M, y, 195, y);
      y += 8;

      for (const msg of transcript) {
        const isQ = msg.role === "assistant";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        if (isQ) doc.setTextColor(124, 58, 237);
        else doc.setTextColor(37, 99, 235);
        if (y > 275) {
          doc.addPage();
          y = M;
        }
        doc.text(isQ ? "Interviewer" : candidateName || "Candidate", M, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60);
        const lines = doc.splitTextToSize(msg.content, 170);
        for (const l of lines) {
          if (y > 280) {
            doc.addPage();
            y = M;
          }
          doc.text(l, M + 2, y);
          y += 4.5;
        }
        y += 5;
      }
      doc.save(
        `transcript_${(opening?.title || "interview").replace(/\s+/g, "_")}.pdf`,
      );
    } catch (err) {
      console.error("Transcript PDF:", err);
    } finally {
      setIsDownloading(false);
    }
  }, [transcript, candidateName, opening, isDownloading]);

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
            <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-slate-500 text-sm">Analyzing interview data...</p>
        </motion.div>
      </div>
    );
  }
  if (!interview) return null;

  const tabs = [
    { id: "evaluation", label: "Evaluation Report", icon: BarChart3 },
    { id: "transcript", label: "Interview Transcript", icon: MessageSquare },
  ];

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative">
      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
      <DashboardHeader onMenuClick={() => setIsDrawerOpen(true)} />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 pb-28 space-y-6">
        {/* Back */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/mockmate/candidate/dashboard")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition text-sm group"
        >
          <ArrowLeft
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />{" "}
          Back to Dashboard
        </motion.button>

        {/* ═══ HERO ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-500" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />

          <div className="relative z-10 p-6 md:p-10 text-white">
            <div className="flex items-start gap-4 mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="p-3 bg-white/15 backdrop-blur rounded-2xl"
              >
                <Trophy size={28} />
              </motion.div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  Interview Report
                </h1>
                <p className="text-white/60 text-sm mt-1.5">
                  {opening?.title || "Proctored Interview"} • Completed{" "}
                  {interview.interviewEndTime
                    ? new Date(interview.interviewEndTime).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "long", day: "numeric" },
                      )
                    : "Recently"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                overallScore != null && {
                  value: overallScore,
                  suffix: "%",
                  label: "Overall Score",
                  dec: 1,
                },
                { value: trustScore, suffix: "%", label: "Trust Score" },
                {
                  value: questions.length || opening?.maxQuestions || 0,
                  label: "Questions",
                },
                avgScore != null && {
                  value: avgScore,
                  suffix: "%",
                  label: "Avg. Question Score",
                },
              ]
                .filter(Boolean)
                .map((stat, i) => (
                  <div
                    key={i}
                    className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center"
                  >
                    <p className="text-3xl font-extrabold">
                      {stat.dec ? (
                        <Counter
                          end={stat.value}
                          suffix={stat.suffix || ""}
                          decimals={stat.dec}
                        />
                      ) : stat.suffix ? (
                        <Counter end={stat.value} suffix={stat.suffix} />
                      ) : (
                        stat.value
                      )}
                    </p>
                    <p className="text-xs text-white/50 mt-1.5 font-medium">
                      {stat.label}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </motion.div>

        {/* ═══ TABS ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex p-1 bg-white rounded-2xl border border-slate-200 shadow-sm"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* ═══ EVALUATION TAB ═══ */}
        {activeTab === "evaluation" && (
          <div className="space-y-6">
            {/* Score Dashboard */}
            {overallScore != null && (
              <Section
                icon={TrendingUp}
                title="Overall Summary"
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              >
                <div className="flex flex-col items-center gap-4">
                  <ScoreGauge score={overallScore} size={160} />
                  <div className="grid grid-cols-2 gap-3 w-full">
                    {[
                      {
                        label: "Trust",
                        value: trustScore,
                        suffix: "%",
                        color: "text-blue-600",
                        bg: "bg-blue-50",
                        border: "border-blue-200",
                      },
                      {
                        label: "Questions",
                        value: questions.length,
                        color: "text-amber-600",
                        bg: "bg-amber-50",
                        border: "border-amber-200",
                      },
                    ].map((s, i) => (
                      <div
                        key={i}
                        className={`${s.bg} border ${s.border} rounded-xl p-3 text-center`}
                      >
                        <p className={`text-xl font-extrabold ${s.color}`}>
                          {s.suffix ? (
                            <Counter end={s.value} suffix={s.suffix} />
                          ) : (
                            s.value
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {/* Interview Summary */}
            {interviewSummary && (
              <Section
                icon={BookOpen}
                title="Interview Summary"
                iconBg="bg-violet-50"
                iconColor="text-violet-600"
              >
                <p className="text-sm text-slate-600 leading-relaxed">
                  {interviewSummary}
                </p>
              </Section>
            )}

            {/* Overall Verdict */}
            {overallVerdict && (
              <Section
                icon={Award}
                title="Overall Verdict"
                iconBg="bg-indigo-50"
                iconColor="text-indigo-600"
              >
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {overallVerdict}
                </p>
              </Section>
            )}

            {/* Strengths */}
            {strengths.length > 0 && (
              <Section
                icon={ThumbsUp}
                title={`Key Strengths (${strengths.length})`}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              >
                <div className="space-y-3">
                  {strengths.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3"
                    >
                      {s.title && (
                        <p className="text-sm font-semibold text-emerald-700 mb-1">
                          {s.title}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {s.body}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </Section>
            )}

            {/* Weaknesses */}
            {weaknesses.length > 0 && (
              <Section
                icon={AlertTriangle}
                title={`Areas for Improvement (${weaknesses.length})`}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              >
                <div className="space-y-3">
                  {weaknesses.map((w, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="bg-amber-50/70 border border-amber-100 rounded-xl p-3"
                    >
                      {w.title && (
                        <p className="text-sm font-semibold text-amber-700 mb-1">
                          {w.title}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {w.body}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </Section>
            )}

            {/* Per-Question Evaluation */}
            {questions.length > 0 && (
              <Section
                icon={Hash}
                title={`Questions and Evaluations (${questions.length})`}
                iconBg="bg-purple-50"
                iconColor="text-purple-600"
              >
                <div className="space-y-3">
                  {questions.map((q, i) => (
                    <QuestionCard key={i} q={q} index={i} messages={messages} />
                  ))}
                </div>
              </Section>
            )}

            {/* ═══ FULL-WIDTH SECTIONS BELOW THE TWO-COLUMN LAYOUT ═══ */}

            {/* Skill Ratings */}
            {skills.length > 0 && (
              <Section
                icon={Zap}
                title={`Skill Ratings (${skills.length})`}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  {skills.map((sk, i) => (
                    <SkillCard key={i} skill={sk} index={i} />
                  ))}
                </div>
              </Section>
            )}

            {/* Trust & Integrity */}
            <Section
              icon={Shield}
              title="Trust & Integrity"
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
            >
              <div className="flex flex-col md:flex-row items-start gap-6">
                <TrustMeter score={trustScore} />
                <div className="flex-1">
                  {cheating.verdict && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mb-3 ${
                        cheating.verdict === "HIGH"
                          ? "bg-rose-50 text-rose-600 border border-rose-200"
                          : cheating.verdict === "MEDIUM"
                            ? "bg-amber-50 text-amber-600 border border-amber-200"
                            : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      }`}
                    >
                      <ShieldAlert size={12} /> Cheating Likelihood:{" "}
                      {cheating.verdict}
                    </div>
                  )}
                  {cheating.summary && (
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {cheating.summary}
                    </p>
                  )}
                </div>
              </div>
            </Section>

            {/* Interview Details */}
            <Section
              icon={Briefcase}
              title="Interview Details"
              iconBg="bg-slate-100"
              iconColor="text-slate-600"
            >
              <div className="space-y-1">
                {[
                  { label: "Role", value: opening?.title },
                  {
                    label: "Type",
                    value: opening?.isTechnical ? "Technical" : "Non-Technical",
                  },
                  {
                    label: "Experience",
                    value: opening
                      ? `${opening.minExperience}-${opening.maxExperience} years`
                      : null,
                  },
                  {
                    label: "Conducted",
                    value: interview.interviewEndTime
                      ? new Date(interview.interviewEndTime).toLocaleString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : null,
                  },
                  { label: "Status", value: interview.status },
                ].map(({ label, value }) =>
                  value ? (
                    <div
                      key={label}
                      className="flex justify-between items-center py-2.5 px-4 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-sm text-slate-400">{label}</span>
                      <span className="text-sm font-medium text-slate-700">
                        {value}
                      </span>
                    </div>
                  ) : null,
                )}
                {opening?.skillsGroup?.length > 0 && (
                  <div className="pt-3 px-4">
                    <p className="text-sm text-slate-400 mb-2">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {opening.skillsGroup
                        .flatMap((sg) => sg.skills)
                        .map((skill, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-600 border border-violet-100"
                          >
                            {skill}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}

        {/* ═══ TRANSCRIPT TAB ═══ */}
        {activeTab === "transcript" && (
          <Section
            icon={MessageSquare}
            title="Interview Transcript"
            iconBg="bg-teal-50"
            iconColor="text-teal-600"
          >
            {transcript.length > 0 ? (
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
                {transcript.map((msg, idx) => {
                  const isInterviewer = msg.role === "assistant";
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: isInterviewer ? -16 : 16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.02 }}
                      className={`flex gap-3 ${isInterviewer ? "" : "flex-row-reverse"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white ${
                          isInterviewer
                            ? "bg-gradient-to-br from-violet-500 to-indigo-600"
                            : "bg-gradient-to-br from-blue-500 to-cyan-500"
                        }`}
                      >
                        {isInterviewer ? <Bot size={14} /> : <User size={14} />}
                      </div>
                      <div
                        className={`max-w-[80%] ${isInterviewer ? "" : "text-right"}`}
                      >
                        <p
                          className={`text-xs font-semibold mb-1 ${isInterviewer ? "text-violet-600" : "text-blue-600"}`}
                        >
                          {isInterviewer
                            ? "Interviewer"
                            : candidateName || "Candidate"}
                        </p>
                        <div
                          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                            isInterviewer
                              ? "bg-slate-100 border border-slate-200 text-slate-700 rounded-tl-sm"
                              : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <MessageSquare size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  No transcript data available
                </p>
                <p className="text-xs mt-1">
                  Transcript data is not yet available for this report.
                </p>
              </div>
            )}
          </Section>
        )}
      </div>

      {/* ═══ FLOATING DOWNLOAD BAR ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-4 py-3 shadow-lg"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
            <Sparkles size={16} className="text-violet-500" />
            <span>Download your interview report or transcript</span>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={handleDownloadTranscript}
              disabled={isDownloading || !transcript.length}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Transcript
            </button>
            <button
              onClick={handleDownloadReport}
              disabled={isDownloading}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
            >
              {isDownloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileText size={16} />
              )}
              Download Report
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
