import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, SearchX, RefreshCw } from "lucide-react";
import { useJobs } from "../../hooks/useJobs";
import JobCard from "./JobCard";
import JobSearchAndFilters from "./JobSearchAndFilters";
import JobDetailView from "./JobDetailView";
import ApplicationFlowModal from "./ApplicationFlowModal";
import ApplicationConfigButton from "./ApplicationConfigButton";
import { BackToDashboardButton } from "../ui/BackToDashboardButton";
import VerifiedBadgeIcon from "../ui/VerifiedBadgeIcon";

/**
 * JobOpeningsPage — Redesigned main job listings page for Mockmate AI.
 *
 * Features:
 * - Hero banner with gradient (inspired by design mockups)
 * - Theme-aware colors (light/dark)
 * - Debounced search
 * - Comprehensive filter panel
 * - 2-column grid card layout
 * - Infinite scroll via IntersectionObserver
 * - Job detail slide-in drawer
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
    hasActiveFilters,
    sort,
    setSort,
    loadMore,
    refresh,
  } = useJobs();

  // Infinite scroll sentinel
  const sentinelRef = useRef(null);

  // Job detail drawer state
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Application flow modal state
  const [applyJob, setApplyJob] = useState(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

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

  const handleViewJob = (job) => {
    setSelectedJobId(job._id);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setTimeout(() => setSelectedJobId(null), 300);
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Back Button */}
      <div style={{ marginBottom: "20px" }}>
        <BackToDashboardButton />
      </div>

      {/* Verified Hiring Premium Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: "20px 24px",
          borderRadius: "16px",
          background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          boxShadow: "0 8px 32px rgba(245, 158, 11, 0.05), inset 0 0 20px rgba(255, 255, 255, 0.05)",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Shimmer Overlay */}
        <motion.div
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
          style={{
            position: "absolute",
            top: 0,
            left: "-50%",
            width: "50%",
            height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.4), transparent)",
            transform: "skewX(-20deg)",
            pointerEvents: "none",
          }}
        />
        
        {/* Glow behind icon */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "40px",
          transform: "translate(-50%, -50%)",
          width: "70px",
          height: "70px",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(249, 115, 22, 0.2))",
          filter: "blur(20px)",
          borderRadius: "50%",
          pointerEvents: "none",
        }} />

        <div style={{ 
          padding: "16px", 
          borderRadius: "20px", 
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(249, 115, 22, 0.15))", 
          border: "1px solid rgba(99, 102, 241, 0.3)",
          boxShadow: "0 4px 16px rgba(99, 102, 241, 0.2)",
          position: "relative",
          zIndex: 1,
        }}>
          <VerifiedBadgeIcon size={38} />
        </div>
        
        <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--text-primary)" }}>
              Zinterview Verified Hiring
            </h3>
            <span style={{
              padding: "2px 8px",
              borderRadius: "10px",
              background: "rgba(245, 158, 11, 0.15)",
              color: "#F59E0B",
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Priority Review
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Jobs with the <strong style={{ color: "#F59E0B", fontWeight: 700 }}>Verified</strong> badge connect you directly to authentic opportunities. Applying to these roles fast-tracks your profile.
          </p>
        </div>
      </motion.div>

      {/* Application Profile Config Button */}
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: "12px",
      }}>
        <ApplicationConfigButton />
      </div>

      {/* Search & Filters */}
      <JobSearchAndFilters
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={updateFilter}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        sort={sort}
        onSortChange={setSort}
        totalJobs={jobs.length}
      />

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: "16px 20px",
            borderRadius: "14px",
            background: "var(--error-bg)",
            border: "1px solid var(--error)",
            color: "var(--error)",
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
              color: "inherit",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 600,
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
            <Loader2 size={28} color="var(--accent-text)" />
          </motion.div>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: 0 }}>
            Loading job openings...
          </p>
        </div>
      )}

      {/* Job grid — 2-column layout */}
      {!initialLoading && (
        <>
          <AnimatePresence mode="popLayout">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: "16px",
              }}
            >
              {jobs.map((job, index) => (
                <JobCard
                  key={job._id}
                  job={job}
                  index={index}
                  onView={handleViewJob}
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
                  width: "60px",
                  height: "60px",
                  borderRadius: "16px",
                  background: "var(--hover-overlay-medium)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "4px",
                }}
              >
                <SearchX size={26} color="var(--text-muted)" />
              </div>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "16px",
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                No job openings found
              </p>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  margin: 0,
                }}
              >
                Try adjusting your search or filters
              </p>
              {hasActiveFilters && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={clearFilters}
                  style={{
                    marginTop: "8px",
                    padding: "10px 24px",
                    borderRadius: "12px",
                    background: "var(--accent-bg)",
                    border: "1px solid var(--accent-bg-hover)",
                    color: "var(--accent-text)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
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
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 size={20} color="var(--accent-text)" />
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
                color: "var(--text-muted)",
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

      {/* Job Detail Drawer */}
      <JobDetailView
        jobId={selectedJobId}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        onApply={(job) => {
          setApplyJob(job);
          setIsApplyModalOpen(true);
          handleCloseDetail();
        }}
      />

      {/* Application Flow Modal */}
      <ApplicationFlowModal
        job={applyJob}
        isOpen={isApplyModalOpen}
        onClose={() => {
          setIsApplyModalOpen(false);
          setApplyJob(null);
        }}
        onSuccess={() => {
          setIsApplyModalOpen(false);
          setApplyJob(null);
          refresh();
        }}
      />
    </div>
  );
}
