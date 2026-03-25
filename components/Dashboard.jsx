import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { Button } from "./ui/Button";
import {
  Play,
  FileText,
  Trash2,
  Loader2,
  Plus,
  Code2,
  Bell,
  Search,
  Briefcase,
  UserCircle,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { ProctoredInterviewBanner } from "./ProctoredInterviewBanner";
import { JobPortalBanner } from "./jobs/JobPortalBanner";

// Dashboard Header Component - used by AdminDashboard
export const DashboardHeader = ({ onMenuClick }) => {
  const { user } = useAppStore();

  return (
    <header
      className="sticky top-0 z-20 theme-transition"
      style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl text-white">
              <Code2 size={24} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                Zi MockMate
              </h1>
              <p className="text-xs -mt-0.5" style={{ color: "var(--text-muted)" }}>
                AI Interview Coach
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="flex items-center gap-3 p-1.5 pr-3 rounded-xl transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--hover-overlay)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>
                  {user?.name || "User"}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

/**
 * ModeCard — Theme-aware interview mode selection card (uses CSS vars)
 */
const ModeCard = ({ onClick, icon, title, description, accentColor }) => (
  <button
    onClick={onClick}
    className="group relative flex flex-col items-center p-8 rounded-2xl transition-all text-left"
    style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      boxShadow: "var(--shadow-card)",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = accentColor + "60";
      e.currentTarget.style.boxShadow = `0 8px 32px ${accentColor}15`;
      e.currentTarget.style.transform = "translateY(-2px)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = "var(--border-subtle)";
      e.currentTarget.style.boxShadow = "var(--shadow-card)";
      e.currentTarget.style.transform = "translateY(0)";
    }}
  >
    <div
      className="p-4 rounded-full mb-6 transition-colors"
      style={{
        background: `${accentColor}12`,
        color: accentColor,
      }}
    >
      {icon}
    </div>
    <h3
      className="text-xl font-semibold mb-2 text-center"
      style={{ color: "var(--text-primary)" }}
    >
      {title}
    </h3>
    <p
      className="text-sm text-center"
      style={{ color: "var(--text-muted)" }}
    >
      {description}
    </p>
  </button>
);

export const Dashboard = ({
  onStartNew,
  onResume,
  onViewReport,
  onSelectMode,
}) => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const data = await api.getMyInterviews();
      setInterviews(data);
    } catch (error) {
      console.error("Failed to fetch interviews", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this interview?")) {
      try {
        await api.deleteInterview(id);
        setInterviews((prev) => prev.filter((i) => i._id !== id));
      } catch (err) {
        alert("Failed to delete interview.");
      }
    }
  };

  /* Badge style helper using CSS vars for theme awareness */
  const badgeStyle = (type) => {
    const map = {
      completed: { background: "var(--success-bg)", color: "var(--success-text)" },
      progress: { background: "var(--info-bg)", color: "var(--info-text)" },
      language: { background: "var(--accent-bg)", color: "var(--accent-text)" },
    };
    return map[type] || {};
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
      {/* Welcome Section — gradient banner is theme-independent (always dark text on gradient) */}
      <div
        className="rounded-2xl p-6 md:p-8 text-white"
        style={{ background: "var(--accent-gradient)" }}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back! 👋
            </h1>
            <p className="text-blue-100 text-sm md:text-base">
              Ready to ace your next interview? Track your progress and keep
              practicing.
            </p>
          </div>
          <Button
            onClick={onStartNew}
            className="bg-white/20 text-white hover:bg-white hover:text-purple-700 shadow-lg transition-colors border-none backdrop-blur-sm"
          >
            <Plus size={20} className="mr-2" /> Start New Interview
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/20">
          <div className="text-center">
            <p className="text-2xl md:text-3xl font-bold">
              {interviews.length}
            </p>
            <p className="text-xs md:text-sm text-blue-100">
              Total Interviews
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl md:text-3xl font-bold">
              {interviews.filter((i) => i.status === "COMPLETED").length}
            </p>
            <p className="text-xs md:text-sm text-blue-100">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl md:text-3xl font-bold">
              {interviews.filter((i) => i.status === "IN_PROGRESS").length}
            </p>
            <p className="text-xs md:text-sm text-blue-100">In Progress</p>
          </div>
        </div>
      </div>

      {/* Proctored Interview Banner */}
      <ProctoredInterviewBanner variant="full" />

      {/* Job Portal Banner */}
      <JobPortalBanner />

      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Your Interviews
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Review your practice sessions and feedback
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2
            className="animate-spin"
            size={40}
            style={{ color: "var(--accent)" }}
          />
        </div>
      ) : interviews.length === 0 ? (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h3
              className="text-xl font-semibold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Start Your First Interview
            </h3>
            <p style={{ color: "var(--text-muted)" }}>
              Choose how you'd like to practice
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <ModeCard
              onClick={() => onSelectMode?.("jd")}
              icon={<Briefcase size={32} />}
              title="Job Description Based"
              description="Paste a JD and let the AI extract requirements to grill you on specifics."
              accentColor="#3b82f6"
            />
            <ModeCard
              onClick={() => onSelectMode?.("resume")}
              icon={<FileText size={32} />}
              title="Resume Based"
              description="Upload your resume. The AI will suggest roles and skills to practice."
              accentColor="#8b5cf6"
            />
            <ModeCard
              onClick={() => onSelectMode?.("role")}
              icon={<UserCircle size={32} />}
              title="Practice for a Role"
              description="Mention a role and the AI will customize the session for you."
              accentColor="#10b981"
            />

            <ProctoredInterviewBanner
              variant="card"
              className="md:col-span-3"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {interviews.map((interview) => (
            <div
              key={interview._id}
              className="p-6 rounded-xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 theme-transition"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3
                    className="font-bold text-lg"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {interview.role}
                  </h3>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide"
                    style={badgeStyle(
                      interview.status === "COMPLETED"
                        ? "completed"
                        : "progress"
                    )}
                  >
                    {interview.status.replace("_", " ")}
                  </span>
                  {interview.language && interview.language !== "English" && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={badgeStyle("language")}
                    >
                      {interview.language}
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {interview.focusArea} • {interview.level} •{" "}
                  {new Date(interview.date).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-3 self-end md:self-auto">
                {interview.status === "IN_PROGRESS" && (
                  <Button
                    size="sm"
                    onClick={() => onResume(interview)}
                  >
                    <Play size={16} className="mr-2" /> Resume
                  </Button>
                )}
                {interview.status === "COMPLETED" && interview.feedback && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewReport(interview.feedback)}
                  >
                    <FileText size={16} className="mr-2" /> View Report
                  </Button>
                )}
                <button
                  onClick={(e) => handleDelete(interview._id, e)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--error)";
                    e.currentTarget.style.background = "var(--error-bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
