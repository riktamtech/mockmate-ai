import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
} from "lucide-react";
import { EXPERIENCE_LEVELS } from "../../constants/jobConstants";

/**
 * JobSearchAndFilters — Search bar + multi-select filters for jobs.
 *
 * Debounced search handled by parent (useJobs hook).
 * Collapsible filter sidebar for mobile.
 */

export default function JobSearchAndFilters({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onClearFilters,
  sort,
  onSortChange,
}) {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    filters.experience || filters.location || filters.organisation;

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Search bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            flex: 1,
            position: "relative",
          }}
        >
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(255, 255, 255, 0.35)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search by role, skill, or company..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 40px 12px 40px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(30, 30, 45, 0.5)",
              backdropFilter: "blur(8px)",
              color: "#f1f1f4",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "rgba(139, 92, 246, 0.4)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "rgba(255, 255, 255, 0.08)")
            }
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255, 255, 255, 0.4)",
                padding: "4px",
                display: "flex",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "12px 16px",
            borderRadius: "12px",
            border: hasActiveFilters
              ? "1px solid rgba(139, 92, 246, 0.4)"
              : "1px solid rgba(255, 255, 255, 0.08)",
            background: hasActiveFilters
              ? "rgba(139, 92, 246, 0.12)"
              : "rgba(30, 30, 45, 0.5)",
            color: hasActiveFilters
              ? "rgba(167, 139, 250, 1)"
              : "rgba(255, 255, 255, 0.5)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          <SlidersHorizontal size={14} />
          Filters
          {hasActiveFilters && (
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#8B5CF6",
              }}
            />
          )}
        </motion.button>

        {/* Sort */}
        <div style={{ position: "relative" }}>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            style={{
              appearance: "none",
              padding: "12px 32px 12px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(30, 30, 45, 0.5)",
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "13px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <ChevronDown
            size={12}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(255, 255, 255, 0.3)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* Expandable filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              overflow: "hidden",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              background: "rgba(30, 30, 45, 0.4)",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              {/* Experience */}
              <div style={{ flex: "1 1 180px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    color: "rgba(255, 255, 255, 0.4)",
                    fontWeight: 500,
                  }}
                >
                  Experience
                </label>
                <select
                  value={filters.experience}
                  onChange={(e) =>
                    onFilterChange("experience", e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(20, 20, 35, 0.6)",
                    color: "#f1f1f4",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  <option value="">All levels</option>
                  {EXPERIENCE_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div style={{ flex: "1 1 180px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    color: "rgba(255, 255, 255, 0.4)",
                    fontWeight: 500,
                  }}
                >
                  Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Remote, Bangalore"
                  value={filters.location}
                  onChange={(e) =>
                    onFilterChange("location", e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(20, 20, 35, 0.6)",
                    color: "#f1f1f4",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Organisation */}
              <div style={{ flex: "1 1 180px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    color: "rgba(255, 255, 255, 0.4)",
                    fontWeight: 500,
                  }}
                >
                  Company
                </label>
                <input
                  type="text"
                  placeholder="Company name"
                  value={filters.organisation}
                  onChange={(e) =>
                    onFilterChange("organisation", e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(20, 20, 35, 0.6)",
                    color: "#f1f1f4",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Clear button */}
              {hasActiveFilters && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onClearFilters}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    background: "rgba(239, 68, 68, 0.08)",
                    color: "rgba(239, 68, 68, 0.8)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  Clear all
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
