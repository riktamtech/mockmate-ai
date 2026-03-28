import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Video,
  Loader2,
  AlertCircle,
  User,
  Briefcase,
  Calendar,
} from "lucide-react";
import { api } from "../../../services/api";
import CombinedVideoPlayer from "./CombinedVideoPlayer";
import { getFullName, getRole, formatDurationHMS } from "../adminHelpers";

/**
 * VideoPlayerModal — A premium modal wrapper for the CombinedVideoPlayer.
 *
 * Props:
 *   - open: boolean — whether modal is visible
 *   - onClose: () => void — close callback
 *   - interview: object — the proctored interview record (pi)
 */
const VideoPlayerModal = ({ open, onClose, interview }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordingData, setRecordingData] = useState(null);
  const [resolvedDuration, setResolvedDuration] = useState(0);

  // Fetch recording URLs when modal opens
  useEffect(() => {
    if (!open || !interview?._id) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setRecordingData(null);
    setResolvedDuration(0);

    api
      .getAdminProctoredRecordingUrls(interview._id)
      .then((data) => {
        if (cancelled) return;
        if (data.type === "none") {
          setError("No recordings found for this interview.");
        } else {
          setRecordingData(data);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to load recording URLs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, interview?._id]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Handle duration resolved from video player
  const handleDurationResolved = useCallback((seconds) => {
    setResolvedDuration(seconds);
  }, []);

  if (!open) return null;

  const name = interview ? getFullName(interview) : "";
  const role = interview ? getRole(interview) : "";
  const date = interview?.schedule
    ? new Date(interview.schedule).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : interview?.createdAt
      ? new Date(interview.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

  // Type label
  const typeLabel =
    recordingData?.type === "combined"
      ? "Combined (Bot + Chime)"
      : recordingData?.type === "bot"
        ? "Bot Recording"
        : recordingData?.type === "chime"
          ? "Chime Recording"
          : "";

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden border border-slate-700/50"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 backdrop-blur rounded-xl">
              <Video size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">
                Interview Recording
              </h3>
              <div className="flex items-center gap-4 text-white/70 text-xs mt-0.5">
                {name && (
                  <span className="flex items-center gap-1">
                    <User size={11} /> {name}
                  </span>
                )}
                {role && role !== "—" && (
                  <span className="flex items-center gap-1">
                    <Briefcase size={11} /> {role}
                  </span>
                )}
                {date && (
                  <span className="flex items-center gap-1">
                    <Calendar size={11} /> {date}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Duration & type badges */}
            {recordingData && (
              <div className="flex items-center gap-2">
                {typeLabel && (
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white/80 text-xs font-medium backdrop-blur">
                    {typeLabel}
                  </span>
                )}
                {resolvedDuration > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white/80 text-xs font-mono font-medium backdrop-blur">
                    {formatDurationHMS(resolvedDuration)}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all backdrop-blur ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative flex items-center justify-center p-4 bg-slate-900">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={36} className="text-violet-400 animate-spin" />
              <p className="text-sm text-slate-400 font-medium">
                Resolving recording URLs...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle size={48} className="text-slate-500" />
              <p className="text-slate-400 font-medium">{error}</p>
            </div>
          ) : recordingData ? (
            <div className="w-full max-w-4xl mx-auto">
              <CombinedVideoPlayer
                botUrl={recordingData.botUrl}
                chimeUrl={recordingData.chimeUrl}
                type={recordingData.type}
                onDurationResolved={handleDurationResolved}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default VideoPlayerModal;
