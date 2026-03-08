import React from "react";
import { Filter, ChevronDown, Calendar, X } from "lucide-react";

const ProctoredFiltersBar = ({
  filterRef,
  proctoredFilters,
  setProctoredFilters,
  setProctoredPage,
  openFilterDropdown,
  setOpenFilterDropdown,
  availableRoles,
  clearAllFilters,
  hasActiveFilters,
}) => {
  return (
    <div
      ref={filterRef}
      className="px-6 py-3.5 border-b border-slate-100 flex flex-wrap items-center gap-5 bg-slate-50/50"
    >
      <Filter size={16} className="text-slate-400" />
      <span className="text-sm font-semibold text-slate-500 mr-1">
        Filters:
      </span>

      {/* Status filter */}
      <div className="relative">
        <button
          onClick={() =>
            setOpenFilterDropdown(
              openFilterDropdown === "status" ? null : "status",
            )
          }
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all ${proctoredFilters.statuses.length > 0 ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
        >
          Status{" "}
          {proctoredFilters.statuses.length > 0 && (
            <span className="bg-blue-200 text-blue-800 px-1.5 rounded-full text-xs">
              {proctoredFilters.statuses.length}
            </span>
          )}
          <ChevronDown size={14} />
        </button>
        {openFilterDropdown === "status" && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[220px] py-2 max-h-72 overflow-y-auto">
            {[
              "CONSENT_GIVEN",
              "DETAILS_COLLECTED",
              "OPENING_CREATED",
              "CANDIDATE_ADDED",
              "SCHEDULED",
              "IN_PROGRESS",
              "COMPLETED",
              "CANCELLED",
            ].map((s) => (
              <label
                key={s}
                className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={proctoredFilters.statuses.includes(s)}
                  onChange={() => {
                    const updated = proctoredFilters.statuses.includes(s)
                      ? proctoredFilters.statuses.filter((x) => x !== s)
                      : [...proctoredFilters.statuses, s];
                    setProctoredFilters({
                      ...proctoredFilters,
                      statuses: updated,
                    });
                    setProctoredPage(1);
                  }}
                  className="rounded border-slate-300 text-blue-600 w-4 h-4"
                />
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${s === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : s === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" : s === "SCHEDULED" ? "bg-purple-100 text-purple-700" : s === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {s.replace("_", " ")}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Role filter */}
      {availableRoles.length > 0 && (
        <div className="relative">
          <button
            onClick={() =>
              setOpenFilterDropdown(
                openFilterDropdown === "role" ? null : "role",
              )
            }
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all ${proctoredFilters.roles.length > 0 ? "bg-violet-50 border-violet-200 text-violet-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
          >
            Role{" "}
            {proctoredFilters.roles.length > 0 && (
              <span className="bg-violet-200 text-violet-800 px-1.5 rounded-full text-xs">
                {proctoredFilters.roles.length}
              </span>
            )}
            <ChevronDown size={14} />
          </button>
          {openFilterDropdown === "role" && (
            <div
              className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[240px] py-2 max-h-72 overflow-y-auto mb-4"
              style={{ bottom: "auto", maxHeight: "280px" }}
            >
              {availableRoles.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={proctoredFilters.roles.includes(r)}
                    onChange={() => {
                      const updated = proctoredFilters.roles.includes(r)
                        ? proctoredFilters.roles.filter((x) => x !== r)
                        : [...proctoredFilters.roles, r];
                      setProctoredFilters({
                        ...proctoredFilters,
                        roles: updated,
                      });
                      setProctoredPage(1);
                    }}
                    className="rounded border-slate-300 text-violet-600 w-4 h-4"
                  />
                  <span className="text-slate-700">{r}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Date filter */}
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="date"
            value={proctoredFilters.date || ""}
            onChange={(e) => {
              setProctoredFilters({
                ...proctoredFilters,
                date: e.target.value || null,
              });
              setProctoredPage(1);
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${proctoredFilters.date ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-white border-slate-200 text-slate-600"}`}
          />
        </div>
      </div>

      {/* Score range filter */}
      <div className="relative">
        <button
          onClick={() =>
            setOpenFilterDropdown(
              openFilterDropdown === "score" ? null : "score",
            )
          }
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all ${proctoredFilters.minScore !== null || proctoredFilters.maxScore !== null ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
        >
          Score Range{" "}
          {(proctoredFilters.minScore !== null ||
            proctoredFilters.maxScore !== null) && (
            <span className="bg-emerald-200 text-emerald-800 px-1.5 rounded-full text-xs">
              {proctoredFilters.minScore ?? 0}-{proctoredFilters.maxScore ?? 100}
            </span>
          )}
          <ChevronDown size={14} />
        </button>
        {openFilterDropdown === "score" && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 w-80 p-5">
            <p className="text-sm font-bold text-slate-700 mb-4">
              Performance Score Range
            </p>
            {/* Slider Track */}
            <div className="mb-5">
              <div className="relative h-2 bg-slate-100 rounded-full">
                <div
                  className="absolute h-full rounded-full"
                  style={{
                    left: `${proctoredFilters.minScore ?? 0}%`,
                    right: `${100 - (proctoredFilters.maxScore ?? 100)}%`,
                    background:
                      "linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)",
                  }}
                />
                {/* Min slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={proctoredFilters.minScore ?? 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    const maxVal = proctoredFilters.maxScore ?? 100;
                    if (val <= maxVal) {
                      setProctoredFilters({
                        ...proctoredFilters,
                        minScore: val === 0 ? null : val,
                      });
                      setProctoredPage(1);
                    }
                  }}
                  className="absolute w-full h-2 top-0 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:shadow-lg [&::-webkit-slider-thumb]:hover:border-indigo-600 [&::-webkit-slider-thumb]:transition-all [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-indigo-500 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                />
                {/* Max slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={proctoredFilters.maxScore ?? 100}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    const minVal = proctoredFilters.minScore ?? 0;
                    if (val >= minVal) {
                      setProctoredFilters({
                        ...proctoredFilters,
                        maxScore: val === 100 ? null : val,
                      });
                      setProctoredPage(1);
                    }
                  }}
                  className="absolute w-full h-2 top-0 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:shadow-lg [&::-webkit-slider-thumb]:hover:border-violet-600 [&::-webkit-slider-thumb]:transition-all [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-violet-500 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                />
              </div>
              {/* Score labels below slider */}
              <div className="flex justify-between mt-2 text-xs text-slate-400">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>
            {/* Input fields */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Min Score
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={proctoredFilters.minScore ?? ""}
                  onChange={(e) => {
                    setProctoredFilters({
                      ...proctoredFilters,
                      minScore: e.target.value ? Number(e.target.value) : null,
                    });
                    setProctoredPage(1);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <span className="text-slate-300 mt-5 text-lg">—</span>
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Max Score
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={proctoredFilters.maxScore ?? ""}
                  onChange={(e) => {
                    setProctoredFilters({
                      ...proctoredFilters,
                      maxScore: e.target.value ? Number(e.target.value) : null,
                    });
                    setProctoredPage(1);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="100"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearAllFilters}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
        >
          <X size={14} /> Clear All
        </button>
      )}
    </div>
  );
};

export default ProctoredFiltersBar;
