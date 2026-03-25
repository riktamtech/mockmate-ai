import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Rocket,
  Briefcase,
  Globe,
  Zap,
  Target,
  TrendingUp,
  Star,
  Search,
} from "lucide-react";

const MARKETING_LINES = [
  {
    icon: Rocket,
    text: "Discover & Apply to Jobs Instantly",
    sub: "AI-powered matching finds your perfect role in seconds",
  },
  {
    icon: Target,
    text: "Smart Matching. Instant Applications.",
    sub: "Get matched to roles that fit your skills and experience",
  },
  {
    icon: TrendingUp,
    text: "Land Your Dream Job Faster",
    sub: "Our AI analyzes your profile to surface top opportunities",
  },
  {
    icon: Globe,
    text: "Access Jobs from 400+ Hiring Companies",
    sub: "Top employers are actively looking for talent like you",
  },
  {
    icon: Zap,
    text: "One-Click Apply with AI-Optimized Profiles",
    sub: "Stand out with smart applications tailored to each role",
  },
  {
    icon: Star,
    text: "Get Noticed by Recruiters Worldwide",
    sub: "Your verified interview scores boost your visibility",
  },
  {
    icon: Search,
    text: "Explore Curated Openings Just for You",
    sub: "Filter by role, location, experience, and more",
  },
  {
    icon: Briefcase,
    text: "Track Applications in Real-Time",
    sub: "Stay on top of every opportunity from apply to offer",
  },
];

/**
 * JobPortalBanner — Eye-catching animated banner promoting job discovery.
 * Inspired by ProctoredInterviewBanner with sliding/fading marketing lines.
 *
 * Place this on the Dashboard or any non-job-listing page.
 * The CTA navigates to /mockmate/candidate/jobs.
 */
export const JobPortalBanner = React.memo(({ className = "" }) => {
  const navigate = useNavigate();
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setLineIdx((prev) => (prev + 1) % MARKETING_LINES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const current = useMemo(
    () => MARKETING_LINES[lineIdx % MARKETING_LINES.length],
    [lineIdx],
  );
  const IconComp = current.icon;

  const handleClick = () => {
    navigate("/mockmate/candidate/jobs");
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{ cursor: "default" }}
    >
      {/* ── Animated gradient background ── */}
      <div
        className="absolute inset-0 job-portal-gradient"
        style={{ opacity: 0.97 }}
      />

      {/* ── Shimmer overlay ── */}
      <div className="absolute inset-0 animate-shimmer opacity-15" />

      {/* ── Decorative orbs ── */}
      <div
        style={{
          position: "absolute",
          top: "-40px",
          right: "-30px",
          width: "180px",
          height: "180px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.07)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-50px",
          left: "25%",
          width: "140px",
          height: "140px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "-20px",
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
          pointerEvents: "none",
        }}
      />

      {/* ── Content ── */}
      <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-start gap-4 flex-1">
          {/* Animated icon */}
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl flex-shrink-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={lineIdx}
                initial={{ opacity: 0, scale: 0.6, rotate: -15 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, rotate: 15 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <IconComp size={28} className="text-white" />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="min-w-0">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-white/25 text-white rounded-full backdrop-blur-sm animate-pulse">
                🚀 AI-POWERED JOB PORTAL
              </span>
            </div>

            {/* Animated headline */}
            <AnimatePresence mode="wait">
              <motion.h3
                key={`head-${lineIdx}`}
                initial={{ opacity: 0, y: 18, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -18, filter: "blur(4px)" }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="text-lg md:text-xl font-bold text-white mb-1"
              >
                {current.text}
              </motion.h3>
            </AnimatePresence>

            {/* Animated sub-line */}
            <AnimatePresence mode="wait">
              <motion.p
                key={`sub-${lineIdx}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.08 }}
                className="text-sm text-white/80"
              >
                {current.sub}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* CTA Button */}
        <motion.button
          onClick={handleClick}
          whileHover={{ scale: 1.05, boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-all shadow-lg flex-shrink-0 group bg-white text-violet-700 hover:bg-violet-50"
          style={{
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          <Sparkles size={18} className="text-violet-500" />
          Explore Jobs
          <ArrowRight
            size={18}
            className="group-hover:translate-x-1 transition-transform"
          />
        </motion.button>
      </div>
    </div>
  );
});

JobPortalBanner.displayName = "JobPortalBanner";
