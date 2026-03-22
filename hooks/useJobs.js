import { useState, useEffect, useCallback, useRef } from "react";
import { jobService } from "../services/jobService";

/**
 * useJobs — Custom hook for job listing state management.
 *
 * Handles infinite scroll, search, filters, sort,
 * and cursor-based pagination with AbortController cleanup.
 */

export function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    experience: "",
    location: "",
    organisation: "",
  });
  const [sort, setSort] = useState("newest");

  // Debounced search
  const searchTimeoutRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const abortControllerRef = useRef(null);

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

  // Fetch jobs
  const fetchJobs = useCallback(
    async (isLoadMore = false) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        if (!isLoadMore) {
          setLoading(true);
        }
        setError(null);

        const response = await jobService.getJobOpenings({
          cursor: isLoadMore ? cursor : null,
          limit: 20,
          search: debouncedSearch,
          experience: filters.experience,
          location: filters.location,
          organisation: filters.organisation,
          sort,
        });

        if (response.success) {
          const newJobs = response.data || [];
          setJobs((prev) => (isLoadMore ? [...prev, ...newJobs] : newJobs));
          setHasMore(response.meta?.hasMore || false);
          setCursor(response.meta?.nextCursor || null);
        }
      } catch (err) {
        if (err.name !== "AbortError" && err.message !== "canceled") {
          setError(err.message || "Failed to fetch jobs");
          console.error("Error fetching jobs:", err);
        }
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [cursor, debouncedSearch, filters, sort],
  );

  // Reset and refetch when search/filters/sort change
  useEffect(() => {
    setJobs([]);
    setCursor(null);
    setHasMore(true);
    fetchJobs(false);
  }, [debouncedSearch, filters, sort]);

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
    };
  }, []);

  // Update a single filter
  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearch("");
    setFilters({ experience: "", location: "", organisation: "" });
    setSort("newest");
  }, []);

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
    sort,
    setSort,
    loadMore,
    refresh: () => fetchJobs(false),
  };
}
