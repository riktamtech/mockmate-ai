import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Pause,
  MessageSquare,
  User,
  Bot,
  Calendar,
  Clock,
  Download,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { api } from "../../services/api";
import { transcribeMultiple } from "../../services/audioTranscriptionService";
import generateTranscriptPdf from "../../utils/generateTranscriptPdf";

// ─── Service Imports ────────────────────────────────────────────────
import {
  speak,
  playUrl,
  stop,
  pause,
  resume,
  addPlaybackListener,
  getIsPlaying,
  getIsPaused,
  getLastGeneratedAudioUrl,
} from "../../services/ttsPlayer";

// ─── Component ──────────────────────────────────────────────────────
const InterviewDetailModal = ({ isOpen, onClose, interview }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Use ref for autoPlay to avoid stale closures in async callbacks
  const autoPlayRef = useRef(autoPlay);
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  // Session guard: prevents stale handlePlayAudio calls from corrupting state
  const playbackSessionRef = useRef(0);

  // Ref to prevent duplicate transcription runs
  const transcriptionRunRef = useRef(null);

  // ─── Filter history to start from first AI question ─────────────
  const visibleHistory = useMemo(() => {
    if (!interview?.history) return [];
    const firstModelIndex = interview.history.findIndex(
      (m) => m.role === "model",
    );
    if (firstModelIndex === -1) return interview.history;
    return interview.history.slice(firstModelIndex);
  }, [interview]);

  const getOriginalIndex = useCallback(
    (visibleIndex) => {
      if (!interview?.history) return visibleIndex;
      const firstModelIndex = interview.history.findIndex(
        (m) => m.role === "model",
      );
      if (firstModelIndex === -1) return visibleIndex;
      return firstModelIndex + visibleIndex;
    },
    [interview],
  );

  // ─── Parse JSON AI responses ────────────────────────────────────
  const parseMessageText = useCallback((text) => {
    try {
      if (
        typeof text === "string" &&
        (text.trim().startsWith("{") || text.trim().startsWith("["))
      ) {
        const parsed = JSON.parse(text);
        if (parsed.response) return parsed.response;
      }
    } catch {
      // Not JSON
    }
    return text;
  }, []);

  // ─── Compute question index for a user message ──────────────────
  const getQuestionIndexForMessage = useCallback(
    (originalIndex) => {
      if (!interview?.history) return null;
      let count = 0;
      for (let i = 0; i < originalIndex; i++) {
        if (interview.history[i].role === "model") count++;
      }
      // Backend uses 1-based indexing for questions (currentQuestionCount starts at 1)
      return count > 0 ? count : 1;
    },
    [interview],
  );

  // ─── Cleanup on modal close / interview change ──────────────────
  useEffect(() => {
    if (!isOpen) {
      stop();
      setIsPlaying(false);
      setIsPaused(false);
      setAutoPlay(false);
      setCurrentPlayingIndex(null);
      setIsDownloading(false);
    }
  }, [isOpen, interview]);

  // ─── Global Playback Status Listener ────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Initialize state from service immediately
    setIsPlaying(getIsPlaying());
    setIsPaused(getIsPaused());

    // Subscribe to changes
    const removeListener = addPlaybackListener((state) => {
      setIsPlaying(state.isPlaying);
      setIsPaused(state.isPaused);

      // FIX: As soon as playback starts, we are no longer loading
      if (state.isPlaying) {
        setAudioLoading(false);
      }
    });

    return () => removeListener();
  }, [isOpen]);

  // ─── Auto-transcribe on modal open ──────────────────────────────
  useEffect(() => {
    if (!isOpen || !interview?._id || !interview?.history) return;

    // Skip if we already ran or are running for this interview
    if (transcriptionRunRef.current === interview._id) return;
    transcriptionRunRef.current = interview._id;

    // Find user messages that lack valid transcriptions
    const missingHistoryIds = [];
    if (interview.history) {
      for (const msg of interview.history) {
        if (msg.role === "user") {
          // Check if this specific message lacks a valid transcription
          const isPlaceholder =
            msg.content ===
              "Please evaluate my answer and ask the next question." ||
            msg.content === "🎤 Audio Answer Submitted";

          const lacksGoodContent = !msg.content || isPlaceholder;

          if (lacksGoodContent && (msg.audioUrl || msg.audioS3Key)) {
            missingHistoryIds.push({
              historyId: msg._id,
              interactionId: msg.interactionId || null,
            });
          }
        }
      }
    }

    if (missingHistoryIds.length === 0) return;

    // Start transcription
    let cancelled = false;
    const runTranscription = async () => {
      setTranscribing(true);
      try {
        const newTranscriptions = await transcribeMultiple({
          interviewId: interview._id,
          missingItems: missingHistoryIds,
          onProgress: (histId, text) => {
            if (cancelled) return;
            // Progressive update: we don't strictly need to update local `transcriptions` map anymore,
            // but we can update the interview history locally to show it immediately.
            const msgIndex = interview.history.findIndex(
              (m) => m._id === histId,
            );
            if (msgIndex !== -1) {
              interview.history[msgIndex].content = text;
              // Trigger a basic re-render by cloning the array
              interview.history = [...interview.history];
            }
          },
        });
      } catch (err) {
        console.error("[InterviewModal] Transcription error:", err);
      } finally {
        if (!cancelled) setTranscribing(false);
      }
    };

    runTranscription();

    return () => {
      cancelled = true;
    };
  }, [isOpen, interview]);

  // ─── Play Audio Handler ─────────────────────────────────────────
  const handlePlayAudio = useCallback(
    async (index) => {
      if (!interview?.history?.[index]) return;

      // Case 1: Clicked Play/Pause on the CURRENTLY active message
      if (currentPlayingIndex === index) {
        if (getIsPaused()) {
          resume();
          return;
        }
        if (getIsPlaying()) {
          pause();
          return;
        }
      }

      // Case 2: New Message — Stop previous and start new
      stop();

      // Assign a unique session ID so stale calls can detect they've been superseded
      const sessionId = ++playbackSessionRef.current;

      setCurrentPlayingIndex(index);
      setAudioLoading(true);

      // Optimistic UI updates
      setIsPlaying(true);
      setIsPaused(false);

      const message = interview.history[index];
      const isUser = message.role === "user";

      try {
        let result = { completed: false };

        if (isUser) {
          // Play Candidate Audio (from S3)
          const questionCount = getQuestionIndexForMessage(index); // For logging
          console.log(
            `[handlePlayAudio] Candidate Play - MsgIndex: ${index}, QuestionIndex: ${questionCount}`,
          );

          // Always prefer the exact URL attached to this message by the backend
          const matchingAudio = interview.audioUrls?.[questionCount];
          const audioUrlToPlay = message.audioUrl || matchingAudio?.url;

          if (audioUrlToPlay) {
            console.log(`[handlePlayAudio] Playing URL: ${audioUrlToPlay}`);
            result = await playUrl(audioUrlToPlay);
          } else {
            console.warn(
              "No audio recording found for this answer (Msg ID:",
              message._id,
              ")",
            );

            // Fallback: generate TTS from transcript text and save to S3
            const extractedText =
              message.content ||
              (message.parts && message.parts.length > 0
                ? message.parts[0].text
                : null);
            const isPlaceholderContent =
              extractedText ===
                "Please evaluate my answer and ask the next question." ||
              extractedText === "🎤 Audio Answer Submitted";

            if (extractedText && !isPlaceholderContent) {
              try {
                console.log(
                  "[handlePlayAudio] Generating TTS fallback for user msg:",
                  message._id,
                );
                const { audioUrl: ttsUrl } = await api.generateTtsForHistory(
                  interview._id,
                  message._id,
                );

                // Session guard after async call
                if (sessionId !== playbackSessionRef.current) return;

                if (ttsUrl) {
                  message.audioUrl = ttsUrl; // Cache for instant replay
                  result = await playUrl(ttsUrl);
                }
              } catch (ttsErr) {
                console.error("[handlePlayAudio] TTS fallback failed:", ttsErr);
              }
            }
          }
        } else {
          // Play AI Audio
          if (message.audioUrl) {
            result = await playUrl(message.audioUrl);
          } else {
            // Generate/Stream TTS
            const parts =
              message.parts ||
              (message.content ? [{ text: message.content }] : []);
            const rawText = parts.map((p) => p.text).join(" ");
            const textToSpeak = parseMessageText(rawText);

            if (textToSpeak) {
              const lastModelIndex = interview.history
                .map((m) => m.role)
                .lastIndexOf("model");
              const isFinalMessage = index === lastModelIndex;
              result = await speak(
                textToSpeak,
                interview._id,
                index,
                isFinalMessage,
              );

              // Cache the generated audio URL on the message for instant replay
              const generatedUrl = getLastGeneratedAudioUrl();
              if (generatedUrl) {
                message.audioUrl = generatedUrl;
              }
            }
          }
        }

        // ── Session guard: if another playback started while we were awaiting,
        //    this call is stale — bail out without touching state.
        if (sessionId !== playbackSessionRef.current) return;

        setAudioLoading(false);

        // If stopped by user (clicked another play, or stop button), stop chain
        if (result?.stopped) {
          return;
        }

        // If completed naturally OR failed (not stopped, but not completed)
        // We must check specifically for completion to continue auto-play
        if (result?.completed) {
          // If AutoPlay is active, move to next
          if (autoPlayRef.current) {
            playNextMessage(index);
          } else {
            setCurrentPlayingIndex(null);
            setIsPlaying(false);
          }
        } else {
          // Playback failed or audio was missing -> Reset state so UI doesn't look stuck
          console.warn(
            "[handlePlayAudio] Playback did not complete successfully.",
          );
          setCurrentPlayingIndex(null);
          setIsPlaying(false);
          if (autoPlayRef.current) {
            // Optional: Continue to next anyway?
            // Better to stop and let user see which one failed.
            setAutoPlay(false);
          }
        }
      } catch (err) {
        // ── Session guard for catch block too
        if (sessionId !== playbackSessionRef.current) return;

        console.error("Playback error:", err);

        // ─── Fallback: Refresh Expired URL & Retry ──────────────────
        let fallbackSuccess = false;

        // ─── Fallback 1: Refresh Expired URL & Retry ──────────────────
        if (
          err.name === "NotSupportedError" ||
          err.message?.includes("403") ||
          err.message?.includes("404") ||
          err.message?.includes("source was found")
        ) {
          console.log("Attempting to refresh expired audio URL...");

          try {
            // Determine identifiers
            const questionCount = getQuestionIndexForMessage(index); // 1-based
            const conversationId = message._id; // If available (new system)

            console.log(
              `Refreshing URL for: Interview ${interview._id}, Q${questionCount}, ConvID: ${conversationId}`,
            );

            const { audioUrl: newUrl } = await api.refreshAudioUrl(
              interview._id,
              index, // Pass raw history index so backend can locate the item in interview.history[]
              conversationId,
            );

            // Re-check session after another await
            if (sessionId !== playbackSessionRef.current) return;

            if (newUrl) {
              console.log("Refreshed URL successfully:", newUrl);

              // Update local mutable object (since we can't easily update parent state deep down here)
              // This ensures if the user clicks again, it uses the new URL
              message.audioUrl = newUrl;

              console.log("Retrying playback with new URL...");
              const retryResult = await playUrl(newUrl);

              // Re-check session after retry
              if (sessionId !== playbackSessionRef.current) return;

              if (retryResult?.completed) {
                setAudioLoading(false);
                if (autoPlayRef.current) playNextMessage(index);
                fallbackSuccess = true;
              }
            }
          } catch (refreshErr) {
            console.error("Failed to refresh audio URL:", refreshErr);
          }
        }

        // ─── Fallback 2: Emergency TTS for Transcript ──────────────────
        if (!fallbackSuccess && isUser) {
          console.log(
            "Audio URL failed completely. Attempting emergency TTS fallback using transcript...",
          );
          try {
            const qIdx = getQuestionIndexForMessage(index);
            const extractedText =
              message.content ||
              (message.parts && message.parts.length > 0
                ? message.parts[0].text
                : null);
            const isPlaceholder =
              extractedText ===
                "Please evaluate my answer and ask the next question." ||
              extractedText === "🎤 Audio Answer Submitted";

            let fallbackText = null;
            if (extractedText && !isPlaceholder) {
              fallbackText = extractedText;
            }

            if (fallbackText) {
              console.log(
                "Playing fallback TTS for transcript:",
                fallbackText.substring(0, 50) + "...",
              );

              // We intentionally omit interviewId and questionIndex so it doesn't overwrite DB audio
              const ttsResult = await speak(fallbackText);

              if (sessionId !== playbackSessionRef.current) return;

              if (ttsResult?.completed) {
                setAudioLoading(false);
                if (autoPlayRef.current) playNextMessage(index);
                fallbackSuccess = true;
              }
            } else {
              console.warn("No transcript available for TTS fallback.");
            }
          } catch (ttsErr) {
            console.error("Emergency TTS fallback failed:", ttsErr);
          }
        }

        if (!fallbackSuccess) {
          setAudioLoading(false);
          setCurrentPlayingIndex(null);
          setIsPlaying(false);
          setAutoPlay(false);
        }
      }
    },
    [
      interview,
      currentPlayingIndex,
      autoPlay,
      getQuestionIndexForMessage,
      parseMessageText,
    ],
  );

  // ─── Play next message (for auto-play) ───────────────
  const playNextMessage = useCallback(
    (currentIndex) => {
      if (!interview?.history) return;
      const nextIndex = currentIndex + 1;

      if (nextIndex < interview.history.length) {
        // Small delay between messages
        setTimeout(() => {
          // Check if we are still in autoplay mode and haven't been stopped
          if (autoPlayRef.current) {
            handlePlayAudio(nextIndex);
          }
        }, 500);
      } else {
        setAutoPlay(false);
        setCurrentPlayingIndex(null);
      }
    },
    [interview, handlePlayAudio, autoPlay],
  );

  // ─── Main Button Logic (Listen / Resume / Stop) ─────────────────
  const handleMainPlayClick = useCallback(() => {
    // Priority 1: If Paused, Resume (regardless of isPlaying flag from TTS)
    if (isPaused) {
      setAutoPlay(true);
      resume();
      return;
    }

    // Priority 2: If Playing (and NOT paused), Pause/Stop
    if (isPlaying) {
      setAutoPlay(false);
      pause();
      return;
    }

    // Priority 3: Start New
    setAutoPlay(true);

    if (currentPlayingIndex !== null) {
      if (getIsPaused()) {
        resume();
      } else {
        handlePlayAudio(currentPlayingIndex);
      }
    } else {
      const startOriginalIndex = getOriginalIndex(0);
      handlePlayAudio(startOriginalIndex);
    }
  }, [
    isPlaying,
    isPaused,
    currentPlayingIndex,
    getOriginalIndex,
    handlePlayAudio,
  ]);

  // Determine button text/icon based on actual playback state
  // Prioritize PAUSED state over PLAYING state because ttsPlayer.isCurrentlyPlaying remains true while paused.
  const mainButtonState = useMemo(() => {
    if (isPaused) return "RESUME";
    if (isPlaying) return "STOP";
    if (currentPlayingIndex !== null) return "RESUME";
    return "START";
  }, [isPlaying, isPaused, currentPlayingIndex]);

  // ─── Restart Interview Playback ─────────────────────────────────
  const handleRestart = useCallback(() => {
    stop();
    setAutoPlay(true);
    const startOriginalIndex = getOriginalIndex(0);
    // Timeout to allow stop to process if needed, though usually synchronous in state
    setTimeout(() => {
      handlePlayAudio(startOriginalIndex);
    }, 50);
  }, [getOriginalIndex, handlePlayAudio]);

  // ─── Download Transcript as PDF ─────────────────────────────────
  const downloadTranscript = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      await generateTranscriptPdf({
        interview,
        visibleHistory,
        parseMessageText,
        getQuestionIndexForMessage,
      });
    } catch (error) {
      console.error("PDF Generation failed:", error);
    } finally {
      setIsDownloading(false);
    }
  }, [
    interview,
    isDownloading,
    visibleHistory,
    parseMessageText,
    getQuestionIndexForMessage,
  ]);

  // ─── Early return ──────────────────────────────────────────────
  if (!isOpen) return null;

  // ─── Skeleton Loading State ────────────────────────────────────
  if (!interview) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden h-[600px]"
          >
            {/* Skeleton Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-7 w-48 bg-slate-200 rounded-lg animate-pulse" />
                  <div className="h-6 w-24 bg-slate-200 rounded-full animate-pulse" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-40 bg-slate-200 rounded-xl animate-pulse" />
                <div className="h-10 w-10 bg-slate-200 rounded-xl animate-pulse" />
              </div>
            </div>

            {/* Skeleton Body */}
            <div className="flex-1 p-6 space-y-8 bg-slate-50/50 overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-6">
                  {/* AI Message Skeleton (Left) */}
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
                      <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                    </div>
                  </div>

                  {/* User Message Skeleton (Right) */}
                  <div className="flex gap-3 flex-row-reverse">
                    <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 animate-pulse" />
                    <div className="space-y-2 flex flex-col items-end">
                      <div className="h-12 w-64 bg-slate-200 rounded-2xl rounded-tr-none animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        <motion.div
          id="interview-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden"
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-slate-800">
                  {interview.role}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${
                    interview.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {interview.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <User size={14} /> {interview.user?.name || "Unknown User"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} />{" "}
                  {new Date(interview.date).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />{" "}
                  {interview.durationSeconds
                    ? `${Math.round(interview.durationSeconds / 60)}m`
                    : "-"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleMainPlayClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  mainButtonState === "STOP"
                    ? "bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
                }`}
              >
                {mainButtonState === "STOP" ? (
                  <>
                    <Pause size={16} fill="currentColor" /> Stop Listening
                  </>
                ) : mainButtonState === "RESUME" ? (
                  <>
                    <Play size={16} fill="currentColor" /> Resume Listening
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" /> Listen to Interview
                  </>
                )}
              </button>

              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
              >
                <RotateCcw size={16} /> Restart
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* ── Transcript Body ────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 scroll-smooth">
            {!visibleHistory || visibleHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <MessageSquare size={48} className="mb-4 opacity-50" />
                <p>No transcript available for this interview.</p>
              </div>
            ) : (
              visibleHistory.map((msg, idx) => {
                const isUser = msg.role === "user";
                const originalIndex = getOriginalIndex(idx);
                const isPlayingThis = currentPlayingIndex === originalIndex;
                const isLoadingThis = isPlayingThis && audioLoading;

                // Active Pulse Animation for playing card
                const isCardActive = isPlayingThis && !isPaused;

                // Get display text
                let displayText;
                if (isUser) {
                  // If the message has real transcribed content (not placeholders), use it directly
                  const extractedText =
                    msg.content ||
                    (msg.parts && msg.parts.length > 0
                      ? msg.parts[0].text
                      : null);
                  const isPlaceholder =
                    extractedText ===
                      "Please evaluate my answer and ask the next question." ||
                    extractedText === "🎤 Audio Answer Submitted";

                  if (extractedText && !isPlaceholder) {
                    displayText = extractedText;
                  } else if (transcribing) {
                    displayText = null; // Will show skeleton
                  } else {
                    displayText = "(Audio response)";
                  }
                } else {
                  const parts =
                    msg.parts || (msg.content ? [{ text: msg.content }] : []);
                  const rawText = parts.map((p) => p.text).join("");
                  displayText = parseMessageText(rawText);
                }

                return (
                  <div
                    key={idx}
                    className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                        isUser
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                          : "bg-white border border-slate-200 text-purple-600"
                      }`}
                    >
                      {isUser ? <User size={18} /> : <Bot size={18} />}
                    </div>

                    {/* Message bubble + controls */}
                    <div
                      className={`flex items-start gap-2 max-w-[80%] ${
                        isUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {/* Message bubble */}
                      <div
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
                            isUser
                              ? "bg-blue-600 text-white rounded-tr-none"
                              : "bg-white border border-slate-200 text-slate-700 rounded-tl-none"
                          } ${isCardActive ? "ring-2 ring-offset-2 ring-blue-400" : ""}`}
                        >
                          {displayText === null ? (
                            // Skeleton loader for transcribing
                            <div className="space-y-2 py-1">
                              <div className="h-3 w-48 bg-blue-400/30 rounded animate-pulse" />
                              <div className="h-3 w-36 bg-blue-400/30 rounded animate-pulse" />
                              <div className="h-3 w-40 bg-blue-400/30 rounded animate-pulse" />
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap">
                              {displayText}
                            </div>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 mt-1.5 font-medium px-1 flex items-center">
                          {isUser
                            ? interview.user?.name || "Unknown User"
                            : "Interviewer AI"}
                          {isPlayingThis && !isLoadingThis && !isPaused && (
                            <span className="ml-2 text-blue-500 font-bold animate-pulse flex items-center gap-1">
                              • Playing
                            </span>
                          )}
                          {isPlayingThis && !isLoadingThis && isPaused && (
                            <span className="ml-2 text-slate-400 font-bold">
                              • Paused
                            </span>
                          )}
                          {isLoadingThis && (
                            <span className="ml-2 text-amber-500 font-bold">
                              • Loading...
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Play/Pause button — always visible, beside the bubble — IGNORE IN PDF */}
                      <button
                        onClick={() => handlePlayAudio(originalIndex)}
                        className={`mt-2 p-2 rounded-full shadow-md transition-all shrink-0 ${
                          isPlayingThis && !isPaused && !isLoadingThis
                            ? "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                            : isLoadingThis
                              ? "bg-amber-100 text-amber-600"
                              : isUser
                                ? "bg-white text-blue-600 hover:bg-blue-50 border border-slate-200"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                        title={
                          isPlayingThis
                            ? isPaused
                              ? "Resume"
                              : "Pause"
                            : isLoadingThis
                              ? "Loading..."
                              : "Play audio"
                        }
                        disabled={isLoadingThis}
                      >
                        {isLoadingThis ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isPlayingThis && !isPaused ? (
                          <Pause size={14} fill="currentColor" />
                        ) : (
                          <Play size={14} fill="currentColor" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Footer — Download Transcript ───────────────────── */}
          {interview.history && interview.history.length > 0 && (
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
              <button
                onClick={downloadTranscript}
                disabled={isDownloading}
                className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Generating
                    PDF...
                  </>
                ) : (
                  <>
                    <Download size={14} /> Download Transcript
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default InterviewDetailModal;
