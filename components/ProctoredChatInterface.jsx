import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Edit3,
  Upload,
  FileText,
  Calendar,
  CalendarClock,
  Clock,
  Timer,
  Zap,
  Loader2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  MonitorPlay,
  Sparkles,
  RefreshCw,
  Camera,
  Wifi,
  MonitorX,
  Shield,
  X,
  Bell,
  TrendingUp,
  Eye,
  PlayCircle,
  MousePointerClick,
  AlertTriangle,
  Brain,
} from "lucide-react";
import { Button } from "./ui/Button";
import { useProctoredInterview } from "../hooks/useProctoredInterview";
import { useAppStore } from "../store/useAppStore";
import { api } from "../services/api";

// ── Constants ──────────────────────────────────────────────────────────

const CHAT_STEPS = {
  ROLE: "role",
  EXPERIENCE: "experience",
  SKILLS: "skills",
  CONFIRM_OPENING: "confirm_opening",
  CREATING_OPENING: "creating_opening",
  RESUME_CHECK: "resume_check",
  CANDIDATE_DETAILS: "candidate_details",
  CONFIRM_CANDIDATE: "confirm_candidate",
  CREATING_CANDIDATE: "creating_candidate",
  SCHEDULE_TYPE: "schedule_type",
  SCHEDULE_LATER: "schedule_later",
  SCHEDULING: "scheduling",
  READY_TO_JOIN: "ready_to_join",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};

const DEFAULT_ROLE_SUGGESTIONS = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "React Developer",
  "Node.js Developer",
  "DevOps Engineer",
  "Data Scientist",
  "Product Manager",
  "UI/UX Designer",
  "QA Engineer",
  "Mobile Developer",
  "Cloud Architect",
];

const EXPERIENCE_SUGGESTIONS = [
  "0-1 years",
  "1-3 years",
  "3-5 years",
  "5-8 years",
  "8-12 years",
  "12+ years",
];

const FLASH_INSTRUCTIONS = [
  {
    icon: Camera,
    text: "Keep your camera ready — you will be recorded",
    color: "blue",
  },
  { icon: Wifi, text: "Ensure a stable internet connection", color: "emerald" },
  {
    icon: MonitorX,
    text: "Do not switch tabs or leave the interview",
    color: "red",
  },
  {
    icon: Shield,
    text: "All activity is AI-monitored for proctoring",
    color: "purple",
  },
  {
    icon: Sparkles,
    text: "Answer confidently — be your best self!",
    color: "amber",
  },
];

// ── Helper: Parse experience range ────────────────────────────────────
const parseExperience = (text) => {
  const clean = text.replace(/years?/gi, "").trim();
  if (clean.includes("+")) {
    const min = parseInt(clean);
    return { min: min || 0, max: 20 };
  }
  const parts = clean.split("-").map((s) => parseInt(s.trim()));
  return { min: parts[0] || 0, max: parts[1] || parts[0] || 20 };
};

// ── Helper: Parse skills to handle commas inside parentheses ───────────
const parseSkills = (text) => {
  if (!text) return [];
  // Split by comma but NOT if the comma is within parentheses
  return text
    .split(/,(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const TOTAL_COUNTDOWN = 10;

// ── Sub-components ────────────────────────────────────────────────────

/** Compact link-generation overlay with progress bar + scrolling instructions */
const LinkGenerationOverlay = React.memo(
  ({ seconds, total = TOTAL_COUNTDOWN }) => {
    const progress = ((total - seconds) / total) * 100;
    const [flashIdx, setFlashIdx] = useState(0);

    useEffect(() => {
      const t = setInterval(
        () => setFlashIdx((p) => (p + 1) % FLASH_INSTRUCTIONS.length),
        2000,
      );
      return () => clearInterval(t);
    }, []);

    const flash = FLASH_INSTRUCTIONS[flashIdx];
    const FlashIcon = flash.icon;
    const isAlmostDone = seconds <= 3;

    return (
      <div className="flex flex-col items-center gap-5 p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl shadow-lg animate-fade-in-up">
        {/* Spinner + title */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <Sparkles
              size={14}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {isAlmostDone
                ? "Almost ready..."
                : "Generating your interview link"}
            </p>
            <p className="text-xs text-slate-500">
              Setting up your AI interview session
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] text-slate-400">
              Preparing session...
            </span>
            <span className="text-[11px] font-semibold text-blue-600 tabular-nums">
              {seconds}s remaining
            </span>
          </div>
        </div>

        {/* Scrolling instructions */}
        <div
          className="flex items-center gap-2.5 px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-100 shadow-sm animate-instruction-slide w-full"
          key={flashIdx}
        >
          <div
            className={`p-1.5 rounded-lg bg-${flash.color}-50 flex-shrink-0`}
          >
            <FlashIcon size={16} className={`text-${flash.color}-500`} />
          </div>
          <span className="text-xs text-slate-700 font-medium">
            {flash.text}
          </span>
        </div>

        {/* Camera setup hint */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Camera size={13} className="text-blue-400" />
          <span>Set up your camera & mic while you wait</span>
        </div>
      </div>
    );
  },
);
LinkGenerationOverlay.displayName = "LinkGenerationOverlay";

const BotMessage = React.memo(({ children, className = "" }) => (
  <div className={`flex gap-3 chat-msg-enter animate-fade-in-up ${className}`}>
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5 shadow-sm">
      AI
    </div>
    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-md p-5 max-w-[85%] sm:max-w-[75%] shadow-sm transition-all hover:shadow-md">
      {children}
    </div>
  </div>
));
BotMessage.displayName = "BotMessage";

const UserMessage = React.memo(({ text, onEdit }) => (
  <div className="flex justify-end gap-2 chat-msg-enter group">
    <div className="bg-blue-600 text-white rounded-2xl rounded-tr-md px-5 py-3.5 max-w-[85%] sm:max-w-[75%] shadow-md">
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
    {onEdit && (
      <button
        onClick={onEdit}
        className="p-1.5 text-slate-400 hover:text-blue-500 self-center transition-colors opacity-0 group-hover:opacity-100"
        title="Edit"
      >
        <Edit3 size={14} />
      </button>
    )}
  </div>
));
UserMessage.displayName = "UserMessage";

const QuickChips = React.memo(
  ({ options, onSelect, loading, selectedValues = [] }) => (
    <div className="flex flex-col gap-2 mt-2 mb-2 w-full animate-fade-in-up">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
        <Sparkles size={14} className="text-blue-500" />
        Suggested Quick Replies
      </div>
      <div className="flex flex-wrap gap-2 max-h-[130px] overflow-y-auto p-1.5 -m-1.5">
        {loading && (
          <div className="px-4 py-2 bg-white border border-blue-200 rounded-full shadow-sm flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full typing-dot" />
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full typing-dot" />
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full typing-dot" />
          </div>
        )}
        {options.map((opt) => {
          const isSelected = selectedValues.includes(opt.toLowerCase());
          return (
            <button
              key={opt}
              onClick={() => onSelect(opt)}
              className={`px-4 py-2 border rounded-full text-sm font-medium flex items-center gap-1.5 transition-all duration-300 ${
                isSelected
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent shadow-[0_0_15px_rgba(59,130,246,0.6)] scale-105"
                  : "bg-white text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-md hover:-translate-y-0.5 shadow-sm"
              }`}
            >
              {opt}
              {isSelected && <Check size={14} />}
            </button>
          );
        })}
      </div>
    </div>
  ),
);
QuickChips.displayName = "QuickChips";

const TypingIndicator = React.memo(() => (
  <div className="flex gap-3">
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
      AI
    </div>
    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm flex items-center gap-1.5">
      <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
      <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
      <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
    </div>
  </div>
));
TypingIndicator.displayName = "TypingIndicator";

const LoadingOverlay = React.memo(({ title, subtitle }) => {
  const [flashIdx, setFlashIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setFlashIdx((p) => (p + 1) % FLASH_INSTRUCTIONS.length),
      3000,
    );
    return () => clearInterval(t);
  }, []);
  const flash = FLASH_INSTRUCTIONS[flashIdx];
  const FlashIcon = flash.icon;

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-5 chat-msg-enter">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <Sparkles
          size={20}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600"
        />
      </div>
      <div className="text-center">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>
      <div className="loading-bar h-1 w-48 rounded-full" />
      {/* Flash instructions */}
      <div
        className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg animate-fade-in-up"
        key={flashIdx}
      >
        <FlashIcon size={16} className={`text-${flash.color}-500`} />
        <span className="text-xs text-slate-600">{flash.text}</span>
      </div>
    </div>
  );
});
LoadingOverlay.displayName = "LoadingOverlay";

// ── Main Component ────────────────────────────────────────────────────

export const ProctoredChatInterface = () => {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const {
    interview,
    step,
    loading,
    actionLoading,
    error,
    isCompleted,
    isInProgress,
    isScheduled,
    isEvaluationPending,
    interviewUrl,
    fetchStatus,
    findOrCreateOpening,
    createCandidate,
    scheduleInterview,
    markInProgress,
    saveProgress,
    startOver,
    startPolling,
    stopPolling,
    rescheduleInterview,
    resumeInterviewAction,
    resetActiveSessionAction,
    refreshEvaluation,
    setError,
  } = useProctoredInterview();

  const [chatStep, setChatStep] = useState(CHAT_STEPS.ROLE);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [collected, setCollected] = useState({
    role: "",
    experience: "",
    isTechnical: true,
    skills: [],
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    experienceYears: 0,
  });
  const [aiSuggestedSkills, setAiSuggestedSkills] = useState([]);
  const [classifyingRole, setClassifyingRole] = useState(false);
  const [roleSuggestions, setRoleSuggestions] = useState(
    DEFAULT_ROLE_SUGGESTIONS,
  );
  const [loadingRoleSuggestions, setLoadingRoleSuggestions] = useState(false);
  const [isOpeningInterview, setIsOpeningInterview] = useState(false);
  const fetchedRolesForUserId = useRef(null);

  // Reset role suggestions ref on logout so they re-fetch on re-login
  useEffect(() => {
    if (!user) {
      fetchedRolesForUserId.current = null;
      setRoleSuggestions(DEFAULT_ROLE_SUGGESTIONS);
    }
  }, [user]);

  // Fetch AI-powered role suggestions based on user profile
  // Only call during early stages (before opening is created)
  useEffect(() => {
    if (!user || fetchedRolesForUserId.current === user._id) return;

    // Wait until interview data is loaded before deciding
    if (loading) return;

    // Skip if interview has progressed past the role selection stage
    const status = interview?.status;
    if (
      status &&
      status !== "CONSENT_GIVEN" &&
      status !== "DETAILS_COLLECTED"
    ) {
      return;
    }

    const hasProfile =
      user.currentRole?.trim() ||
      user.targetRole?.trim() ||
      user.skills?.length > 0;

    if (!hasProfile) return; // No profile data, keep defaults

    fetchedRolesForUserId.current = user._id;
    setLoadingRoleSuggestions(true);

    const defaultLower = new Set(
      DEFAULT_ROLE_SUGGESTIONS.map((r) => r.toLowerCase()),
    );

    api
      .suggestRoles({
        currentRole: user.currentRole,
        targetRole: user.targetRole,
        skills: user.skills,
        experienceLevel: user.experienceLevel,
        yearsOfExperience: user.yearsOfExperience,
      })
      .then((result) => {
        if (result.suggestedRoles?.length > 0) {
          // Prepend AI roles that aren't already in defaults
          const newRoles = result.suggestedRoles.filter(
            (r) => !defaultLower.has(r.toLowerCase()),
          );
          setRoleSuggestions((prev) => [...newRoles, ...prev]);
        }
      })
      .catch((err) => {
        console.warn("AI role suggestions failed, using defaults:", err);
      })
      .finally(() => setLoadingRoleSuggestions(false));
  }, [user, interview?.status, loading]);
  const [countdown, setCountdown] = useState(null);
  const [countdownDone, setCountdownDone] = useState(false);
  const [interviewTabOpened, setInterviewTabOpened] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showStartOver, setShowStartOver] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [cannotResetInfo, setCannotResetInfo] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const inputAreaRef = useRef(null);
  const countdownRef = useRef(null);
  const [inputAreaHeight, setInputAreaHeight] = useState(0);
  const initializedRef = useRef(false);

  // ── Scroll to bottom ────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    setTimeout(
      () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  }, []);

  useEffect(scrollToBottom, [
    messages,
    chatStep,
    scrollToBottom,
    inputAreaHeight,
  ]);

  // ── Add message helper ──────────────────────────────────────────────
  const addBot = useCallback((content, key) => {
    setMessages((prev) => [
      ...prev,
      { role: "bot", content, key: key || Date.now() },
    ]);
  }, []);
  const addUser = useCallback((text, editKey) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", text, key: editKey || Date.now() },
    ]);
  }, []);

  // ── Initialize from saved state ─────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    if (!interview) {
      navigate("/mockmate/candidate/proctored-interview");
      return;
    }

    if (initializedRef.current) return;
    initializedRef.current = true;

    // Determine starting chat step from interview status
    const status = interview.status;
    const savedData = interview.stepData || {};

    if (status === "COMPLETED") {
      setChatStep(CHAT_STEPS.COMPLETED);
      return;
    }
    if (status === "IN_PROGRESS") {
      setChatStep(CHAT_STEPS.IN_PROGRESS);
      startPolling();
      return;
    }
    if (status === "SCHEDULED") {
      setChatStep(CHAT_STEPS.READY_TO_JOIN);
      return;
    }
    if (status === "CANDIDATE_ADDED") {
      setChatStep(CHAT_STEPS.SCHEDULE_TYPE);
      if (savedData.openingDetails) {
        setCollected((prev) => ({
          ...prev,
          ...savedData.openingDetails,
          ...savedData.candidateDetails,
        }));
      }
      addBot(
        "Great! Your profile has been set up. Now let's schedule your interview. When would you like to take it?",
      );
      return;
    }
    if (status === "OPENING_CREATED") {
      setChatStep(CHAT_STEPS.RESUME_CHECK);
      if (savedData.openingDetails) {
        setCollected((prev) => ({ ...prev, ...savedData.openingDetails }));
      }
      addBot(
        "Excellent! Your interview opening is ready. Now let's set up your candidate profile.",
      );
      return;
    }

    // Fresh start — ask for role
    addBot(
      "Welcome! Let's set up your proctored interview. 🎯\n\nWhat role are you targeting for?",
    );
  }, [loading, interview, navigate, addBot, startPolling]);

  // ── Clean up on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopPolling();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [stopPolling]);

  // ── Track input area height for dynamic padding ─────────────────────
  useEffect(() => {
    const el = inputAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setInputAreaHeight(entry.contentRect.height + 40); // 40px extra breathing room
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [chatStep]);

  // ── Handle send ─────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text) => {
      const value = (text || inputValue).trim();
      if (!value) return;
      setInputValue("");
      setError(null);

      switch (chatStep) {
        case CHAT_STEPS.ROLE: {
          addUser(value);
          setCollected((prev) => ({ ...prev, role: value }));
          setChatStep(CHAT_STEPS.EXPERIENCE);
          setTimeout(
            () => addBot("How many years of experience do you have?"),
            500,
          );
          break;
        }

        case CHAT_STEPS.EXPERIENCE: {
          addUser(value);
          const { min, max } = parseExperience(value);
          setCollected((prev) => ({
            ...prev,
            experience: value,
            experienceYears: min,
            minExperience: min,
            maxExperience: max,
          }));

          // Fire AI classification in background (non-blocking)
          setClassifyingRole(true);
          api
            .classifyRole(collected.role, value)
            .then((result) => {
              setCollected((prev) => ({
                ...prev,
                isTechnical: result.isTechnical,
              }));
              setAiSuggestedSkills(result.suggestedSkills || []);
            })
            .catch((err) => {
              console.warn("Role classification failed, using default:", err);
              // Fallback: keep isTechnical as true
            })
            .finally(() => setClassifyingRole(false));

          setChatStep(CHAT_STEPS.SKILLS);
          setTimeout(
            () =>
              addBot(
                "What are your key skills? (comma-separated, e.g., React, Node.js, Python)",
              ),
            500,
          );
          break;
        }

        case CHAT_STEPS.SKILLS: {
          addUser(value);
          const skills = parseSkills(value);
          setCollected((prev) => ({ ...prev, skills }));
          setChatStep(CHAT_STEPS.CONFIRM_OPENING);
          break;
        }

        default:
          break;
      }
    },
    [inputValue, chatStep, addUser, addBot, setError],
  );

  // ── Handle enter key ────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Edit handler ────────────────────────────────────────────────────
  const handleEdit = useCallback((stepToRevert) => {
    // Remove messages after the one being edited and go back to that step
    setChatStep(stepToRevert);
    // Clear forward messages - simple approach: reset to role step
    setMessages((prev) => {
      // Keep only the first bot message
      return prev.length > 0 ? [prev[0]] : [];
    });
    setCollected((prev) => ({ ...prev, role: "", experience: "", skills: [] }));
    setAiSuggestedSkills([]);
  }, []);

  // ── Confirm opening ─────────────────────────────────────────────────
  const handleConfirmOpening = useCallback(async () => {
    setChatStep(CHAT_STEPS.CREATING_OPENING);
    try {
      const result = await findOrCreateOpening({
        title: collected.role,
        isTechnical: collected.isTechnical,
        minExperience: collected.minExperience || 0,
        maxExperience: collected.maxExperience || 20,
        skills: collected.skills,
        jobRequirements: [`Interview for ${collected.role} position`],
      });

      await saveProgress({
        currentStep: 3,
        stepData: { openingDetails: { ...collected } },
        status: "OPENING_CREATED",
      });

      if (result.isExistingOpening) {
        addBot(
          "We found an existing opening that matches your profile. We'll use that for your interview.",
        );
      } else {
        addBot("Your interview opening has been created successfully! ✅");
      }

      setChatStep(CHAT_STEPS.RESUME_CHECK);
      setTimeout(() => {
        addBot(
          "Now let's set up your candidate profile. Let me check your details...",
        );
      }, 800);
    } catch (err) {
      setChatStep(CHAT_STEPS.CONFIRM_OPENING);
      addBot(`❌ There was an error: ${err.message}. Please try again.`);
    }
  }, [collected, findOrCreateOpening, saveProgress, addBot]);

  // ── Resume upload ───────────────────────────────────────────────────
  const handleResumeUpload = useCallback(
    async (file) => {
      setUploadingResume(true);
      try {
        await api.uploadResume(file);
        const updatedUser = await api.getMe();
        useAppStore.getState().setUser(updatedUser);
        setResumeFile(file);
        addBot(
          "Resume uploaded successfully! ✅ Let me prepare your details...",
        );
        setChatStep(CHAT_STEPS.CANDIDATE_DETAILS);
      } catch (err) {
        addBot("❌ Failed to upload resume. Please try again.");
      } finally {
        setUploadingResume(false);
      }
    },
    [addBot],
  );

  // ── Confirm candidate ───────────────────────────────────────────────
  const handleConfirmCandidate = useCallback(async () => {
    setChatStep(CHAT_STEPS.CREATING_CANDIDATE);
    try {
      const nameParts = (user?.name || "").split(" ");
      await createCandidate({
        openingId:
          interview?.zinterviewOpeningId || opening?.zinterviewOpeningId,
        firstName: collected.firstName || nameParts[0] || "User",
        lastName: collected.lastName || nameParts.slice(1).join(" ") || "User",
        email: collected.email || user?.email || "",
        phoneNumber: collected.phoneNumber || user?.phone || "",
        experience: collected.experienceYears || user?.yearsOfExperience || 0,
        resumeS3Key: user?.resumeS3Key || "",
      });

      await saveProgress({
        currentStep: 4,
        stepData: { candidateDetails: { ...collected } },
        status: "CANDIDATE_ADDED",
      });

      addBot("Your candidate profile has been created! 🎉");
      setChatStep(CHAT_STEPS.SCHEDULE_TYPE);
      setTimeout(() => {
        addBot("When would you like to take the interview?");
      }, 800);
    } catch (err) {
      setChatStep(CHAT_STEPS.CONFIRM_CANDIDATE);
      addBot(`❌ Error: ${err.message}. Please try again.`);
    }
  }, [collected, user, createCandidate, saveProgress, addBot]);

  // ── Schedule interview ──────────────────────────────────────────────
  const handleSchedule = useCallback(
    async (isNow) => {
      setChatStep(CHAT_STEPS.SCHEDULING);
      try {
        let scheduleData;
        if (isNow) {
          scheduleData = { isStartNow: true };
        } else {
          if (!scheduleDate || !scheduleTime) {
            addBot("Please select both a date and time.");
            setChatStep(CHAT_STEPS.SCHEDULE_LATER);
            return;
          }
          const dateStr = `${scheduleDate}T${scheduleTime}:00`;
          scheduleData = { schedule: dateStr, isStartNow: false };
        }

        const result = await scheduleInterview(scheduleData);

        await saveProgress({
          currentStep: 5,
          status: "SCHEDULED",
        });

        addBot("Interview scheduled successfully! 🎉");
        setChatStep(CHAT_STEPS.READY_TO_JOIN);

        if (isNow) {
          // Start countdown
          setCountdownDone(false);
          setCountdown(TOTAL_COUNTDOWN);
          countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(countdownRef.current);
                // Don't call window.open here — browsers block it from timer callbacks.
                // Instead, set countdownDone so the UI shows a prominent "Join" button.
                setCountdownDone(true);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } catch (err) {
        setChatStep(CHAT_STEPS.SCHEDULE_TYPE);
        addBot(`❌ Error scheduling: ${err.message}. Please try again.`);
      }
    },
    [scheduleDate, scheduleTime, scheduleInterview, saveProgress, addBot],
  );

  // ── Join interview ──────────────────────────────────────────────────
  const handleJoinInterview = useCallback(async () => {
    let url = interview?.interviewUrl;
    if (!url) return;

    // Append source=mockmate to the URL
    url = url.includes("?")
      ? `${url}&source=mockmate`
      : `${url}?source=mockmate`;

    setIsOpeningInterview(true);
    try {
      await resetActiveSessionAction().catch(() => {});
      window.open(url, "_blank", "noopener,noreferrer");

      // Mark that the user has opened the interview tab
      setInterviewTabOpened(true);

      // Then mark as in-progress (fire-and-forget, non-blocking)
      markInProgress().catch(() => {});

      setCountdownDone(false);
      setChatStep(CHAT_STEPS.IN_PROGRESS);
      startPolling();
    } catch (err) {
      addBot("❌ Failed to mark interview as in progress. Please try again.");
    } finally {
      setIsOpeningInterview(false);
    }
  }, [
    interview,
    resetActiveSessionAction,
    markInProgress,
    startPolling,
    addBot,
  ]);

  // ── Reopen interview tab ────────────────────────────────────────────
  const handleReopenInterview = useCallback(async () => {
    let url = interview?.interviewUrl;
    if (!url) return;

    // Append source=mockmate to the URL
    url = url.includes("?")
      ? `${url}&source=mockmate`
      : `${url}?source=mockmate`;

    setIsOpeningInterview(true);
    await resetActiveSessionAction().catch(() => {});
    window.open(url, "_blank", "noopener,noreferrer");
    setIsOpeningInterview(false);
  }, [interview, resetActiveSessionAction]);

  // ── Watch for completion ────────────────────────────────────────────
  useEffect(() => {
    if (isCompleted && chatStep === CHAT_STEPS.IN_PROGRESS) {
      setChatStep(CHAT_STEPS.COMPLETED);
      // Only stop polling if evaluation is ready; keep polling if pending
      if (!isEvaluationPending) {
        stopPolling();
      }
    }
    // If evaluation arrives while on COMPLETED step, stop polling
    if (
      isCompleted &&
      chatStep === CHAT_STEPS.COMPLETED &&
      !isEvaluationPending
    ) {
      stopPolling();
    }
  }, [isCompleted, isEvaluationPending, chatStep, stopPolling]);

  // ── Start over ──────────────────────────────────────────────────────
  const handleStartOver = useCallback(async () => {
    try {
      const result = await startOver({ stepData: collected });

      // Backend may deny reset if interview already started
      if (result?.cannotReset) {
        setShowStartOver(false);
        setCannotResetInfo(result);
        return;
      }

      setShowStartOver(false);

      if (
        result?.consentAlreadyGiven ||
        result?.interview?.consentAcknowledged
      ) {
        // Consent already given — reset chat state in-place and restart
        setMessages([]);
        setCollected({
          role: "",
          experience: "",
          isTechnical: true,
          skills: [],
          firstName: "",
          lastName: "",
          email: "",
          phoneNumber: "",
          experienceYears: 0,
        });
        setAiSuggestedSkills([]);
        setChatStep(CHAT_STEPS.ROLE);
        initializedRef.current = false;
        // Re-fetch to trigger initialization with the reset interview
        await fetchStatus();
      } else {
        navigate("/mockmate/candidate/proctored-interview");
      }
    } catch (err) {
      // Check if the error response contains cannotReset
      const errData = err?.response?.data;
      if (errData?.cannotReset) {
        setShowStartOver(false);
        setCannotResetInfo(errData);
        return;
      }
      // Other error
    }
  }, [startOver, navigate, fetchStatus, collected]);

  // ── Reschedule interview ──────────────────────────────────────────────
  const handleReschedule = useCallback(
    async (isNow) => {
      try {
        let scheduleData;
        if (isNow) {
          scheduleData = { isStartNow: true };
        } else {
          if (!rescheduleDate || !rescheduleTime) {
            addBot("Please select both a date and time.");
            return;
          }
          const dateStr = `${rescheduleDate}T${rescheduleTime}:00`;
          scheduleData = { schedule: dateStr, isStartNow: false };
        }

        await rescheduleInterview(scheduleData);
        setShowReschedule(false);
        setRescheduleDate("");
        setRescheduleTime("");
        addBot("Interview rescheduled successfully! 🎉");

        // Re-fetch status to get updated schedule
        await fetchStatus();

        if (isNow) {
          setCountdownDone(false);
          setCountdown(TOTAL_COUNTDOWN);
          countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(countdownRef.current);
                setCountdownDone(true);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } catch (err) {
        addBot(`❌ Error rescheduling: ${err.message}. Please try again.`);
      }
    },
    [rescheduleDate, rescheduleTime, rescheduleInterview, addBot, fetchStatus],
  );

  // ── Resume interrupted interview ──────────────────────────────────────
  const handleResumeInterview = useCallback(async () => {
    try {
      const result = await resumeInterviewAction();
      if (result?.resumeUrl) {
        window.open(result.resumeUrl, "_blank", "noopener,noreferrer");
      } else {
        addBot(
          "❌ Could not get resume URL. Please try reopening the interview tab.",
        );
      }
    } catch (err) {
      addBot(`❌ Error resuming interview: ${err.message}`);
    }
  }, [resumeInterviewAction, addBot]);

  // ── Set candidate details from user profile ─────────────────────────
  useEffect(() => {
    if (
      chatStep === CHAT_STEPS.RESUME_CHECK ||
      chatStep === CHAT_STEPS.CANDIDATE_DETAILS
    ) {
      const nameParts = (user?.name || "").split(" ");
      setCollected((prev) => ({
        ...prev,
        firstName: prev.firstName || nameParts[0] || "",
        lastName: prev.lastName || nameParts.slice(1).join(" ") || "",
        email: prev.email || user?.email || "",
        phoneNumber: prev.phoneNumber || user?.phone || "",
        experienceYears: prev.experienceYears || user?.yearsOfExperience || 0,
      }));
    }
  }, [chatStep, user]);

  // ── Render helpers ──────────────────────────────────────────────────
  const isInputStep = [
    CHAT_STEPS.ROLE,
    CHAT_STEPS.EXPERIENCE,
    CHAT_STEPS.SKILLS,
  ].includes(chatStep);

  const getPlaceholder = () => {
    switch (chatStep) {
      case CHAT_STEPS.ROLE:
        return "e.g., Full Stack Developer";
      case CHAT_STEPS.EXPERIENCE:
        return "e.g., 3-5 years";
      case CHAT_STEPS.SKILLS:
        return "e.g., React, Node.js, Python";
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading your interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                navigate("/mockmate/candidate/proctored-interview")
              }
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-semibold text-slate-900 text-md">
                Proctored Interview Setup
              </h1>
              <p className="text-xs text-slate-500">
                {chatStep === CHAT_STEPS.IN_PROGRESS
                  ? "Interview in Progress"
                  : chatStep === CHAT_STEPS.COMPLETED
                    ? isEvaluationPending
                      ? "Evaluating Interview..."
                      : "Interview Complete"
                    : chatStep === CHAT_STEPS.READY_TO_JOIN
                      ? "Ready to Join"
                      : "Setting up your interview"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCompleted && !isInProgress && (
              <button
                onClick={() => setShowStartOver(true)}
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <RotateCcw size={18} className="inline mr-1" /> Start Over
              </button>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{
              width: `${Math.min(
                chatStep === CHAT_STEPS.COMPLETED
                  ? 100
                  : chatStep === CHAT_STEPS.IN_PROGRESS
                    ? 90
                    : chatStep === CHAT_STEPS.READY_TO_JOIN
                      ? 80
                      : [
                            CHAT_STEPS.SCHEDULING,
                            CHAT_STEPS.SCHEDULE_TYPE,
                            CHAT_STEPS.SCHEDULE_LATER,
                          ].includes(chatStep)
                        ? 65
                        : [
                              CHAT_STEPS.CREATING_CANDIDATE,
                              CHAT_STEPS.CONFIRM_CANDIDATE,
                              CHAT_STEPS.CANDIDATE_DETAILS,
                            ].includes(chatStep)
                          ? 50
                          : [CHAT_STEPS.RESUME_CHECK].includes(chatStep)
                            ? 40
                            : [
                                  CHAT_STEPS.CREATING_OPENING,
                                  CHAT_STEPS.CONFIRM_OPENING,
                                ].includes(chatStep)
                              ? 30
                              : 20,
                100,
              )}%`,
            }}
          />
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 flex flex-col items-center w-full">
        <div
          className="w-full max-w-4xl mx-auto p-6 space-y-6"
          style={{ paddingBottom: Math.max(inputAreaHeight, 192) }}
        >
          {/* Messages */}
          {messages.map((msg, i) =>
            msg.role === "bot" ? (
              <BotMessage key={msg.key || i}>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {msg.content}
                </p>
              </BotMessage>
            ) : (
              <UserMessage key={msg.key || i} text={msg.text} />
            ),
          )}

          {/* Confirmation card: Opening */}
          {chatStep === CHAT_STEPS.CONFIRM_OPENING && (
            <div className="ml-11 animate-fade-in-up">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 max-w-md">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-blue-500" /> Review
                  Interview Details
                </h3>
                <p className="text-xs text-slate-500">
                  Please review and edit any details before confirming.
                </p>
                <div className="grid gap-3 text-sm">
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Role
                    </label>
                    <input
                      type="text"
                      value={collected.role}
                      onChange={(e) =>
                        setCollected((prev) => ({
                          ...prev,
                          role: e.target.value,
                        }))
                      }
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Experience
                    </label>
                    <input
                      type="text"
                      value={collected.experience}
                      onChange={(e) => {
                        const val = e.target.value;
                        const { min, max } = parseExperience(val);
                        setCollected((prev) => ({
                          ...prev,
                          experience: val,
                          experienceYears: min,
                          minExperience: min,
                          maxExperience: max,
                        }));
                      }}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Type
                    </label>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() =>
                          setCollected((prev) => ({
                            ...prev,
                            isTechnical: true,
                          }))
                        }
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          collected.isTechnical
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        Technical
                      </button>
                      <button
                        onClick={() =>
                          setCollected((prev) => ({
                            ...prev,
                            isTechnical: false,
                          }))
                        }
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          !collected.isTechnical
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        Non-Technical
                      </button>
                    </div>
                    {classifyingRole && (
                      <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" />
                        AI is detecting role type...
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Skills
                    </label>
                    <input
                      type="text"
                      value={collected.skills.join(", ")}
                      onChange={(e) =>
                        setCollected((prev) => ({
                          ...prev,
                          skills: parseSkills(e.target.value),
                        }))
                      }
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., React, Node.js, Python"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(CHAT_STEPS.ROLE)}
                    className="flex-1"
                  >
                    <RotateCcw size={14} className="mr-1" /> Start Over
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmOpening}
                    className="flex-1"
                    isLoading={actionLoading}
                    disabled={classifyingRole}
                  >
                    <Check size={14} className="mr-1" /> Confirm & Proceed
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Loading: Creating opening */}
          {chatStep === CHAT_STEPS.CREATING_OPENING && (
            <LoadingOverlay
              title="Setting up your AI interview..."
              subtitle="Finding the best match for your profile"
            />
          )}

          {/* Resume check */}
          {chatStep === CHAT_STEPS.RESUME_CHECK && (
            <div className="ml-11 animate-fade-in-up space-y-3">
              <BotMessage>
                <p className="text-sm text-slate-700">
                  {user?.resumeUrl
                    ? "I found your resume on file. Would you like to use it or upload a new one?"
                    : "Please upload your resume to proceed. This will be shared with the interviewer."}
                </p>
              </BotMessage>

              <div className="ml-11 space-y-3 max-w-md">
                {user?.resumeUrl && (
                  <div className="bg-white border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <FileText size={20} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {user?.resumeFileName || "Resume.pdf"}
                      </p>
                      <p className="text-xs text-emerald-600">
                        Already uploaded
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setChatStep(CHAT_STEPS.CANDIDATE_DETAILS)}
                    >
                      Use This <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </div>
                )}

                <label className="flex items-center gap-3 p-4 bg-white border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                  <Upload size={20} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {user?.resumeUrl
                        ? "Upload a different resume"
                        : "Upload your resume"}
                    </p>
                    <p className="text-xs text-slate-400">
                      PDF, DOC, DOCX (max 5MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] &&
                      handleResumeUpload(e.target.files[0])
                    }
                  />
                  {uploadingResume && (
                    <Loader2 size={18} className="animate-spin text-blue-500" />
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Candidate details confirmation */}
          {chatStep === CHAT_STEPS.CANDIDATE_DETAILS && (
            <div className="ml-11 animate-fade-in-up space-y-3">
              <BotMessage>
                <p className="text-sm text-slate-700">
                  Here are your details. Please review and edit if needed:
                </p>
              </BotMessage>
              <div className="ml-11 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 max-w-md">
                {[
                  { label: "First Name", key: "firstName" },
                  { label: "Last Name", key: "lastName" },
                  { label: "Email", key: "email" },
                  { label: "Phone", key: "phoneNumber" },
                  {
                    label: "Experience (years)",
                    key: "experienceYears",
                    type: "number",
                  },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-slate-500">
                      {label}
                    </label>
                    <input
                      type={type || "text"}
                      value={collected[key] || ""}
                      onChange={(e) =>
                        setCollected((prev) => ({
                          ...prev,
                          [key]:
                            type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                        }))
                      }
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleConfirmCandidate}
                    className="w-full"
                    isLoading={actionLoading}
                  >
                    <Check size={14} className="mr-1" /> Confirm & Create
                    Profile
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Loading: Creating candidate */}
          {chatStep === CHAT_STEPS.CREATING_CANDIDATE && (
            <LoadingOverlay
              title="AI is analyzing your profile..."
              subtitle="Setting up your proctored interview"
            />
          )}

          {/* Schedule type */}
          {chatStep === CHAT_STEPS.SCHEDULE_TYPE && (
            <div className="ml-11 space-y-3 animate-fade-in-up mt-2">
              <div className="ml-11 grid sm:grid-cols-2 gap-3 max-w-md">
                <button
                  onClick={() => handleSchedule(true)}
                  className="group flex flex-col items-center gap-3 p-5 bg-white border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
                >
                  <div className="p-3 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
                    <Zap size={24} className="text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-900">Start Now</p>
                    <p className="text-xs text-slate-500">
                      Begin in less than a minute
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setChatStep(CHAT_STEPS.SCHEDULE_LATER)}
                  className="group flex flex-col items-center gap-3 p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/10 transition-all"
                >
                  <div className="p-3 bg-purple-50 rounded-full group-hover:bg-purple-100 transition-colors">
                    <Calendar size={24} className="text-purple-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-900">
                      Schedule Later
                    </p>
                    <p className="text-xs text-slate-500">
                      Pick a convenient time
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Schedule later: date/time picker */}
          {chatStep === CHAT_STEPS.SCHEDULE_LATER && (
            <div className="ml-11 animate-fade-in-up space-y-3">
              <div className="ml-11 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 max-w-md">
                <h3 className="font-semibold text-slate-900 text-sm">
                  Select Date & Time
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Date
                    </label>
                    <input
                      type="date"
                      value={scheduleDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Time
                    </label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChatStep(CHAT_STEPS.SCHEDULE_TYPE)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSchedule(false)}
                    className="flex-1"
                    disabled={!scheduleDate || !scheduleTime}
                    isLoading={actionLoading}
                  >
                    Schedule Interview
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Loading: Scheduling */}
          {chatStep === CHAT_STEPS.SCHEDULING && (
            <LoadingOverlay
              title="Scheduling your interview..."
              subtitle="Almost there!"
            />
          )}

          {/* Ready to join */}
          {chatStep === CHAT_STEPS.READY_TO_JOIN && (
            <div className="ml-11 animate-fade-in-up space-y-4">
              <BotMessage>
                <p className="text-sm text-slate-700">
                  Your interview is scheduled! 🎉{" "}
                  {interview?.isStartNow
                    ? "Your interview link is being generated..."
                    : `Scheduled for ${new Date(interview?.schedule).toLocaleString()}.`}
                </p>
              </BotMessage>

              <div className="ml-11 max-w-md space-y-3">
                {/* Link Generation Overlay (during countdown) */}
                {countdown !== null && countdown > 0 && (
                  <LinkGenerationOverlay
                    seconds={countdown}
                    total={TOTAL_COUNTDOWN}
                  />
                )}

                {/* Animated Join button reveal — after countdown completes */}
                {countdownDone && !interviewTabOpened && (
                  <div className="flex flex-col items-center gap-3 p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl shadow-lg animate-scale-bounce-in">
                    <div className="flex items-center gap-2 text-green-700 font-semibold">
                      <CheckCircle2 size={20} className="text-green-600" />
                      Your interview link is ready!
                    </div>
                    <button
                      onClick={handleJoinInterview}
                      disabled={isOpeningInterview}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl
                        hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg text-lg animate-glow-ring disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isOpeningInterview ? (
                        <>
                          <Loader2 size={20} className="animate-spin" /> Opening
                          interview...
                        </>
                      ) : (
                        <>
                          <ExternalLink size={20} /> Join Interview Now
                          <ArrowRight
                            size={18}
                            className="animate-bounce-arrow"
                          />
                        </>
                      )}
                    </button>
                    <div className="flex items-center gap-1.5 text-xs text-green-600 text-center font-medium">
                      <MousePointerClick size={14} className="animate-pulse" />
                      Click the button above — interview opens in a new tab
                    </div>
                  </div>
                )}

                {/* After tab has been opened and user returns — Reopen / Resume / Reschedule */}
                {interviewTabOpened &&
                  chatStep === CHAT_STEPS.READY_TO_JOIN && (
                    <div className="space-y-3 animate-fade-in-up">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                        <MonitorPlay size={16} className="text-blue-600" />
                        <p className="text-sm text-blue-800 font-medium">
                          Interview tab has been opened. Switch to that tab to
                          begin.
                        </p>
                      </div>

                      <div className="grid gap-2.5">
                        {/* Reopen Interview */}
                        <button
                          onClick={handleReopenInterview}
                          disabled={isOpeningInterview}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-blue-200 text-blue-700 font-medium rounded-xl
                          hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {isOpeningInterview ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />{" "}
                              Opening interview...
                            </>
                          ) : (
                            <>
                              <RefreshCw size={16} /> Reopen Interview Tab
                            </>
                          )}
                        </button>

                        {/* Resume Interview */}
                        <button
                          onClick={handleResumeInterview}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-xl
                          hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md"
                          disabled={actionLoading || isOpeningInterview}
                        >
                          {actionLoading && !isOpeningInterview ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <PlayCircle size={16} />
                          )}
                          Resume Interview
                        </button>

                        {/* Reschedule Interview */}
                        <button
                          onClick={() => setShowReschedule(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-purple-200 text-purple-700 font-medium rounded-xl
                          hover:border-purple-400 hover:bg-purple-50 transition-all shadow-sm"
                        >
                          <CalendarClock size={16} /> Reschedule Interview
                        </button>
                      </div>

                      <p className="text-xs text-slate-400 text-center">
                        If the interview tab was closed, click "Resume
                        Interview" to pick up where you left off.
                      </p>
                    </div>
                  )}

                {/* Start Now / Join button — for schedule-later (no countdown running, not opened yet) */}
                {!countdownDone &&
                  countdown === null &&
                  !interviewTabOpened && (
                    <div className="space-y-3">
                      <button
                        onClick={handleJoinInterview}
                        disabled={isOpeningInterview}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl
                        hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg animate-pulse-glow text-lg disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isOpeningInterview ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />{" "}
                            Opening interview...
                          </>
                        ) : (
                          <>
                            <ExternalLink size={20} /> Start Interview Now
                          </>
                        )}
                      </button>

                      {/* Start anytime note for schedule-later */}
                      {!interview?.isStartNow && (
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                          <Zap
                            size={15}
                            className="text-amber-500 mt-0.5 flex-shrink-0"
                          />
                          <p className="text-xs text-amber-800">
                            <span className="font-semibold">
                              You don't have to wait!
                            </span>{" "}
                            You can start your interview anytime before the
                            scheduled time.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                {/* Reschedule button — always visible when tab not yet opened */}
                {!interviewTabOpened &&
                  (countdown === null || countdownDone) && (
                    <button
                      onClick={() => setShowReschedule(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-purple-200 text-purple-700 font-medium rounded-xl
                      hover:border-purple-400 hover:bg-purple-50 transition-all shadow-sm"
                    >
                      <CalendarClock size={18} /> Reschedule Interview
                    </button>
                  )}

                <p className="text-xs text-slate-500 text-center">
                  Interview opens in a new tab
                </p>
              </div>
            </div>
          )}

          {/* Reschedule Modal */}
          {showReschedule && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={() => setShowReschedule(false)}
              />
              <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-fade-in-up">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <CalendarClock size={20} className="text-purple-600" />
                  Reschedule Interview
                </h3>
                <p className="text-sm text-slate-600">
                  Choose a new date and time for your interview.
                </p>
                {/* Warning if interview session may have already started */}
                {interviewTabOpened && (
                  <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertTriangle
                      size={16}
                      className="text-amber-500 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs font-semibold text-amber-800">
                        Only reschedule if you haven't started the interview
                        yet.
                      </p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        If you've already begun the interview session, we
                        recommend continuing and completing it to avoid losing
                        your chance.
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Date
                    </label>
                    <input
                      type="date"
                      value={rescheduleDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Time
                    </label>
                    <input
                      type="time"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReschedule(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleReschedule(false)}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    disabled={!rescheduleDate || !rescheduleTime}
                    isLoading={actionLoading}
                  >
                    Reschedule
                  </Button>
                </div>
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="mx-3 text-xs text-slate-400">or</span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleReschedule(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  isLoading={actionLoading}
                >
                  <Zap size={16} className="mr-1" /> Start Now Instead
                </Button>
              </div>
            </div>
          )}

          {/* In progress */}
          {chatStep === CHAT_STEPS.IN_PROGRESS && (
            <div className="flex flex-col items-center justify-center py-12 gap-5 animate-fade-in-up">
              <div className="p-4 bg-blue-50 rounded-full">
                <MonitorPlay
                  size={40}
                  className="text-blue-600 animate-pulse"
                />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900">
                  Interview in Progress
                </h2>
                <p className="text-sm text-slate-500 mt-2">
                  Your interview is running in another tab. We'll automatically
                  detect when it's complete.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Monitoring for completion...
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {interviewUrl && (
                  // <a
                  //   href={interviewUrl}
                  //   target="_blank"
                  //   rel="noopener noreferrer"
                  //   className="flex items-center gap-2 px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm"
                  // >
                  //   <RefreshCw size={15} /> Reopen interview tab
                  // </a>
                  <button
                    onClick={handleReopenInterview}
                    disabled={isOpeningInterview}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isOpeningInterview ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Opening
                        interview...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={15} /> Reopen Interview Tab
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={handleResumeInterview}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-medium hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md"
                  disabled={actionLoading || isOpeningInterview}
                >
                  {actionLoading && !isOpeningInterview ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <PlayCircle size={15} />
                  )}
                  Resume Interview
                </button>
              </div>
              <p className="text-xs text-slate-400 max-w-sm text-center">
                If the interview tab was closed, click "Resume Interview" to
                pick up from where you left off.
              </p>
            </div>
          )}

          {/* Completed */}
          {chatStep === CHAT_STEPS.COMPLETED && (
            <>
              {/* Evaluation Pending — attractive loading UI */}
              {isEvaluationPending ? (
                <div className="flex flex-col items-center justify-center py-12 gap-6 animate-fade-in-up">
                  {/* Animated brain/sparkles spinner */}
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <Brain
                      size={28}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse"
                    />
                  </div>

                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold text-slate-900">
                      Our AI is Evaluating Your Interview…
                    </h2>
                    <p className="text-sm text-slate-500 max-w-md">
                      Your interview is complete! We're generating a detailed
                      evaluation report with scores, strengths, and areas for
                      improvement. This usually takes a few minutes.
                    </p>
                  </div>

                  {/* Pulsing progress indicator */}
                  <div className="w-64">
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full animate-evaluation-progress" />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      Analyzing responses & generating insights…
                    </p>
                  </div>

                  {/* Motivational cards */}
                  <div className="grid sm:grid-cols-3 gap-3 max-w-2xl w-full">
                    <div
                      className="flex flex-col items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-xl text-center animate-fade-in-up"
                      style={{ animationDelay: "0.1s" }}
                    >
                      <Bell size={20} className="text-blue-600" />
                      <p className="text-xs font-semibold text-blue-900">
                        Recruiters Will Be Notified
                      </p>
                      <p className="text-[11px] text-blue-600">
                        Your profile will be shared with hiring partners
                      </p>
                    </div>
                    <div
                      className="flex flex-col items-center gap-2 p-4 bg-purple-50 border border-purple-200 rounded-xl text-center animate-fade-in-up"
                      style={{ animationDelay: "0.2s" }}
                    >
                      <TrendingUp size={20} className="text-purple-600" />
                      <p className="text-xs font-semibold text-purple-900">
                        Keep Practicing
                      </p>
                      <p className="text-[11px] text-purple-600">
                        Practice more interviews while you wait
                      </p>
                    </div>
                    <div
                      className="flex flex-col items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center animate-fade-in-up"
                      style={{ animationDelay: "0.3s" }}
                    >
                      <Sparkles size={20} className="text-emerald-600" />
                      <p className="text-xs font-semibold text-emerald-900">
                        Results Coming Soon
                      </p>
                      <p className="text-[11px] text-emerald-600">
                        Your detailed report will be ready shortly
                      </p>
                    </div>
                  </div>

                  {/* Refresh button */}
                  <button
                    onClick={refreshEvaluation}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <RefreshCw size={15} />
                    )}
                    Check for Results
                  </button>

                  <p className="text-xs text-slate-400 max-w-sm text-center">
                    We automatically check every 30 seconds, or click above to
                    check now.
                  </p>
                </div>
              ) : (
                /* Evaluation Ready — existing completion UI */
                <div className="flex flex-col items-center justify-center py-12 gap-6 animate-fade-in-up">
                  <div className="p-4 bg-emerald-50 rounded-full">
                    <CheckCircle2 size={40} className="text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-900">
                      Interview Completed! 🎉
                    </h2>
                    <p className="text-sm text-slate-500 mt-2 max-w-md">
                      Great job! Your evaluation is ready. Your profile and
                      scores are being shared with top hiring companies.
                    </p>
                  </div>

                  {/* Motivational highlights */}
                  <div className="grid sm:grid-cols-3 gap-3 max-w-2xl w-full">
                    <div
                      className="flex flex-col items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-xl text-center animate-fade-in-up"
                      style={{ animationDelay: "0.1s" }}
                    >
                      <Bell size={20} className="text-blue-600" />
                      <p className="text-xs font-semibold text-blue-900">
                        Recruiters Notified
                      </p>
                      <p className="text-[11px] text-blue-600">
                        Your profile is now visible to hiring partners
                      </p>
                    </div>
                    <div
                      className="flex flex-col items-center gap-2 p-4 bg-purple-50 border border-purple-200 rounded-xl text-center animate-fade-in-up"
                      style={{ animationDelay: "0.2s" }}
                    >
                      <TrendingUp size={20} className="text-purple-600" />
                      <p className="text-xs font-semibold text-purple-900">
                        Better Scores = More Calls
                      </p>
                      <p className="text-[11px] text-purple-600">
                        High scorers get priority placement
                      </p>
                    </div>
                    <div
                      className="flex flex-col items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center animate-fade-in-up"
                      style={{ animationDelay: "0.3s" }}
                    >
                      <Sparkles size={20} className="text-emerald-600" />
                      <p className="text-xs font-semibold text-emerald-900">
                        Keep Growing
                      </p>
                      <p className="text-[11px] text-emerald-600">
                        Practice more to become even stronger
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() =>
                      navigate("/mockmate/candidate/proctored-interview/report")
                    }
                    className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                  >
                    <Eye size={18} className="mr-2" /> View Your Report{" "}
                    <ArrowRight size={16} className="ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Error display */}
          {error && (
            <div className="ml-11 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in-up">
              <AlertCircle
                size={16}
                className="text-red-500 mt-0.5 flex-shrink-0"
              />
              <div>
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs text-red-500 hover:text-red-600 mt-1 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input area */}
      {isInputStep && (
        <div
          ref={inputAreaRef}
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pt-4 pb-6 px-4 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]"
        >
          <div className="max-w-4xl mx-auto flex flex-col gap-3">
            {/* Quick suggestions moved here */}
            {chatStep === CHAT_STEPS.ROLE && messages.length > 0 && (
              <QuickChips
                options={roleSuggestions}
                onSelect={(v) => handleSend(v)}
                loading={loadingRoleSuggestions}
                selectedValues={[inputValue.trim().toLowerCase()]}
              />
            )}
            {chatStep === CHAT_STEPS.EXPERIENCE && (
              <QuickChips
                options={EXPERIENCE_SUGGESTIONS}
                onSelect={(v) => handleSend(v)}
                selectedValues={[inputValue.trim().toLowerCase()]}
              />
            )}
            {chatStep === CHAT_STEPS.SKILLS &&
              (aiSuggestedSkills.length > 0 || classifyingRole) && (
                <QuickChips
                  options={aiSuggestedSkills}
                  loading={classifyingRole}
                  selectedValues={parseSkills(inputValue).map((s) =>
                    s.toLowerCase(),
                  )}
                  onSelect={(v) => {
                    const currentVals = parseSkills(inputValue);
                    const existingLower = currentVals.map((s) =>
                      s.toLowerCase(),
                    );

                    if (existingLower.includes(v.toLowerCase())) {
                      const newVals = currentVals.filter(
                        (s) => s.toLowerCase() !== v.toLowerCase(),
                      );
                      setInputValue(
                        newVals.join(", ") + (newVals.length > 0 ? ", " : ""),
                      );
                      inputRef.current?.focus();
                      return;
                    }

                    if (currentVals.length > 0) {
                      setInputValue([...currentVals, v].join(", ") + ", ");
                    } else {
                      setInputValue(v + ", ");
                    }
                    inputRef.current?.focus();
                  }}
                />
              )}

            <div className="flex items-center gap-3 w-full">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholder()}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <Button
                onClick={() => handleSend()}
                disabled={!inputValue.trim()}
                className="px-4 py-3 rounded-xl"
              >
                <Send size={18} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Start Over confirmation */}
      {showStartOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowStartOver(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-fade-in-up">
            <h3 className="font-bold text-slate-900">⚠️ Start Over?</h3>
            <p className="text-sm text-slate-600">
              All progress will be lost. Any scheduled interview will be
              cancelled. This cannot be undone.
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

      {/* Cannot Reset Modal \u2014 Interview Already Started */}
      {cannotResetInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setCannotResetInfo(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-full">
                <Shield size={24} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-slate-900">Cannot Start Over</h3>
            </div>
            <p className="text-sm text-slate-600">{cannotResetInfo.reason}</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCannotResetInfo(null)}
                className="flex-1"
              >
                OK, Got It
              </Button>
              {cannotResetInfo.interviewUrl && (
                <Button
                  onClick={() => {
                    window.open(
                      cannotResetInfo.interviewUrl,
                      "_blank",
                      "noopener,noreferrer",
                    );
                    setCannotResetInfo(null);
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <ExternalLink size={16} className="mr-1" /> Rejoin
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
