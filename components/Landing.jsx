import React from "react";
import { Briefcase, UserCircle, Code2, FileText, Globe } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { AppState } from "../types";
import { useNavigate } from "react-router-dom";
import { ProctoredInterviewBanner } from "./ProctoredInterviewBanner";
import { BackToDashboardButton } from "./ui/BackToDashboardButton";

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Hindi",
  "Mandarin",
  "Japanese",
  "Portuguese",
];

/**
 * ModeCard — Theme-aware interview mode selection card for the Landing page
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

export const Landing = ({
  onSelectMode,
  totalQuestions,
  onTotalQuestionsChange,
}) => {
  const { language, setLanguage, user, setAppState } = useAppStore();
  const navigate = useNavigate();

  const inputStyle = {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-xs)",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden theme-transition"
      style={{
        background: "var(--bg-base)",
        color: "var(--text-primary)",
      }}
    >
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div
          className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[128px]"
          style={{
            background: "var(--accent-bg)",
            opacity: 0.5,
          }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[128px]"
          style={{
            background: "var(--success-bg)",
            opacity: 0.4,
          }}
        />
      </div>

      <div className="z-10 max-w-5xl w-full">
        <div className="flex justify-start mb-8 w-full">
          <BackToDashboardButton />
        </div>
        
        <div className="space-y-12 text-center">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 mb-6">
            <div
              className="p-3 rounded-xl ring-1"
              style={{
                background: "var(--bg-surface)",
                boxShadow: "var(--shadow-md)",
                ringColor: "var(--border)",
              }}
            >
              <Code2 size={40} style={{ color: "var(--accent)" }} />
            </div>
          </div>
          <h1
            className="text-4xl md:text-6xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Zi MockMate
          </h1>
          <p
            className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Master your next technical interview with a personalized AI
            interviewer. Practice realistic scenarios tailored to your target
            role.
          </p>

          {/* Settings Row */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <Globe size={18} style={{ color: "var(--text-muted)" }} />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 transition-colors"
                style={inputStyle}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            {onTotalQuestionsChange && (
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Questions:
                </span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={totalQuestions || 7}
                  onChange={(e) =>
                    onTotalQuestionsChange(parseInt(e.target.value) || 10)
                  }
                  className="w-16 rounded-lg px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 text-center transition-colors"
                  style={inputStyle}
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mx-auto">
          <ModeCard
            onClick={() => onSelectMode("jd")}
            icon={<Briefcase size={32} />}
            title="Interview Based On Job Description"
            description="Paste a JD and let the AI extract requirements to grill you on specifics."
            accentColor="#3b82f6"
          />
          <ModeCard
            onClick={() => onSelectMode("resume")}
            icon={<FileText size={32} />}
            title="Based On Resume"
            description="Upload your resume. The AI will suggest roles and skills to practice based on your profile."
            accentColor="#8b5cf6"
          />
          <ModeCard
            onClick={() => onSelectMode("role")}
            icon={<UserCircle size={32} />}
            title="Practice for a Role"
            description='Mention a role (e.g. "Full Stack") and the AI will customize the session for you.'
            accentColor="#10b981"
          />
          <ProctoredInterviewBanner variant="card" />
        </div>

        <ProctoredInterviewBanner variant="full" className="mt-8" />
        </div>
      </div>
    </div>
  );
};
