import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  Building2,
  Briefcase,
  Filter,
  RotateCcw,
} from "lucide-react";
import { jobService } from "../../services/jobService";
import {
  QUICK_FILTER_PILLS,
  JOB_TYPES,
  EXPERIENCE_SLIDER_CONFIG,
} from "../../constants/jobConstants";

/**
 * JobSearchAndFilters — Enhanced theme-aware search + filters.
 * Features: search bar, quick filter pills, collapsible advanced panel
 * with experience range slider, org dropdown, location cascading dropdown,
 * job type filter, and status filters.
 */

// ── Custom dual-range slider ─────────────────────────────────
function ExperienceRangeSlider({ minVal, maxVal, singleVal, onChange }) {
  const { min, max } = EXPERIENCE_SLIDER_CONFIG;
  const [useSingle, setUseSingle] = useState(singleVal !== "");
  const trackRef = useRef(null);

  const currentMin = minVal !== "" ? Number(minVal) : min;
  const currentMax = maxVal !== "" ? Number(maxVal) : max;
  const currentSingle = singleVal !== "" ? Number(singleVal) : "";

  const getPercent = (val) => ((val - min) / (max - min)) * 100;

  const handleToggleMode = () => {
    const newUseSingle = !useSingle;
    setUseSingle(newUseSingle);
    if (newUseSingle) {
      onChange({ singleExp: "", minExp: "", maxExp: "" });
    } else {
      onChange({ singleExp: "", minExp: "", maxExp: "" });
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Experience (years)
        </label>
        <button
          onClick={handleToggleMode}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent-text)",
            fontSize: "11px",
            cursor: "pointer",
            fontWeight: 500,
            textDecoration: "underline",
            padding: 0,
          }}
        >
          {useSingle ? "Use range" : "Use single value"}
        </button>
      </div>

      {useSingle ? (
        /* ── Single value mode ── */
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <input
            type="number"
            placeholder="e.g. 5"
            value={currentSingle}
            min={min}
            max={max}
            onChange={(e) => onChange({ singleExp: e.target.value, minExp: "", maxExp: "" })}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none",
              textAlign: "center",
            }}
          />
          <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            years — shows overlapping
          </span>
        </div>
      ) : (
        /* ── Range mode ── */
        <div>
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", display: "block" }}>Min</span>
              <input
                type="number"
                value={currentMin}
                min={min}
                max={currentMax}
                onChange={(e) => {
                  const v = Math.min(Number(e.target.value), currentMax);
                  onChange({ minExp: String(v), maxExp: String(currentMax), singleExp: "" });
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  outline: "none",
                  textAlign: "center",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", display: "block" }}>Max</span>
              <input
                type="number"
                value={currentMax}
                min={currentMin}
                max={max}
                onChange={(e) => {
                  const v = Math.max(Number(e.target.value), currentMin);
                  onChange({ minExp: String(currentMin), maxExp: String(v), singleExp: "" });
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  outline: "none",
                  textAlign: "center",
                }}
              />
            </div>
          </div>

          {/* Dual range slider */}
          <div style={{ position: "relative", height: "36px", padding: "0 6px" }} ref={trackRef}>
            {/* Track background */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "6px",
              right: "6px",
              height: "6px",
              borderRadius: "3px",
              background: "var(--bg-inset)",
              transform: "translateY(-50%)",
            }} />
            {/* Active range */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: `calc(6px + ${getPercent(currentMin)}% * (100% - 12px) / 100)`,
              width: `${getPercent(currentMax) - getPercent(currentMin)}%`,
              height: "6px",
              borderRadius: "3px",
              background: "var(--accent-gradient)",
              transform: "translateY(-50%)",
              maxWidth: "calc(100% - 12px)",
            }} />
            {/* Min thumb */}
            <input
              type="range"
              min={min}
              max={max}
              value={currentMin}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), currentMax - 1);
                onChange({ minExp: String(v), maxExp: String(currentMax), singleExp: "" });
              }}
              className="job-range-slider"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", appearance: "none", background: "transparent", zIndex: 3 }}
            />
            {/* Max thumb */}
            <input
              type="range"
              min={min}
              max={max}
              value={currentMax}
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), currentMin + 1);
                onChange({ minExp: String(currentMin), maxExp: String(v), singleExp: "" });
              }}
              className="job-range-slider"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", appearance: "none", background: "transparent", zIndex: 4 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", padding: "0 6px" }}>
            <span>{min} yrs</span>
            <span>{max} yrs</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Searchable Dropdown ──────────────────────────────────────
function SearchableDropdown({ label, options, value, onChange, placeholder, icon: Icon, loading: isLoading }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          borderRadius: "10px",
          border: isOpen ? "1px solid var(--accent)" : "1px solid var(--border)",
          background: "var(--bg-surface)",
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
      >
        {Icon && <Icon size={14} color="var(--text-muted)" />}
        <span style={{ flex: 1, fontSize: "13px", color: value ? "var(--text-primary)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || placeholder}
        </span>
        {value && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(""); setSearchTerm(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}
          >
            <X size={12} />
          </button>
        )}
        <ChevronDown size={12} color="var(--text-muted)" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              boxShadow: "var(--shadow-lg)",
              zIndex: 50,
              overflow: "hidden",
              maxHeight: "240px",
            }}
          >
            <div style={{ padding: "8px" }}>
              <input
                autoFocus
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-inset)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ maxHeight: "180px", overflowY: "auto", padding: "0 4px 4px" }}>
              {isLoading ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>No results</div>
              ) : (
                filtered.map((opt) => (
                  <div
                    key={opt}
                    onClick={() => { onChange(opt); setIsOpen(false); setSearchTerm(""); }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "13px",
                      color: opt === value ? "var(--accent-text)" : "var(--text-primary)",
                      background: opt === value ? "var(--accent-bg)" : "transparent",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { if (opt !== value) e.target.style.background = "var(--hover-overlay-medium)"; }}
                    onMouseLeave={(e) => { if (opt !== value) e.target.style.background = "transparent"; }}
                  >
                    {opt}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Location Cascading Dropdown ──────────────────────────────
function LocationFilter({ value, onChange }) {
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("IN");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [loading, setLoading] = useState({ countries: false, states: false, cities: false });

  // Load countries on mount
  useEffect(() => {
    setLoading((p) => ({ ...p, countries: true }));
    jobService.getCountries().then((res) => {
      if (res.success) setCountries(res.data);
    }).catch(() => {}).finally(() => setLoading((p) => ({ ...p, countries: false })));
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (!selectedCountry) { setStates([]); return; }
    setLoading((p) => ({ ...p, states: true }));
    setSelectedState("");
    setSelectedCity("");
    setCities([]);
    jobService.getStates(selectedCountry).then((res) => {
      if (res.success) setStates(res.data);
    }).catch(() => {}).finally(() => setLoading((p) => ({ ...p, states: false })));
  }, [selectedCountry]);

  // Load cities when state changes
  useEffect(() => {
    if (!selectedState || !selectedCountry) { setCities([]); return; }
    setLoading((p) => ({ ...p, cities: true }));
    setSelectedCity("");
    jobService.getCities(selectedCountry, selectedState).then((res) => {
      if (res.success) setCities(res.data);
    }).catch(() => {}).finally(() => setLoading((p) => ({ ...p, cities: false })));
  }, [selectedState, selectedCountry]);

  // Update the parent filter value
  useEffect(() => {
    const parts = [];
    if (selectedCity) {
      const cityObj = cities.find((c) => c.name === selectedCity);
      if (cityObj) parts.push(cityObj.name);
    }
    if (selectedState) {
      const stateObj = states.find((s) => s.isoCode === selectedState);
      if (stateObj) parts.push(stateObj.name);
    }
    if (selectedCountry && selectedCountry !== "IN") {
      const countryObj = countries.find((c) => c.isoCode === selectedCountry);
      if (countryObj) parts.push(countryObj.name);
    }
    // Build location string for filtering
    if (selectedCity) {
      onChange(selectedCity);
    } else if (selectedState) {
      const stateObj = states.find((s) => s.isoCode === selectedState);
      onChange(stateObj?.name || "");
    } else {
      onChange("");
    }
  }, [selectedCity, selectedState, selectedCountry]);

  const selectStyle = {
    width: "100%",
    padding: "9px 10px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    fontSize: "12px",
    outline: "none",
    appearance: "none",
    cursor: "pointer",
  };

  return (
    <div>
      <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        <MapPin size={11} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
        Location
      </label>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {/* Country */}
        <div style={{ flex: "1 1 100px", position: "relative" }}>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            style={selectStyle}
          >
            <option value="">Country</option>
            {countries.map((c) => (
              <option key={c.isoCode} value={c.isoCode}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <ChevronDown size={10} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }} />
        </div>

        {/* State */}
        <div style={{ flex: "1 1 100px", position: "relative" }}>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            disabled={!selectedCountry || states.length === 0}
            style={{ ...selectStyle, opacity: !selectedCountry ? 0.5 : 1 }}
          >
            <option value="">State</option>
            {states.map((s) => (
              <option key={s.isoCode} value={s.isoCode}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown size={10} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }} />
        </div>

        {/* City */}
        <div style={{ flex: "1 1 100px", position: "relative" }}>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            disabled={!selectedState || cities.length === 0}
            style={{ ...selectStyle, opacity: !selectedState ? 0.5 : 1 }}
          >
            <option value="">City</option>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown size={10} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }} />
        </div>
      </div>
      {value && (
        <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "11px", color: "var(--accent-text)", background: "var(--accent-bg)", padding: "2px 8px", borderRadius: "6px" }}>
            {value}
          </span>
          <button
            onClick={() => { setSelectedCountry("IN"); setSelectedState(""); setSelectedCity(""); onChange(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px", display: "flex" }}
          >
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function JobSearchAndFilters({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  sort,
  onSortChange,
  totalJobs,
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [organisations, setOrganisations] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState("all");

  // Load temp organisations on mount
  useEffect(() => {
    setOrgLoading(true);
    jobService.getOrganisations().then((res) => {
      if (res.success) setOrganisations(res.data);
    }).catch(() => {}).finally(() => setOrgLoading(false));
  }, []);

  // Sync quick filter with global clear
  useEffect(() => {
    if (!hasActiveFilters && !search) {
      setActiveQuickFilter("all");
    }
  }, [hasActiveFilters, search]);

  const handleQuickFilter = (pill) => {
    setActiveQuickFilter(pill.key);
    if (pill.key === "all") {
      onClearFilters();
    } else {
      // Clear other status filters first
      const statusKeys = ["applied", "needsInterview", "interviewInProgress", "interviewCompleted"];
      statusKeys.forEach((k) => {
        if (k !== pill.filterKey) onFilterChange(k, "");
      });
      onFilterChange(pill.filterKey, pill.filterValue);
    }
  };

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* ── Search bar row ── */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
        {/* Main search */}
        <div style={{ flex: "1 1 300px", position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search jobs by title, company, skills..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              padding: "13px 38px 13px 42px",
              borderRadius: "14px",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-surface)",
              backdropFilter: "blur(8px)",
              color: "var(--text-primary)",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent)";
              e.target.style.boxShadow = "0 0 0 3px var(--accent-bg)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-subtle)";
              e.target.style.boxShadow = "none";
            }}
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px", display: "flex" }}
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
            padding: "13px 18px",
            borderRadius: "14px",
            border: hasActiveFilters ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
            background: hasActiveFilters ? "var(--accent-bg)" : "var(--bg-surface)",
            color: hasActiveFilters ? "var(--accent-text)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
        >
          <SlidersHorizontal size={14} />
          Filters
          {hasActiveFilters && (
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--accent)" }} />
          )}
          {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </motion.button>

        {/* Sort */}
        <div style={{ position: "relative" }}>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            style={{
              appearance: "none",
              padding: "13px 34px 13px 14px",
              borderRadius: "14px",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>
      </div>

      {/* ── Quick filter pills row ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        {QUICK_FILTER_PILLS.map((pill) => (
          <motion.button
            key={pill.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleQuickFilter(pill)}
            style={{
              padding: "7px 16px",
              borderRadius: "20px",
              border: activeQuickFilter === pill.key ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
              background: activeQuickFilter === pill.key ? "var(--accent-gradient)" : "var(--bg-surface)",
              color: activeQuickFilter === pill.key ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {pill.label}
          </motion.button>
        ))}

        {/* Results count */}
        {totalJobs !== undefined && (
          <span style={{ marginLeft: "auto", fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }}>
            <strong style={{ color: "var(--text-primary)" }}>{totalJobs}</strong> jobs found
          </span>
        )}
      </div>

      {/* ── Expandable advanced filters panel ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ overflow: "hidden", marginBottom: "16px" }}
          >
            <div
              style={{
                borderRadius: "16px",
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-surface)",
                padding: "20px 24px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Filters header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Filter size={14} color="var(--accent-text)" />
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Advanced Filters</span>
                </div>
                {hasActiveFilters && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onClearFilters}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--error)",
                      background: "var(--error-bg)",
                      color: "var(--error)",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    <RotateCcw size={10} />
                    Reset all
                  </motion.button>
                )}
              </div>

              {/* Filters grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
                {/* Experience */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <ExperienceRangeSlider
                    minVal={filters.minExp}
                    maxVal={filters.maxExp}
                    singleVal={filters.singleExp}
                    onChange={({ minExp, maxExp, singleExp }) => {
                      onFilterChange("minExp", minExp);
                      onFilterChange("maxExp", maxExp);
                      onFilterChange("singleExp", singleExp);
                    }}
                  />
                </div>

                {/* Organisation */}
                <SearchableDropdown
                  label="Organisation"
                  icon={Building2}
                  options={organisations}
                  value={filters.organisation}
                  onChange={(val) => onFilterChange("organisation", val)}
                  placeholder="All companies"
                  loading={orgLoading}
                />

                {/* Job Type */}
                <SearchableDropdown
                  label="Job Type"
                  icon={Briefcase}
                  options={JOB_TYPES}
                  value={filters.jobType}
                  onChange={(val) => onFilterChange("jobType", val)}
                  placeholder="All types"
                />

                {/* Location */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <LocationFilter
                    value={filters.location}
                    onChange={(val) => onFilterChange("location", val)}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
