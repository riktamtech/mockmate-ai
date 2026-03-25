import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Camera,
  Wifi,
  MonitorX,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Award,
  Building2,
  Users,
  AlertTriangle,
  RotateCcw,
  Eye,
  TrendingUp,
  Bell,
  Loader2,
  RefreshCw,
  Brain,
} from "lucide-react";
import { Button } from "./ui/Button";
import { ConsentModal } from "./ConsentModal";
import { useProctoredInterview } from "../hooks/useProctoredInterview";
import { BackToDashboardButton } from './ui/BackToDashboardButton';

const BENEFITS = [
  {
    icon: Award,
    title: "Verified Interview Scores",
    desc: "Get AI-evaluated scores that companies trust and value.",
    color: "blue",
  },
  {
    icon: Building2,
    title: "Profile Shared with Companies",
    desc: "Top scorers get their profiles recommended to 400+ hiring partners.",
    color: "purple",
  },
  {
    icon: Users,
    title: "Direct Interview Calls",
    desc: "Companies contact high scorers directly for real job interviews.",
    color: "emerald",
  },
  {
    icon: Sparkles,
    title: "Stand Out from the Crowd",
    desc: "A proctored interview score is 10x more credible than a self-assessed resume.",
    color: "amber",
  },
];

const POST_COMPLETION_CARDS = [
  {
    icon: Bell,
    title: "Recruiters Will Be Notified",
    desc: "Your profile and scores are now visible to top hiring partners. Expect outreach soon!",
    color: "blue",
  },
  {
    icon: TrendingUp,
    title: "Better Scores, Better Chances",
    desc: "High scorers get priority placement and more interview calls from companies.",
    color: "purple",
  },
  {
    icon: Sparkles,
    title: "Keep Practicing & Growing",
    desc: "Practice more to sharpen your skills and unlock even better opportunities.",
    color: "emerald",
  },
  {
    icon: Eye,
    title: "Your Evaluation Is Ready",
    desc: "See your detailed scores, strengths, and areas for improvement in your report.",
    color: "amber",
  },
];

const INSTRUCTIONS = [
  {
    icon: Camera,
    text: "Ensure your camera and microphone are working properly",
    color: "blue",
  },
  {
    icon: Wifi,
    text: "Make sure you have a stable internet connection",
    color: "emerald",
  },
  {
    icon: MonitorX,
    text: "Do not leave, refresh, or switch tabs during the interview",
    color: "red",
  },
  {
    icon: Clock,
    text: "Only start when you are fully prepared — no retakes allowed",
    color: "amber",
  },
  {
    icon: Shield,
    text: "The interview is AI-proctored — all activity is monitored",
    color: "purple",
  },
];

const STEPS_PREVIEW = [
  {
    num: 1,
    label: "Share Details",
    desc: "Tell us your target role & experience",
  },
  { num: 2, label: "Verify Profile", desc: "Confirm your resume and details" },
  { num: 3, label: "Schedule", desc: "Pick a time or start immediately" },
  { num: 4, label: "Give Interview", desc: "AI-powered proctored interview" },
  { num: 5, label: "Get Results", desc: "Receive your detailed evaluation" },
];

const colorMap = {
  blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-200",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-200",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200",
  },
  red: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
};

export const ProctoredInterviewInfo = () => {
  const navigate = useNavigate();
  const {
    interview,
    hasExistingInterview,
    isCompleted,
    isEvaluationPending,
    saveConsent,
    actionLoading,
    loading,
    startOver,
    consentAlreadyGiven,
    refreshEvaluation,
  } = useProctoredInterview();
  const [ackChecked, setAckChecked] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [showStartOver, setShowStartOver] = useState(false);

  const handleProceed = useCallback(() => {
    if (!ackChecked) return;
    setShowConsent(true);
  }, [ackChecked]);

  const handleConsentAccept = useCallback(
    async (signature) => {
      try {
        await saveConsent(signature);
        setShowConsent(false);
        navigate("/mockmate/candidate/proctored-interview/chat");
      } catch (err) {
        // error is in hook state
      }
    },
    [saveConsent, navigate],
  );

  const handleResume = useCallback(() => {
    if (isCompleted) {
      navigate("/mockmate/candidate/proctored-interview/report");
    } else {
      navigate("/mockmate/candidate/proctored-interview/chat");
    }
  }, [isCompleted, navigate]);

  const handleStartOver = useCallback(async () => {
    try {
      const result = await startOver();
      setShowStartOver(false);
      // If consent was already given, skip straight to chat
      if (
        result?.consentAlreadyGiven ||
        result?.interview?.consentAcknowledged
      ) {
        navigate("/mockmate/candidate/proctored-interview/chat");
      }
    } catch (err) {
      // error handled by hook
    }
  }, [startOver, navigate]);

  if (loading) {
    return (
      <div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <BackToDashboardButton />

        {/* Resume banner */}
        {hasExistingInterview &&
          !isCompleted &&
          interview?.status !== "CONSENT_GIVEN" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in-up">
              <div>
                <p className="font-semibold text-blue-900">
                  You have an interview in progress
                </p>
                <p className="text-sm text-blue-600">
                  Continue from where you left off
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleResume} size="sm">
                  Continue <ArrowRight size={14} className="ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStartOver(true)}
                >
                  <RotateCcw size={14} className="mr-1" /> Start Over
                </Button>
              </div>
            </div>
          )}

        {/* Completed banner */}
        {isCompleted && (
          <div
            className={`${
              isEvaluationPending
                ? "bg-indigo-50 border-indigo-200"
                : "bg-emerald-50 border-emerald-200"
            } border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in-up`}
          >
            <div>
              {isEvaluationPending ? (
                <>
                  <p className="font-semibold text-indigo-900 flex items-center gap-1.5">
                    <Brain size={18} className="animate-pulse" /> AI is
                    Evaluating Your Interview
                  </p>
                  <p className="text-sm text-indigo-600">
                    Your results will be ready soon. Keep practicing meanwhile!
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 size={18} /> Interview Completed
                  </p>
                  <p className="text-sm text-emerald-600">
                    View your detailed evaluation report
                  </p>
                </>
              )}
            </div>
            {isEvaluationPending ? (
              <button
                onClick={refreshEvaluation}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Check for Results
              </button>
            ) : (
              <Button
                onClick={() =>
                  navigate("/mockmate/candidate/proctored-interview/report")
                }
                size="sm"
              >
                View Report <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* ── Completed State: Celebratory Post-Interview Section ── */}
        {isCompleted ? (
          <>
            {isEvaluationPending ? (
              /* ── Evaluation Pending State ── */
              <>
                {/* Evaluation In Progress Hero */}
                <div className="text-center space-y-4 animate-fade-in-up">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                    <Brain size={16} className="animate-pulse" /> Evaluation in
                    Progress
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                    Great Job! 🎉{" "}
                    <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                      Almost There!
                    </span>
                  </h1>
                  <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                    Your proctored interview is complete! Our AI is now
                    evaluating your responses. Results will be ready soon — keep
                    practicing meanwhile.
                  </p>
                </div>

                {/* Motivational Cards (modified for pending state) */}
                <div className="grid md:grid-cols-2 gap-4">
                  {POST_COMPLETION_CARDS.map((card, i) => {
                    const c = colorMap[card.color];
                    // Replace the "Your Evaluation Is Ready" card
                    const overrideCard =
                      card.title === "Your Evaluation Is Ready"
                        ? {
                            ...card,
                            title: "Evaluation Coming Soon",
                            desc: "Your detailed scores and feedback are being generated by our AI. Check back shortly!",
                          }
                        : card;
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-4 p-5 bg-white border ${c.border} rounded-xl hover:shadow-md transition-shadow animate-fade-in-up`}
                        style={{ animationDelay: `${i * 0.1}s` }}
                      >
                        <div
                          className={`p-2.5 ${c.bg} rounded-xl flex-shrink-0`}
                        >
                          <card.icon size={22} className={c.text} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {overrideCard.title}
                          </h3>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {overrideCard.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Evaluation Progress CTA (replaces View Report CTA) */}
                <div className="bg-white border border-indigo-200 rounded-xl p-6 animate-fade-in-up">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative">
                      <div className="p-4 bg-indigo-50 rounded-full">
                        <Brain size={32} className="text-indigo-600" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full animate-ping" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Evaluation in Progress
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Our AI is analyzing your responses and generating
                        detailed feedback
                      </p>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full max-w-xs">
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full animate-evaluation-progress" />
                      </div>
                    </div>
                    <button
                      onClick={refreshEvaluation}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-medium text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      Check for Results
                    </button>
                    <p className="text-xs text-slate-400">
                      We automatically check periodically, or click above to
                      check now.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              /* ── Evaluation Ready State (original) ── */
              <>
                {/* Celebration Hero */}
                <div className="text-center space-y-4 animate-fade-in-up">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    <CheckCircle2 size={16} /> Interview Completed
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                    Great Job! 🎉{" "}
                    <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                      You Did It!
                    </span>
                  </h1>
                  <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                    Your proctored interview is complete. Your profile and scores
                    are now being shared with top hiring companies. Here's what
                    happens next:
                  </p>
                </div>

                {/* Post-Completion Motivational Cards */}
                <div className="grid md:grid-cols-2 gap-4">
                  {POST_COMPLETION_CARDS.map((card, i) => {
                    const c = colorMap[card.color];
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-4 p-5 bg-white border ${c.border} rounded-xl hover:shadow-md transition-shadow animate-fade-in-up`}
                        style={{ animationDelay: `${i * 0.1}s` }}
                      >
                        <div
                          className={`p-2.5 ${c.bg} rounded-xl flex-shrink-0`}
                        >
                          <card.icon size={22} className={c.text} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {card.title}
                          </h3>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {card.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* View Report CTA */}
                <div className="bg-white border border-emerald-200 rounded-xl p-6 animate-fade-in-up">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 bg-emerald-50 rounded-full">
                      <Eye size={32} className="text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Your Evaluation Report Is Ready
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        See your detailed scores, strengths, and areas for
                        improvement
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        navigate(
                          "/mockmate/candidate/proctored-interview/report",
                        )
                      }
                      className="px-8 py-3 text-base bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                    >
                      <Eye size={18} className="mr-2" /> View Your Report{" "}
                      <ArrowRight size={18} className="ml-2" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Hero */}
            <div className="text-center space-y-4 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                <Sparkles size={14} /> Limited-time opportunity
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                Take a{" "}
                <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  Proctored AI Interview
                </span>
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Ace a real AI-powered interview and get your profile shared with
                top companies hiring for your dream role.
              </p>
            </div>

            {/* Benefits */}
            <div className="grid md:grid-cols-2 gap-4">
              {BENEFITS.map((b, i) => {
                const c = colorMap[b.color];
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-4 p-5 bg-white border ${c.border} rounded-xl hover:shadow-md transition-shadow animate-fade-in-up`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className={`p-2.5 ${c.bg} rounded-xl flex-shrink-0`}>
                      <b.icon size={22} className={c.text} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {b.title}
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">{b.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* How it works */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 text-center">
                How It Works
              </h2>
              <div className="flex flex-col md:flex-row gap-3 justify-center">
                {STEPS_PREVIEW.map((s, i) => (
                  <div
                    key={s.num}
                    className="flex md:flex-col items-center gap-3 md:gap-2 md:text-center animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {s.num}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">
                        {s.label}
                      </p>
                      <p className="text-xs text-slate-500">{s.desc}</p>
                    </div>
                    {i < STEPS_PREVIEW.length - 1 && (
                      <div className="hidden md:block w-8 h-0.5 bg-blue-200 mt-5" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-500" />
                Important Instructions
              </h2>
              <div className="grid gap-3">
                {INSTRUCTIONS.map((inst, i) => {
                  const c = colorMap[inst.color];
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 ${c.bg} rounded-lg`}
                    >
                      <inst.icon size={18} className={c.text} />
                      <span className="text-sm text-slate-700">
                        {inst.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Acknowledgement — only if no existing interview AND consent never given */}
            {!hasExistingInterview && !consentAlreadyGiven && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 animate-fade-in-up">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={ackChecked}
                    onChange={(e) => setAckChecked(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors leading-relaxed">
                    I understand that this is a{" "}
                    <strong>real proctored interview</strong> with camera and
                    screen monitoring. I confirm that I am prepared and have
                    read all the instructions above. I understand that my
                    interview data and profile may be shared with hiring
                    companies.
                  </span>
                </label>

                <Button
                  onClick={handleProceed}
                  disabled={!ackChecked}
                  className={`w-full py-3 text-base ${
                    ackChecked
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      : ""
                  }`}
                >
                  Proceed to Interview Setup{" "}
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            )}

            {/* Direct proceed — consent was already given (e.g. after reset) */}
            {!hasExistingInterview && consentAlreadyGiven && (
              <div className="bg-white border border-emerald-200 rounded-xl p-6 space-y-4 animate-fade-in-up">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <CheckCircle2 size={22} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Consent Already Acknowledged
                    </p>
                    <p className="text-sm text-slate-500">
                      You've already signed the consent form. You can proceed
                      directly.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    navigate("/mockmate/candidate/proctored-interview/chat")
                  }
                  className="w-full py-3 text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  Proceed to Interview Setup{" "}
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Consent modal */}
      <ConsentModal
        isOpen={showConsent}
        onClose={() => setShowConsent(false)}
        onAccept={handleConsentAccept}
        isLoading={actionLoading}
      />

      {/* Start Over confirmation */}
      {showStartOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowStartOver(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Start Over?</h3>
                <p className="text-sm text-slate-500">
                  This will cancel your current interview
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              All your current progress will be lost. If you have a scheduled
              interview, it will be cancelled. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowStartOver(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleStartOver}
                isLoading={actionLoading}
                className="flex-1"
              >
                Yes, Start Over
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
