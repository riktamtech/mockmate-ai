import React from "react";
import { ChevronLeft, FileText, Loader2, MessageSquare } from "lucide-react";

const UserDetailsView = ({
  selectedUser,
  selectedUserInterviews,
  setSearchParams,
  handleViewReport,
  handleViewTranscript,
  transcriptLoadingId,
}) => {
  if (!selectedUser) return null;

  return (
    <div className="space-y-6">
      <button
        onClick={() => setSearchParams({})}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-4 transition-colors"
      >
        <ChevronLeft size={18} /> Back to Dashboard
      </button>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center text-2xl font-bold border-4 border-slate-50 shadow-sm">
              {selectedUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {selectedUser.name}
              </h2>
              <p className="text-slate-500">{selectedUser.email}</p>
            </div>
          </div>
          {selectedUser.resumeUrl && (
            <a
              href={selectedUser.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-medium"
            >
              <FileText size={18} /> Resume
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="text-slate-500 mb-1">Experience</p>
            <p className="font-medium text-slate-800">
              {selectedUser.yearsOfExperience || 0} Years
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Level</p>
            <p className="font-medium text-slate-800 capitalize">
              {selectedUser.experienceLevel || "-"}
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Current Role</p>
            <p className="font-medium text-slate-800">
              {selectedUser.currentRole || "-"}
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Target Role</p>
            <p className="font-medium text-slate-800">
              {selectedUser.targetRole || "-"}
            </p>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-900 mt-8">
        Interview History
      </h3>

      <div className="grid gap-4">
        {selectedUserInterviews.length === 0 ? (
          <p className="text-slate-500">No interviews found for this user.</p>
        ) : (
          selectedUserInterviews.map((interview) => (
            <div
              key={interview._id}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h4 className="font-bold text-lg text-slate-900">
                    {interview.role}
                  </h4>
                  <p className="text-sm text-slate-500">
                    {interview.focusArea} • {interview.level} •{" "}
                    {new Date(interview.date).toLocaleDateString()}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm text-slate-500 w-full">
                    <div>
                      <span className="block text-xs uppercase text-slate-400 font-semibold">
                        Language
                      </span>
                      {interview.language || "English"}
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-slate-400 font-semibold">
                        Duration
                      </span>
                      {interview.durationSeconds
                        ? `${Math.round(interview.durationSeconds / 60)} mins`
                        : "-"}
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-slate-400 font-semibold">
                        Questions
                      </span>
                      {interview.history
                        ? interview.history.filter((m) => m.role === "model")
                            .length
                        : 0}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide
                      ${interview.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}
                  >
                    {interview.status.replace("_", " ")}
                  </span>

                  {interview.status === "COMPLETED" && interview.feedback && (
                    <button
                      onClick={() => handleViewReport(interview.feedback)}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
                    >
                      <FileText size={16} /> View Report
                    </button>
                  )}

                  <button
                    onClick={() => handleViewTranscript(interview._id)}
                    disabled={transcriptLoadingId === interview._id}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm shadow-blue-200 disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {transcriptLoadingId === interview._id ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <MessageSquare size={16} />
                    )}
                    Transcript
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-2">
                ID: {interview._id}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserDetailsView;
