import React from "react";
import {
  Search,
  X,
  FileText,
  Eye,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const UserListTable = ({
  users,
  loading,
  searchTerm,
  setSearchTerm,
  page,
  setPage,
  totalPages,
  visiblePageStart,
  setVisiblePageStart,
  handleUserView,
  handleJobAnalytics,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="text-lg font-bold text-slate-800">Registered Users</h3>
        <div className="relative w-full sm:w-64">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm font-semibold border-b border-slate-200">
              <th className="p-4">User</th>
              <th className="p-4">Email</th>
              <th className="p-4">Interviews</th>
              <th className="p-4">Joined</th>
              <th className="p-4">Resume</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                      <div className="h-4 w-32 bg-slate-200 rounded"></div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="h-4 w-48 bg-slate-200 rounded"></div>
                  </td>
                  <td className="p-4">
                    <div className="h-6 w-12 bg-slate-200 rounded-lg"></div>
                  </td>
                  <td className="p-4">
                    <div className="h-4 w-24 bg-slate-200 rounded"></div>
                  </td>
                  <td className="p-4">
                    <div className="h-4 w-16 bg-slate-200 rounded"></div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="h-7 w-24 bg-slate-200 rounded-lg ml-auto"></div>
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user._id}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-700">
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 text-sm">{user.email}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                      {user.interviewCount}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500 text-sm">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    {user.resumeUrl ? (
                      <a
                        href={user.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm flex items-center gap-1"
                      >
                        <FileText size={14} /> View
                      </a>
                    ) : (
                      <span className="text-slate-400 text-sm italic">
                        None
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleUserView(user._id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-xs font-medium"
                      >
                        <Eye size={14} /> View History
                      </button>
                      {user.applicationCount > 0 && handleJobAnalytics && (
                        <button
                          onClick={() => handleJobAnalytics(user._id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-xs font-medium"
                        >
                          <BarChart3 size={14} /> Job Analytics
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-slate-200 flex items-center justify-between">
        <button
          disabled={page === 1}
          onClick={() => {
            const newPage = page - 1;
            setPage(newPage);
            if (newPage < visiblePageStart) {
              setVisiblePageStart(Math.max(1, newPage - 4));
            }
          }}
          className="p-2 flex items-center gap-1 text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} /> Prev
        </button>

        <div className="flex items-center gap-2">
          {/* Scroll Left 5 */}
          <button
            disabled={visiblePageStart === 1}
            onClick={() =>
              setVisiblePageStart(Math.max(1, visiblePageStart - 5))
            }
            className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous 5 pages"
          >
            <ChevronsLeft size={16} />
          </button>

          {Array.from({ length: 5 }, (_, i) => {
            const p = visiblePageStart + i;

            if (p > 0 && p <= totalPages) {
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    page === p
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              );
            }
            return null;
          })}

          {/* Scroll Right 5 */}
          <button
            disabled={visiblePageStart + 5 > totalPages}
            onClick={() =>
              setVisiblePageStart(Math.min(totalPages, visiblePageStart + 5))
            }
            className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next 5 pages"
          >
            <ChevronsRight size={16} />
          </button>
        </div>

        <button
          disabled={page === totalPages}
          onClick={() => {
            const newPage = page + 1;
            setPage(newPage);
            if (newPage >= visiblePageStart + 5) {
              setVisiblePageStart(visiblePageStart + 5);
            }
          }}
          className="p-2 flex items-center gap-1 text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default UserListTable;
