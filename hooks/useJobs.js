import { useState, useEffect, useCallback, useRef } from "react";
import { jobService } from "../services/jobService";

/**
 * useJobs — Custom hook for job listing state management.
 *
 * Handles infinite scroll, debounced search, comprehensive filters,
 * experience range, and cursor-based pagination with AbortController cleanup.
 */

const INITIAL_FILTERS = {
  location: "",
  organisation: "",
  jobType: "",
  minExp: "",
  maxExp: "",
  singleExp: "",
  applied: "",
  needsInterview: "",
  interviewInProgress: "",
  interviewCompleted: "",
};

export function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [sort, setSort] = useState("newest");

  // Debounced search
  const searchTimeoutRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const abortControllerRef = useRef(null);
  const fetchIdRef = useRef(0);

  // Debounced location
  const locationTimeoutRef = useRef(null);
  const [debouncedLocation, setDebouncedLocation] = useState("");

  // Debounce search input (300ms)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  // Debounce location input (300ms)
  useEffect(() => {
    if (locationTimeoutRef.current) {
      clearTimeout(locationTimeoutRef.current);
    }
    locationTimeoutRef.current = setTimeout(() => {
      setDebouncedLocation(filters.location);
    }, 300);

    return () => {
      if (locationTimeoutRef.current) {
        clearTimeout(locationTimeoutRef.current);
      }
    };
  }, [filters.location]);

  // Fetch jobs
  const fetchJobs = useCallback(
    async (isLoadMore = false) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const currentFetchId = ++fetchIdRef.current;

      try {
        if (!isLoadMore) {
          setLoading(true);
        }
        setError(null);

        const response = await jobService.getJobOpenings({
          cursor: isLoadMore ? cursor : null,
          limit: 20,
          search: debouncedSearch,
          minExp: filters.minExp,
          maxExp: filters.maxExp,
          singleExp: filters.singleExp,
          location: debouncedLocation,
          organisation: filters.organisation,
          jobType: filters.jobType,
          applied: filters.applied,
          needsInterview: filters.needsInterview,
          interviewInProgress: filters.interviewInProgress,
          interviewCompleted: filters.interviewCompleted,
          sort,
        });

        // Stale check
        if (currentFetchId !== fetchIdRef.current) return;

        if (response.success) {
          const newJobs = response.data || [];
          setJobs((prev) => (isLoadMore ? [...prev, ...newJobs] : newJobs));
          setHasMore(response.meta?.hasMore || false);
          setCursor(response.meta?.nextCursor || null);
        }
      } catch (err) {
        if (currentFetchId !== fetchIdRef.current) return;
        if (err.name !== "AbortError" && err.message !== "canceled") {
          setError(err.message || "Failed to fetch jobs");
          console.error("Error fetching jobs:", err);
        }
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    },
    [cursor, debouncedSearch, debouncedLocation, filters, sort],
  );

  // Reset and refetch when search/filters/sort change
  useEffect(() => {
    setJobs([]);
    setCursor(null);
    setHasMore(true);
    fetchJobs(false);
  }, [
    debouncedSearch,
    debouncedLocation,
    filters.organisation,
    filters.jobType,
    filters.minExp,
    filters.maxExp,
    filters.singleExp,
    filters.applied,
    filters.needsInterview,
    filters.interviewInProgress,
    filters.interviewCompleted,
    sort,
  ]);

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchJobs(true);
    }
  }, [loading, hasMore, fetchJobs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (locationTimeoutRef.current) {
        clearTimeout(locationTimeoutRef.current);
      }
    };
  }, []);

  // Update a single filter
  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearch("");
    setFilters({ ...INITIAL_FILTERS });
    setSort("newest");
  }, []);

  // Check if any filter is active
  const hasActiveFilters = Object.values(filters).some((v) => v !== "") || search !== "";

  return {
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
    refresh: () => fetchJobs(false),
  };
}
