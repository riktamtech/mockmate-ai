import React, { useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Loader2, SearchX, RefreshCw } from "lucide-react";
import { useJobs } from "../../hooks/useJobs";
import JobCard from "./JobCard";
import JobSearchAndFilters from "./JobSearchAndFilters";

/**
 * JobOpeningsPage — Main job listings page for Mockmate AI.
 *
 * Features:
 * - Debounced search
 * - Collapsible filter panel
 * - Infinite scroll via IntersectionObserver
 * - Animated entrance transitions
 * - Empty/loading/error states
 */

export default function JobOpeningsPage() {
  const {
    jobs,
    loading,
    initialLoading,
    hasMore,
    error,
    search,
    setSearch,
    filters,
    updateFilter,
    clearFilters,
    sort,
    setSort,
    loadMore,
    refresh,
  } = useJobs();

  // Infinite scroll sentinel
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "32px 24px",
      }}
    >
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "28px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background:
                "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.15))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Briefcase size={20} color="#8B5CF6" />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 700,
                color: "#f1f1f4",
                lineHeight: 1.2,
              }}
            >
              Active Job Openings
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "rgba(255, 255, 255, 0.4)",
              }}
            >
              Explore verified hiring opportunities from top companies
            </p>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <JobSearchAndFilters
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={updateFilter}
        onClearFilters={clearFilters}
        sort={sort}
        onSortChange={setSort}
      />

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: "16px 20px",
            borderRadius: "12px",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "rgba(239, 68, 68, 0.8)",
            fontSize: "13px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button
            onClick={refresh}
            style={{
              background: "none",
              border: "none",
              color: "rgba(239, 68, 68, 0.8)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
            }}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </motion.div>
      )}

      {/* Initial loading */}
      {initialLoading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "60px 20px",
            gap: "16px",
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 size={28} color="rgba(139, 92, 246, 0.6)" />
          </motion.div>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.4)",
              fontSize: "14px",
              margin: 0,
            }}
          >
            Loading job openings...
          </p>
        </div>
      )}

      {/* Job list */}
      {!initialLoading && (
        <>
          <AnimatePresence mode="popLayout">
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {jobs.map((job, index) => (
                <JobCard
                  key={job._id}
                  job={job}
                  index={index}
                  onView={() => {
                    // TODO: Open job detail view/drawer
                    console.log("View job:", job._id);
                  }}
                />
              ))}
            </div>
          </AnimatePresence>

          {/* Empty state */}
          {jobs.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "60px 20px",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "rgba(255, 255, 255, 0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "4px",
                }}
              >
                <SearchX size={24} color="rgba(255, 255, 255, 0.2)" />
              </div>
              <p
                style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  fontSize: "15px",
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                No job openings found
              </p>
              <p
                style={{
                  color: "rgba(255, 255, 255, 0.3)",
                  fontSize: "13px",
                  margin: 0,
                }}
              >
                Try adjusting your search or filters
              </p>
              {(search ||
                filters.experience ||
                filters.location ||
                filters.organisation) && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={clearFilters}
                  style={{
                    marginTop: "8px",
                    padding: "8px 20px",
                    borderRadius: "10px",
                    background: "rgba(139, 92, 246, 0.15)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    color: "rgba(167, 139, 250, 1)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  Clear filters
                </motion.button>
              )}
            </motion.div>
          )}

          {/* Loading more indicator */}
          {loading && jobs.length > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "24px",
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <Loader2 size={20} color="rgba(139, 92, 246, 0.5)" />
              </motion.div>
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {hasMore && <div ref={sentinelRef} style={{ height: "1px" }} />}

          {/* End of list */}
          {!hasMore && jobs.length > 0 && (
            <p
              style={{
                textAlign: "center",
                color: "rgba(255, 255, 255, 0.25)",
                fontSize: "12px",
                padding: "24px",
                margin: 0,
              }}
            >
              You've reached the end of the list
            </p>
          )}
        </>
      )}
    </div>
  );
}
