import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Rocket,
  Trophy,
  Star,
  ArrowRight,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Bell,
  Eye,
  Award,
  Brain,
  Loader2,
} from "lucide-react";
import { useProctoredInterview } from "../hooks/useProctoredInterview";

const MARKETING_LINES = [
  {
    icon: Trophy,
    text: "Get Placed in Your Dream Role",
    sub: "Top companies are hiring through AI interviews",
  },
  {
    icon: Rocket,
    text: "Ace a Real AI Interview",
    sub: "Stand out with verified interview scores",
  },
  {
    icon: TrendingUp,
    text: "Profile Shared with Top Companies",
    sub: "Your scores reach 400+ hiring partners",
  },
  {
    icon: Star,
    text: "Grab Interview Calls Instantly",
    sub: "High scorers get priority placement",
  },
];

const COMPLETED_LINES = [
  {
    icon: Bell,
    text: "Recruiters Will Start Notifying You Soon",
    sub: "Your profile is now visible to top hiring partners",
  },
  {
    icon: TrendingUp,
    text: "Better Scores, Better Interview Chances",
    sub: "High scorers get priority placement from 400+ companies",
  },
  {
    icon: Sparkles,
    text: "Practice More & Grow Stronger Technically",
    sub: "Keep sharpening your skills for even better opportunities",
  },
  {
    icon: Award,
    text: "Your Evaluation Is Ready!",
    sub: "See how you performed and where you can improve",
  },
];

const EVALUATING_LINES = [
  {
    icon: Brain,
    text: "AI Is Evaluating Your Interview",
    sub: "Your detailed evaluation report is being generated",
  },
  {
    icon: Sparkles,
    text: "Keep Practicing While You Wait",
    sub: "Results will be ready soon — practice more interviews meanwhile",
  },
  {
    icon: TrendingUp,
    text: "Your Profile Is Being Analyzed",
    sub: "Our AI is scoring your responses and generating insights",
  },
  {
    icon: Bell,
    text: "Results Coming Soon!",
    sub: "You'll be able to view your detailed report shortly",
  },
];

const SCHEDULED_LINES = [
  {
    icon: Rocket,
    text: "Your Interview Is Ready — Start Anytime!",
    sub: "Don't wait for the scheduled time, jump in now",
  },
  {
    icon: Trophy,
    text: "Get a Head Start on Your Career",
    sub: "Join your scheduled interview and impress recruiters",
  },
  {
    icon: TrendingUp,
    text: "Complete Your Interview, Get Placed Faster",
    sub: "Companies are actively hiring through AI interviews",
  },
  {
    icon: Star,
    text: "Your Interview Link Is Waiting",
    sub: "Click to join and ace the interview!",
  },
];

/**
 * Attention-grabbing proctored interview banner.
 * Shows "Take Interview" CTAs when interview is NOT completed,
 * shows urgent "Join Now" nudge when interview is SCHEDULED,
 * and motivational "View Report" CTAs when interview IS completed.
 * @param {'full'|'compact'|'card'} variant - Display variant
 */
export const ProctoredInterviewBanner = React.memo(
  ({ variant = "full", className = "" }) => {
    const navigate = useNavigate();
    const { isCompleted, isScheduled, isEvaluationPending, interview } =
      useProctoredInterview();
    const [lineIdx, setLineIdx] = useState(0);

    const lines = isCompleted
      ? isEvaluationPending
        ? EVALUATING_LINES
        : COMPLETED_LINES
      : isScheduled
        ? SCHEDULED_LINES
        : MARKETING_LINES;

    useEffect(() => {
      const timer = setInterval(() => {
        setLineIdx((prev) => (prev + 1) % lines.length);
      }, 3500);
      return () => clearInterval(timer);
    }, [lines.length]);

    const current = useMemo(
      () => lines[lineIdx % lines.length],
      [lines, lineIdx],
    );
    const IconComp = current.icon;

    const handleClick = () => {
      if (isCompleted) {
        if (isEvaluationPending) {
          navigate("/mockmate/candidate/proctored-interview/chat");
        } else {
          navigate("/mockmate/candidate/proctored-interview/report");
        }
      } else if (isScheduled) {
        navigate("/mockmate/candidate/proctored-interview/chat");
      } else {
        navigate("/mockmate/candidate/proctored-interview");
      }
    };

    // ── Compact variant ────────────────────────────────────────────
    if (variant === "compact") {
      return (
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group
          ${
            isCompleted
              ? isEvaluationPending
                ? "bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/10"
                : "bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10"
              : isScheduled
                ? "bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/10"
                : "bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10"
          } ${className}`}
        >
          <div
            className={`p-2 rounded-lg text-white animate-float flex-shrink-0 ${
              isCompleted
                ? isEvaluationPending
                  ? "bg-gradient-to-br from-indigo-400 to-purple-500"
                  : "bg-gradient-to-br from-emerald-400 to-teal-500"
                : isScheduled
                  ? "bg-gradient-to-br from-orange-500 to-red-500"
                  : "bg-gradient-to-br from-amber-400 to-orange-500"
            }`}
          >
            {isCompleted ? (
              isEvaluationPending ? (
                <Brain size={18} className="animate-pulse" />
              ) : (
                <CheckCircle2 size={18} />
              )
            ) : isScheduled ? (
              <Rocket size={18} />
            ) : (
              <Sparkles size={18} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-semibold truncate ${
                isCompleted
                  ? isEvaluationPending
                    ? "text-indigo-900"
                    : "text-emerald-900"
                  : isScheduled
                    ? "text-orange-900"
                    : "text-amber-900"
              }`}
            >
              {isCompleted
                ? isEvaluationPending
                  ? "Evaluating Interview 🧠"
                  : "Interview Completed ✅"
                : isScheduled
                  ? "Interview Scheduled ⏰"
                  : "Proctored Interview"}
            </p>
            <p
              className={`text-xs truncate ${
                isCompleted
                  ? isEvaluationPending
                    ? "text-indigo-600"
                    : "text-emerald-600"
                  : isScheduled
                    ? "text-orange-600"
                    : "text-amber-600"
              }`}
            >
              {isCompleted
                ? isEvaluationPending
                  ? "Results coming soon. Keep practicing!"
                  : "View your detailed evaluation report"
                : isScheduled
                  ? "Join now — you can start anytime!"
                  : "Get placed in your dream role"}
            </p>
          </div>
          {isCompleted ? (
            isEvaluationPending ? (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-500 text-white rounded-full flex-shrink-0 animate-pulse">
                🧠 EVALUATING
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white rounded-full flex-shrink-0">
                ✅ DONE
              </span>
            )
          ) : isScheduled ? (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded-full flex-shrink-0 animate-pulse">
              ⏰ JOIN
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full flex-shrink-0 animate-pulse">
              NEW
            </span>
          )}
        </button>
      );
    }

    // ── Card variant ───────────────────────────────────────────────
    if (variant === "card") {
      return (
        <button
          onClick={handleClick}
          className={`group relative flex flex-col items-center p-8 rounded-2xl transition-all text-left overflow-hidden theme-transition ${
            isCompleted
              ? isEvaluationPending
                ? "border border-indigo-200 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/15"
                : "border border-emerald-200 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/15"
              : isScheduled
                ? "border border-orange-200 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-500/15"
                : "border border-amber-200 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/15"
          } ${className}`}
          style={{
            background: "var(--bg-surface)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {/* Badge */}
          <div
            className={`absolute top-4 right-4 px-2 py-0.5 text-[10px] font-bold text-white rounded-full ${
              isCompleted
                ? isEvaluationPending
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse"
                  : "bg-gradient-to-r from-emerald-500 to-teal-500"
                : isScheduled
                  ? "bg-gradient-to-r from-orange-500 to-red-500 animate-pulse"
                  : "bg-gradient-to-r from-red-500 to-orange-500 animate-pulse"
            }`}
          >
            {isCompleted
              ? isEvaluationPending
                ? "🧠 EVALUATING"
                : "✅ COMPLETED"
              : isScheduled
                ? "⏰ SCHEDULED"
                : "🔥 NEW"}
          </div>

          <div
            className={`p-4 rounded-full mb-6 transition-colors ${
              isCompleted
                ? isEvaluationPending
                  ? "bg-gradient-to-br from-indigo-100 to-purple-100 group-hover:from-indigo-200 group-hover:to-purple-200"
                  : "bg-gradient-to-br from-emerald-100 to-teal-100 group-hover:from-emerald-200 group-hover:to-teal-200"
                : isScheduled
                  ? "bg-gradient-to-br from-orange-100 to-red-100 group-hover:from-orange-200 group-hover:to-red-200"
                  : "bg-gradient-to-br from-amber-100 to-orange-100 group-hover:from-amber-200 group-hover:to-orange-200"
            }`}
          >
            <div className="animate-float">
              {isCompleted ? (
                isEvaluationPending ? (
                  <Brain size={32} className="text-indigo-600 animate-pulse" />
                ) : (
                  <CheckCircle2 size={32} className="text-emerald-600" />
                )
              ) : isScheduled ? (
                <Rocket size={32} className="text-orange-600" />
              ) : (
                <Trophy size={32} className="text-amber-600" />
              )}
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2 text-center" style={{ color: "var(--text-primary)" }}>
            {isCompleted
              ? isEvaluationPending
                ? "Evaluating Your Interview 🧠"
                : "Interview Completed! 🎉"
              : isScheduled
                ? "Interview Scheduled! ⏰"
                : "Take a Proctored Interview"}
          </h3>
          <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
            {isCompleted
              ? isEvaluationPending
                ? "Your interview is complete. Our AI is analyzing your responses — results will be ready soon."
                : "Your evaluation is ready. See your scores and how recruiters view your profile."
              : isScheduled
                ? "Your interview is ready. You can start anytime — don't wait for the scheduled time!"
                : "Ace a real AI interview & get your profile shared with top hiring companies."}
          </p>
          <div
            className={`mt-4 flex items-center gap-1 font-medium text-sm group-hover:gap-2 transition-all ${
              isCompleted
                ? isEvaluationPending
                  ? "text-indigo-600"
                  : "text-emerald-600"
                : isScheduled
                  ? "text-orange-600"
                  : "text-amber-600"
            }`}
          >
            {isCompleted ? (
              isEvaluationPending ? (
                <>
                  Check Status <Loader2 size={16} className="animate-spin" />
                </>
              ) : (
                <>
                  View Report <Eye size={16} />
                </>
              )
            ) : isScheduled ? (
              <>
                Join Interview Now <ArrowRight size={16} />
              </>
            ) : (
              <>
                Get Started <ArrowRight size={16} />
              </>
            )}
          </div>
        </button>
      );
    }

    // ── Full variant (Dashboard banner) ────────────────────────────
    return (
      <div className={`relative overflow-hidden rounded-2xl ${className}`}>
        {/* Background */}
        <div
          className={`absolute inset-0 opacity-95 ${
            isCompleted
              ? isEvaluationPending
                ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600"
                : "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600"
              : isScheduled
                ? "bg-gradient-to-r from-orange-600 via-red-500 to-amber-600"
                : "proctored-gradient"
          }`}
        />
        <div className="absolute inset-0 animate-shimmer opacity-20" />

        <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-start gap-4 flex-1">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl flex-shrink-0">
              <div className="animate-float">
                <IconComp size={28} className="text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-white/25 text-white rounded-full backdrop-blur-sm">
                  {isCompleted
                    ? isEvaluationPending
                      ? "🧠 EVALUATING"
                      : "✅ INTERVIEW COMPLETED"
                    : isScheduled
                      ? "⏰ INTERVIEW SCHEDULED"
                      : "🔥 LIMITED OPENINGS"}
                </span>
              </div>
              <h3
                className="text-lg md:text-xl font-bold text-white mb-1 animate-fade-in-up"
                key={lineIdx}
              >
                {current.text}
              </h3>
              <p
                className="text-sm text-white/80 animate-fade-in-up delay-100"
                key={`sub-${lineIdx}`}
              >
                {current.sub}
              </p>
            </div>
          </div>

          <button
            onClick={handleClick}
            className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-xl
            transition-all shadow-lg flex-shrink-0 group ${
              isCompleted
                ? isEvaluationPending
                  ? "bg-white text-indigo-700 hover:bg-indigo-50 animate-pulse-glow"
                  : "bg-white text-emerald-700 hover:bg-emerald-50 animate-pulse-glow"
                : isScheduled
                  ? "bg-white text-orange-700 hover:bg-orange-50 animate-pulse-glow"
                  : "bg-white text-amber-700 hover:bg-amber-50 animate-pulse-glow"
            }`}
          >
            {isCompleted ? (
              isEvaluationPending ? (
                <>
                  <Brain size={18} className="text-indigo-500 animate-pulse" />
                  Check Status
                </>
              ) : (
                <>
                  <Eye size={18} className="text-emerald-500" />
                  View Report
                </>
              )
            ) : isScheduled ? (
              <>
                <Rocket size={18} className="text-orange-500" />
                Join Interview Now
              </>
            ) : (
              <>
                <Sparkles size={18} className="text-amber-500" />
                Take Interview
              </>
            )}
            <ArrowRight
              size={18}
              className="group-hover:translate-x-1 transition-transform"
            />
          </button>
        </div>
      </div>
    );
  },
);

ProctoredInterviewBanner.displayName = "ProctoredInterviewBanner";
