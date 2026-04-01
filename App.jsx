import React, { useEffect, Suspense, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import LogRocket from "logrocket";
import { useAppStore } from "./store/useAppStore";
import { Auth } from "./components/Auth";
import { Dashboard } from "./components/Dashboard";
import AdminDashboard from "./components/Admin/AdminDashboard";
import { CandidateSession } from "./components/CandidateSession";
import { ReportView } from "./components/ReportView";
import { ProfileSetup } from "./components/ProfileSetup";
import { UserProfile } from "./components/UserProfile";
import { AppState } from "./types";
import { Code2, ArrowRight } from "lucide-react";
import { api } from "./services/api";
import { ForgotPassword } from "./components/ForgotPassword";
import { ResetPassword } from "./components/ResetPassword";
import { useThemeStore } from "./store/useThemeStore";
import AppLayout from "./components/layout/AppLayout";

// Lazy-loaded components
const ProctoredInterviewInfo = React.lazy(() =>
  import("./components/ProctoredInterviewInfo").then((m) => ({
    default: m.ProctoredInterviewInfo,
  })),
);
const ProctoredChatInterface = React.lazy(() =>
  import("./components/ProctoredChatInterface").then((m) => ({
    default: m.ProctoredChatInterface,
  })),
);
const ProctoredReport = React.lazy(() =>
  import("./components/ProctoredReport").then((m) => ({
    default: m.ProctoredReport,
  })),
);
const AdminProctoredReport = React.lazy(
  () => import("./components/Admin/AdminProctoredReport"),
);
const JobOpeningsPage = React.lazy(
  () => import("./components/jobs/JobOpeningsPage"),
);
const EventsPage = React.lazy(
  () => import("./components/events/EventsPage"),
);
const JobAnalyticsPage = React.lazy(
  () => import("./components/analytics/JobAnalyticsPage"),
);
const NotificationsPage = React.lazy(
  () => import("./components/notifications/NotificationsPage"),
);
const CentralisedResumePage = React.lazy(
  () => import("./components/resume/CentralisedResumePage"),
);

const LazyFallback = () => {
  return (
    <div
      className="min-h-screen flex items-center justify-center theme-transition"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-10 h-10 rounded-full animate-spin"
          style={{
            border: "4px solid var(--border)",
            borderTopColor: "var(--accent)",
          }}
        />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading...
        </p>
      </div>
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center p-6 theme-transition"
      style={{ background: "var(--bg-base-gradient)" }}
    >
      <div
        className="p-4 rounded-2xl mb-6"
        style={{
          background: "var(--accent-gradient)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <Code2 size={48} className="text-white" />
      </div>
      <h1
        className="text-4xl md:text-5xl font-bold mb-4"
        style={{ color: "var(--text-primary)" }}
      >
        Zi MockMate
      </h1>
      <p
        className="text-lg max-w-2xl mb-8"
        style={{ color: "var(--text-secondary)" }}
      >
        Master your interviews with AI-driven mock sessions, resume analysis,
        and real-time feedback.
      </p>
      <button
        onClick={() => navigate("/mockmate/login")}
        className="text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all hover:scale-105"
        style={{
          background: "var(--accent-gradient)",
          boxShadow: "0 4px 16px rgba(124, 58, 237, 0.3)",
        }}
      >
        Get Started <ArrowRight size={20} />
      </button>
    </div>
  );
};

const ProtectedCandidateRoute = ({ children }) => {
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);

  if (authLoading) {
    return <LazyFallback />;
  }

  if (!user) {
    return <Navigate to="/mockmate/login" replace />;
  }
  return <>{children}</>;
};

const ProtectedAdminRoute = ({ children }) => {
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);

  if (authLoading) {
    return <LazyFallback />;
  }

  if (!user) {
    return <Navigate to="/mockmate/login" replace />;
  }

  if (user && !user.isAdmin) {
    return <Navigate to="/mockmate/candidate/dashboard" replace />;
  }

  return <>{children}</>;
};

/**
 * DashboardWrapper — Connects Dashboard to navigation actions.
 * Now uses AppLayout (no embedded header/drawer).
 */
const DashboardWrapper = () => {
  const navigate = useNavigate();
  const { setAppState, setActiveInterviewId, setFeedbackData, resetSession } =
    useAppStore();

  const handleStartNew = () => {
    resetSession();
    setAppState(AppState.LANDING);
    navigate("/mockmate/candidate/practice");
  };

  const handleSelectMode = (mode) => {
    if (mode === "jd") {
      setAppState(AppState.SETUP_JD);
    } else if (mode === "resume") {
      setAppState(AppState.SETUP_RESUME);
    } else if (mode === "role") {
      setAppState(AppState.SETUP_ROLE_CHAT);
    }
    navigate("/mockmate/candidate/practice");
  };

  const handleResume = (interview) => {
    setActiveInterviewId(interview._id);
    navigate("/mockmate/candidate/practice");
  };

  const handleViewReport = (feedback) => {
    if (!feedback) {
      alert("No feedback available for this interview.");
      return;
    }
    setFeedbackData(feedback);
    navigate("/mockmate/candidate/report");
  };

  return (
    <Dashboard
      onStartNew={handleStartNew}
      onResume={handleResume}
      onViewReport={handleViewReport}
      onSelectMode={handleSelectMode}
    />
  );
};

export default function App() {
  const { setUser, setAuthLoading } = useAppStore();
  const initialMeFetchDone = useRef(false);

  useEffect(() => {
    if (initialMeFetchDone.current) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setAuthLoading(false);
      return;
    }

    initialMeFetchDone.current = true;

    if (!useAppStore.getState().user) {
      api
        .getMe()
        .then((user) => {
          setUser(user);
          if (user.email !== "harshith@riktamtech.com") {
            LogRocket.identify(user._id, {
              name: user.name,
              email: user.email,
              isAdmin: user.isAdmin,
            });
          }
        })
        .catch(() => {
          localStorage.removeItem("token");
          setUser(null);
        })
        .finally(() => {
          setAuthLoading(false);
        });
    } else {
      setAuthLoading(false);
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/mockmate" replace />} />

        <Route path="/mockmate" element={<LandingPage />} />

        <Route
          path="/mockmate/login"
          element={
            <Auth
              onLoginSuccess={(u) => {
                setUser(u);
                if (u.email !== "harshith@riktamtech.com") {
                  LogRocket.identify(u._id, {
                    name: u.name,
                    email: u.email,
                    isAdmin: u.isAdmin,
                  });
                }
              }}
            />
          }
        />

        <Route path="/mockmate/forgot-password" element={<ForgotPassword />} />

        <Route
          path="/mockmate/reset-password/:resettoken"
          element={<ResetPassword />}
        />

        {/* ═══════════════════════════════════════════════════
            Pages WITH AppLayout (sidebar + header)
            ═══════════════════════════════════════════════════ */}

        <Route
          path="/mockmate/candidate/dashboard"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <DashboardWrapper />
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/profile-setup"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <ProfileSetup />
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/profile"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <UserProfile />
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/report"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <ReportView />
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/proctored-interview"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <Suspense fallback={<LazyFallback />}>
                  <ProctoredInterviewInfo />
                </Suspense>
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/proctored-interview/report"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <Suspense fallback={<LazyFallback />}>
                  <ProctoredReport />
                </Suspense>
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/jobs"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <Suspense fallback={<LazyFallback />}>
                  <JobOpeningsPage />
                </Suspense>
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/events"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <Suspense fallback={<LazyFallback />}>
                  <EventsPage />
                </Suspense>
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/analytics"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <Suspense fallback={<LazyFallback />}>
                  <JobAnalyticsPage />
                </Suspense>
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/notifications"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <Suspense fallback={<LazyFallback />}>
                  <NotificationsPage />
                </Suspense>
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/my-resume"
          element={
            <ProtectedCandidateRoute>
              <AppLayout>
                <Suspense fallback={<LazyFallback />}>
                  <CentralisedResumePage />
                </Suspense>
              </AppLayout>
            </ProtectedCandidateRoute>
          }
        />

        {/* ═══════════════════════════════════════════════════
            Interview session routes — NO layout (no header/sidebar)
            so user cannot exit interview abnormally
            ═══════════════════════════════════════════════════ */}

        <Route
          path="/mockmate/candidate/practice"
          element={
            <ProtectedCandidateRoute>
              <CandidateSession />
            </ProtectedCandidateRoute>
          }
        />

        <Route
          path="/mockmate/candidate/proctored-interview/chat"
          element={
            <ProtectedCandidateRoute>
              <Suspense fallback={<LazyFallback />}>
                <ProctoredChatInterface />
              </Suspense>
            </ProtectedCandidateRoute>
          }
        />

        {/* ═══════════════════════════════════════════════════
            Admin Routes
            ═══════════════════════════════════════════════════ */}

        <Route
          path="/mockmate/admin"
          element={
            <ProtectedAdminRoute>
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/mockmate/admin/proctored-report/:interviewId"
          element={
            <ProtectedAdminRoute>
              <AppLayout>
                <Suspense fallback={<LazyFallback />}>
                  <AdminProctoredReport />
                </Suspense>
              </AppLayout>
            </ProtectedAdminRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
