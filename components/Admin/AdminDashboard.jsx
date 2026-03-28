import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../services/api";
import { DashboardHeader } from "../Dashboard";
import { SideDrawer } from "../SideDrawer";
import { useAppStore } from "../../store/useAppStore";
import InterviewDetailModal from "./InterviewDetailModal";
import VideoPlayerModal from "./VideoPlayer/VideoPlayerModal";
import DashboardStats from "./DashboardStats";
import UserListTable from "./UserListTable";
import UserDetailsView from "./UserDetailsView";
import ProctoredInterviewsStats from "./ProctoredInterviewsStats";
import ProctoredInterviewsTable from "./ProctoredInterviewsTable";
import ResumeViewerModal from "./ResumeViewerModal";

const AdminDashboard = () => {
  const { user, setUser, resetSession, setFeedbackData } = useAppStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [userGrowth, setUserGrowth] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedUserId = searchParams.get("userId");
  const viewMode = selectedUserId ? "user-details" : "dashboard";

  const [selectedUser, setSelectedUser] = useState(null);

  const [selectedUserInterviews, setSelectedUserInterviews] = useState([]);
  const [visiblePageStart, setVisiblePageStart] = useState(1);
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [selectedInterviewDetails, setSelectedInterviewDetails] =
    useState(null);
  const [transcriptLoadingId, setTranscriptLoadingId] = useState(null);

  // Proctored interview state
  const [proctoredInterviews, setProctoredInterviews] = useState([]);
  const [proctoredLoading, setProctoredLoading] = useState(false);
  const [proctoredPage, setProctoredPage] = useState(1);
  const [proctoredTotalPages, setProctoredTotalPages] = useState(1);
  const [proctoredTotal, setProctoredTotal] = useState(0);
  const [proctoredSearch, setProctoredSearch] = useState("");
  const [proctoredStats, setProctoredStats] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [proctoredFilters, setProctoredFilters] = useState({
    statuses: [],
    roles: [],
    experience: [],
    minScore: null,
    maxScore: null,
    date: null,
  });
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null);
  const [resumeModal, setResumeModal] = useState({
    open: false,
    url: "",
    fileName: "",
    loading: false,
  });
  const filterRef = useRef(null);
  const proctoredSearchTimerRef = useRef(null);

  // Video player modal state
  const [videoModal, setVideoModal] = useState({ open: false, interview: null });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setOpenFilterDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // only fetch stats/users if we are in dashboard mode
    if (viewMode === "dashboard") {
      fetchStats();
      fetchUsers();
      fetchUserGrowth();
      fetchProctoredInterviews();
      fetchProctoredStats();
      fetchAvailableRoles();
    }
  }, [page, viewMode]);

  // Re-fetch proctored interviews when page or filters change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewMode === "dashboard") {
        fetchProctoredInterviews();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [proctoredPage, proctoredFilters]);

  // Debounce proctored search
  useEffect(() => {
    if (proctoredSearchTimerRef.current)
      clearTimeout(proctoredSearchTimerRef.current);
    proctoredSearchTimerRef.current = setTimeout(() => {
      setProctoredPage(1);
      fetchProctoredInterviews();
    }, 500);
    return () => {
      if (proctoredSearchTimerRef.current)
        clearTimeout(proctoredSearchTimerRef.current);
    };
  }, [proctoredSearch]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      // If searching, we likely want to be in dashboard mode or just update the list
      if (viewMode === "dashboard") {
        setPage(1);
        fetchUsers();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Handle User Details Fetching based on URL param
  useEffect(() => {
    if (selectedUserId) {
      const fetchUserDetails = async () => {
        setLoading(true);
        try {
          const data = await api.getAdminUserDetails(selectedUserId);
          setSelectedUser(data.user);
          setSelectedUserInterviews(data.interviews);
        } catch (error) {
          console.error("Failed to fetch user details", error);
        } finally {
          setLoading(false);
        }
      };

      fetchUserDetails();
    } else {
      setSelectedUser(null);
      setSelectedUserInterviews([]);
    }
  }, [selectedUserId]);

  // Auto-center pagination window when page changes
  useEffect(() => {
    if (totalPages > 0) {
      let newStart = page - 2;
      const maxStart = Math.max(1, totalPages - 4);
      newStart = Math.max(1, Math.min(newStart, maxStart));

      setVisiblePageStart(newStart);
    }
  }, [page, totalPages]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    resetSession();
    navigate("/mockmate/login");
  };

  const handleViewReport = (feedback) => {
    if (feedback) {
      setFeedbackData(feedback);
      navigate("/mockmate/candidate/report");
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch admin stats", error);
    }
  };

  const fetchUserGrowth = async () => {
    try {
      const data = await api.getUserGrowth();
      setUserGrowth(data);
    } catch (error) {
      console.error("Failed to fetch user growth", error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getAllUsers(page, 10, searchTerm);
      setUsers(data.users);
      setTotalPages(data.pages);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserView = (userId) => {
    setSearchParams({ userId });
  };

  const handleViewTranscript = async (interviewId) => {
    try {
      setTranscriptLoadingId(interviewId);
      // Open modal immediately with null data to show skeleton
      setSelectedInterviewDetails(null);
      setIsTranscriptModalOpen(true);

      const data = await api.getInterviewDetails(interviewId);
      setSelectedInterviewDetails(data);
    } catch (error) {
      console.error("Failed to fetch interview details", error);
    } finally {
      setTranscriptLoadingId(null);
    }
  };

  const fetchProctoredInterviews = async () => {
    setProctoredLoading(true);
    try {
      const statusStr =
        proctoredFilters.statuses.length > 0
          ? proctoredFilters.statuses.join(",")
          : "all";
      const data = await api.getAdminProctoredInterviews(
        proctoredPage,
        10,
        proctoredSearch,
        statusStr,
        {
          role: proctoredFilters.roles.join(","),
          experience: proctoredFilters.experience.join(","),
          minScore: proctoredFilters.minScore,
          maxScore: proctoredFilters.maxScore,
          date: proctoredFilters.date,
        },
      );
      setProctoredInterviews(data.interviews || []);
      setProctoredTotalPages(data.pages || 1);
      setProctoredTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch proctored interviews", error);
    } finally {
      setProctoredLoading(false);
    }
  };

  const fetchProctoredStats = async () => {
    try {
      const data = await api.getAdminProctoredStats();
      setProctoredStats(data);
    } catch (error) {
      console.error("Failed to fetch proctored stats", error);
    }
  };

  const fetchAvailableRoles = async () => {
    try {
      const data = await api.getAdminProctoredRoles();
      setAvailableRoles(data.roles || []);
    } catch (error) {
      console.error("Failed to fetch roles", error);
    }
  };

  const handleOpenResume = async (interviewId) => {
    setResumeModal({
      open: true,
      url: "",
      fileName: "",
      id: interviewId,
      loading: true,
    });
    try {
      const data = await api.getAdminProctoredResumeUrl(interviewId);
      setResumeModal({
        open: true,
        url: data.url,
        fileName: data.fileName || "resume.pdf",
        id: interviewId,
        loading: false,
      });
    } catch {
      setResumeModal({
        open: false,
        url: "",
        fileName: "",
        id: null,
        loading: false,
      });
      alert("Resume not available for this interview.");
    }
  };

  const hasActiveFilters =
    proctoredFilters.statuses.length > 0 ||
    proctoredFilters.roles.length > 0 ||
    proctoredFilters.experience.length > 0 ||
    proctoredFilters.minScore !== null ||
    proctoredFilters.maxScore !== null ||
    proctoredFilters.date;

  const clearAllFilters = () => {
    setProctoredFilters({
      statuses: [],
      roles: [],
      experience: [],
      minScore: null,
      maxScore: null,
      date: null,
    });
    setProctoredPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 relative">
      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
      {/* Admin Header */}
      <DashboardHeader onMenuClick={() => setIsDrawerOpen(true)} />

      {/* Admin Portal Sub-Header */}
      <div className="bg-white/50 backdrop-blur-sm border-b border-slate-200 py-4 mb-6 shadow-sm">
        <h1 className="text-3xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">
          Admin Portal
        </h1>
        <p className="text-center text-slate-500 text-sm mt-1">
          Manage users, interviews, and system insights
        </p>
      </div>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {viewMode === "dashboard" ? (
          <>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-slate-900">
                Dashboard Overview
              </h1>
              <span className="text-sm text-slate-500">
                Last updated: {new Date().toLocaleTimeString()}
              </span>
            </div>
            <DashboardStats stats={stats} userGrowth={userGrowth} />
            <UserListTable
              users={users}
              loading={loading}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              page={page}
              setPage={setPage}
              totalPages={totalPages}
              visiblePageStart={visiblePageStart}
              setVisiblePageStart={setVisiblePageStart}
              handleUserView={handleUserView}
            />

            <ProctoredInterviewsStats proctoredStats={proctoredStats} />

            <ProctoredInterviewsTable
              proctoredTotal={proctoredTotal}
              proctoredSearch={proctoredSearch}
              setProctoredSearch={setProctoredSearch}
              filterRef={filterRef}
              proctoredFilters={proctoredFilters}
              setProctoredFilters={setProctoredFilters}
              proctoredPage={proctoredPage}
              setProctoredPage={setProctoredPage}
              openFilterDropdown={openFilterDropdown}
              setOpenFilterDropdown={setOpenFilterDropdown}
              availableRoles={availableRoles}
              clearAllFilters={clearAllFilters}
              hasActiveFilters={hasActiveFilters}
              proctoredLoading={proctoredLoading}
              proctoredInterviews={proctoredInterviews}
              handleOpenResume={handleOpenResume}
              setVideoModal={setVideoModal}
              navigate={navigate}
              proctoredTotalPages={proctoredTotalPages}
            />

            <ResumeViewerModal
              resumeModal={resumeModal}
              setResumeModal={setResumeModal}
            />
          </>
        ) : (
          <UserDetailsView
            selectedUser={selectedUser}
            selectedUserInterviews={selectedUserInterviews}
            setSearchParams={setSearchParams}
            handleViewReport={handleViewReport}
            handleViewTranscript={handleViewTranscript}
            transcriptLoadingId={transcriptLoadingId}
          />
        )}
      </main>

      <InterviewDetailModal
        isOpen={isTranscriptModalOpen}
        onClose={() => setIsTranscriptModalOpen(false)}
        interview={selectedInterviewDetails}
        isLoading={!!transcriptLoadingId}
      />

      <VideoPlayerModal
        open={videoModal.open}
        onClose={() => setVideoModal({ open: false, interview: null })}
        interview={videoModal.interview}
      />
    </div>
  );
};

export default AdminDashboard;
