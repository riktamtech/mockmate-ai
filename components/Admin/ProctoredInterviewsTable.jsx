import React from "react";
import {
  Shield,
  Search,
  X,
  CheckCircle,
  XCircle,
  Calendar,
  Loader2,
  Award as AwardIcon,
  FileText,
  Video,
  Clock,

  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import ProctoredFiltersBar from "./ProctoredFiltersBar";
import {
  getFullName,
  getRole,
  getExperience,
} from "./adminHelpers";

const ProctoredInterviewsTable = ({
  proctoredTotal,
  proctoredSearch,
  setProctoredSearch,
  filterRef,
  proctoredFilters,
  setProctoredFilters,
  proctoredPage,
  setProctoredPage,
  openFilterDropdown,
  setOpenFilterDropdown,
  availableRoles,
  clearAllFilters,
  hasActiveFilters,
  proctoredLoading,
  proctoredInterviews,
  handleOpenResume,
  setVideoModal,
  navigate,
  proctoredTotalPages,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <Shield size={24} className="text-amber-500" />
        <h3 className="text-xl font-bold text-slate-800">
          Proctored Interviews
        </h3>
        <span className="px-2.5 py-1 text-sm font-bold bg-amber-100 text-amber-700 rounded-full">
          {proctoredTotal}
        </span>
        <div className="flex-1" />
        {/* Search */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search by name, email, role..."
            value={proctoredSearch}
            onChange={(e) => setProctoredSearch(e.target.value)}
            className="pl-10 pr-9 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-72 bg-slate-50 transition-all"
          />
          {proctoredSearch && (
            <button
              onClick={() => setProctoredSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <ProctoredFiltersBar
        filterRef={filterRef}
        proctoredFilters={proctoredFilters}
        setProctoredFilters={setProctoredFilters}
        setProctoredPage={setProctoredPage}
        openFilterDropdown={openFilterDropdown}
        setOpenFilterDropdown={setOpenFilterDropdown}
        availableRoles={availableRoles}
        clearAllFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Table */}
      <div className="overflow-x-auto min-h-[400px]">
        <table
          className="w-full text-left border-collapse min-w-[1000px]"
          style={{ minWidth: "1400px" }}
        >
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm font-semibold border-b border-slate-200 uppercase tracking-wider">
              <th className="p-3.5 pl-6">User</th>
              <th className="p-3.5">Role</th>
              <th className="p-3.5">Exp.</th>
              <th className="p-3.5">Fit Score</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Interview Date</th>
              <th className="p-3.5">Performance</th>
              <th className="p-3.5 text-center">Actions</th>
              <th className="p-3.5">Trust</th>
              <th className="p-3.5">Start / End</th>

            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {proctoredLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {[...Array(10)].map((__, j) => (
                    <td key={j} className="p-3">
                      <div className="h-4 w-16 bg-slate-200 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : proctoredInterviews.length === 0 ? (
              <tr>
                <td colSpan="10" className="p-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Shield size={32} className="text-slate-300" />
                    <p className="text-slate-500 font-medium">
                      No proctored interviews found
                    </p>
                    <p className="text-slate-400 text-xs">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              proctoredInterviews.map((pi) => {
                const statusColors = {
                  COMPLETED: "bg-emerald-100 text-emerald-700",
                  IN_PROGRESS: "bg-blue-100 text-blue-700",
                  SCHEDULED: "bg-purple-100 text-purple-700",
                  CANCELLED: "bg-red-100 text-red-700",
                  CONSENT_GIVEN: "bg-slate-100 text-slate-600",
                  DETAILS_COLLECTED: "bg-sky-100 text-sky-700",
                  OPENING_CREATED: "bg-indigo-100 text-indigo-700",
                  CANDIDATE_ADDED: "bg-teal-100 text-teal-700",
                };
                const fitScore = pi.rawCandidatePayload?.candidateFitScore;
                const fitColors = {
                  HIGH: "bg-emerald-100 text-emerald-700",
                  MEDIUM: "bg-amber-100 text-amber-700",
                  LOW: "bg-red-100 text-red-700",
                };
                const recordingUrl = pi.rawReportPayload?.botRecordingUrl;
                const hasChimeRecording =
                  !!pi.rawReportPayload?.concatenationId;
                const hasAnyRecording = !!recordingUrl || hasChimeRecording;

                const hasResume = !!pi.candidateData?.resumeS3Key;
                const isCompleted = pi.status === "COMPLETED";
                const isInProgress = pi.status === "IN_PROGRESS";

                return (
                  <tr
                    key={pi._id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* User */}
                    <td className="p-3.5 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {getFullName(pi).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-700 text-sm truncate">
                            {getFullName(pi)}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {pi.userData?.email || ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-700 truncate max-w-[160px]">
                          {getRole(pi)}
                        </span>
                      </div>
                    </td>
                    {/* Experience */}
                    <td className="p-3.5">
                      <span className="px-2 py-1 rounded-md text-sm font-medium bg-slate-100 text-slate-700 whitespace-nowrap inline-block">
                        {getExperience(pi)}
                      </span>
                    </td>
                    {/* Candidate Fit Score */}
                    <td className="p-3.5">
                      {fitScore ? (
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold ${fitColors[fitScore?.toUpperCase?.()] || "bg-slate-100 text-slate-600"}`}
                        >
                          {fitScore}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${statusColors[pi.status] || "bg-slate-100 text-slate-600"}`}
                      >
                        {isInProgress && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        )}
                        {isCompleted && <CheckCircle size={12} />}
                        {pi.status === "CANCELLED" && <XCircle size={12} />}
                        {pi.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    {/* Interview Date */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Calendar size={14} className="text-slate-400" />
                        {pi.schedule
                          ? new Date(pi.schedule).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : pi.createdAt
                            ? new Date(pi.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
                            : "—"}
                      </div>
                    </td>
                    {/* Performance Score */}
                    <td className="p-3.5">
                      {isCompleted && pi.performanceScore != null ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center p-[2.5px]"
                            style={{
                              background: `conic-gradient(${
                                pi.performanceScore >= 70
                                  ? "#10b981"
                                  : pi.performanceScore >= 50
                                    ? "#f59e0b"
                                    : "#f43f5e"
                              } ${pi.performanceScore}%, #e2e8f0 0)`,
                            }}
                          >
                            <div
                              className="w-full h-full bg-white rounded-full flex items-center justify-center text-sm font-bold"
                              style={{
                                color:
                                  pi.performanceScore >= 70
                                    ? "#10b981"
                                    : pi.performanceScore >= 50
                                      ? "#f59e0b"
                                      : "#f43f5e",
                              }}
                            >
                              {Math.round(pi.performanceScore)}%
                            </div>
                          </div>
                        </div>
                      ) : isInProgress ? (
                        <span className="text-sm text-blue-500 font-medium flex items-center gap-1.5">
                          <Loader2 size={14} className="animate-spin" />
                          In Progress
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="p-3.5">
                      <div className="flex items-center justify-center gap-2">
                        {/* Interview Report */}
                        <div className="relative group/tooltip">
                          <button
                            onClick={() =>
                              isCompleted &&
                              navigate(
                                `/mockmate/admin/proctored-report/${pi._id}`,
                              )
                            }
                            disabled={!isCompleted}
                            className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all ${isCompleted ? "text-blue-600 hover:bg-blue-50 hover:shadow-sm" : "text-slate-300 cursor-not-allowed"}`}
                          >
                            <AwardIcon size={20} />
                            <span className="text-[10px] font-semibold leading-tight">
                              Report
                            </span>
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none shadow-lg">
                            {isCompleted
                              ? "View Interview Report"
                              : "Report unavailable"}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                          </div>
                        </div>
                        {/* View Resume */}
                        <div className="relative group/tooltip">
                          <button
                            onClick={() =>
                              hasResume && handleOpenResume(pi._id)
                            }
                            disabled={!hasResume}
                            className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all ${hasResume ? "text-violet-600 hover:bg-violet-50 hover:shadow-sm" : "text-slate-300 cursor-not-allowed"}`}
                          >
                            <FileText size={20} />
                            <span className="text-[10px] font-semibold leading-tight">
                              Resume
                            </span>
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none shadow-lg">
                            {hasResume ? "View Resume" : "Resume unavailable"}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                          </div>
                        </div>
                        {/* Watch Recording */}
                        <div className="relative group/tooltip">
                          <button
                            onClick={() =>
                              hasAnyRecording &&
                              setVideoModal({ open: true, interview: pi })
                            }
                            disabled={!hasAnyRecording}
                            className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all ${hasAnyRecording ? "text-orange-600 hover:bg-orange-50 hover:shadow-sm" : "text-slate-300 cursor-not-allowed"}`}
                          >
                            <Video size={20} />
                            <span className="text-[10px] font-semibold leading-tight">
                              Watch
                            </span>
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none shadow-lg">
                            {hasAnyRecording
                              ? "Watch Recording"
                              : "Recording unavailable"}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Trust Score */}
                    <td className="p-3.5">
                      {pi.trustScore != null && pi.trustScore > 0 ? (
                        <span
                          className={`text-sm font-bold ${pi.trustScore >= 80 ? "text-emerald-600" : pi.trustScore >= 50 ? "text-amber-600" : "text-red-600"}`}
                        >
                          {Math.round(pi.trustScore)}%
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    {/* Start / End */}
                    <td className="p-3.5">
                      <div className="text-xs text-slate-600 space-y-0.5">
                        {pi.interviewStartTime ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className="text-emerald-400" />
                              {new Date(
                                pi.interviewStartTime,
                              ).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            {pi.interviewEndTime && (
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-red-400" />
                                {new Date(
                                  pi.interviewEndTime,
                                ).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {proctoredTotalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Page {proctoredPage} of {proctoredTotalPages} ({proctoredTotal}{" "}
            total)
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={proctoredPage <= 1}
              onClick={() => setProctoredPage(1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={proctoredPage <= 1}
              onClick={() => setProctoredPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            {(() => {
              let start = Math.max(1, proctoredPage - 2);
              const end = Math.min(proctoredTotalPages, start + 4);
              start = Math.max(1, end - 4);
              return Array.from(
                { length: end - start + 1 },
                (_, i) => start + i,
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => setProctoredPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${p === proctoredPage ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {p}
                </button>
              ));
            })()}
            <button
              disabled={proctoredPage >= proctoredTotalPages}
              onClick={() =>
                setProctoredPage((p) => Math.min(proctoredTotalPages, p + 1))
              }
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={proctoredPage >= proctoredTotalPages}
              onClick={() => setProctoredPage(proctoredTotalPages)}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProctoredInterviewsTable;
