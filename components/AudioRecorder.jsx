import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "./ui/Button";
import useSpeechRecognition from "../hooks/useSpeechRecognition";

// ─── Constants ──────────────────────────────────────────────────────
const MAX_RECORDING_SECONDS = 600; // 10 minutes safety limit

/**
 * Determine the best supported MIME type for recording.
 * Prefers webm/opus for consistency, falls back to mp4, then default webm.
 */
const getPreferredMimeType = () => {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  for (const mime of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(mime)
    ) {
      return mime;
    }
  }
  return "audio/webm"; // Fallback default
};

// ─── Component ──────────────────────────────────────────────────────
export const AudioRecorder = ({
  onRecordingComplete,
  disabled,
  isProcessing,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null); // Track media stream for cleanup
  const maxTimerRef = useRef(null); // Safety timer for max duration

  const {
    startListening,
    stopListening,
    transcript,
    isListening: isRecognizing,
    usingPuter,
  } = useSpeechRecognition();

  // ── Cleanup on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, []);

  // ── Cleanup helper ──────────────────────────────────────────────
  const cleanupRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Start Recording ─────────────────────────────────────────────
  const startRecording = async () => {
    // Prevent double-start
    if (isRecording || mediaRecorderRef.current) return;

    // Check MediaRecorder support
    if (typeof MediaRecorder === "undefined") {
      alert(
        "Your browser does not support audio recording. Please use a modern browser like Chrome or Firefox.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      const mimeType = getPreferredMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        mediaRecorderRef.current = null;

        // Skip empty recordings
        if (blob.size === 0) {
          console.warn("[AudioRecorder] Empty recording, skipping");
          return;
        }

        // Stop recognition and get final transcript (Web Speech or Puter)
        const finalTranscript = await stopListening(blob);
        onRecordingComplete(blob, finalTranscript);
      };

      mediaRecorder.onerror = (event) => {
        console.error("[AudioRecorder] MediaRecorder error:", event.error);
        cleanupRecording();
        setIsRecording(false);
      };

      // Start recording with timeslice for chunked data
      mediaRecorder.start(1000);
      startListening(); // Start Web Speech / Puter

      setIsRecording(true);
      setRecordingTime(0);

      // Timer for display
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Safety: auto-stop after max duration
      maxTimerRef.current = setTimeout(() => {
        console.warn(
          `[AudioRecorder] Auto-stopping after ${MAX_RECORDING_SECONDS}s`,
        );
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (err) {
      console.error("[AudioRecorder] Error accessing microphone:", err);
      cleanupRecording();
      setIsRecording(false);

      if (err.name === "NotAllowedError") {
        alert(
          "Microphone permission denied. Please allow microphone access in your browser settings.",
        );
      } else if (err.name === "NotFoundError") {
        alert(
          "No microphone found. Please connect a microphone and try again.",
        );
      } else {
        alert(
          "Could not access microphone. Please ensure permissions are granted.",
        );
      }
    }
  };

  // ── Stop Recording ──────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      return;
    }

    // Clear timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }

    try {
      mediaRecorderRef.current.stop(); // This triggers onstop above
    } catch (e) {
      console.error("[AudioRecorder] Error stopping recorder:", e);
      cleanupRecording();
    }

    setIsRecording(false);
  }, [cleanupRecording]);

  // ── Format Time Display ─────────────────────────────────────────
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ── Render: Processing State ────────────────────────────────────
  if (isProcessing) {
    return (
      <div className="flex items-center gap-3 text-slate-500 bg-white px-6 py-3 rounded-full border border-slate-200 shadow-sm">
        <Loader2 className="animate-spin text-blue-500" size={20} />
        <span>Processing...</span>
      </div>
    );
  }

  // ── Render: Recording State ─────────────────────────────────────
  if (isRecording) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4 bg-red-50 px-6 py-3 rounded-full border border-red-200 animate-pulse">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-red-600 font-mono w-12 text-center">
            {formatTime(recordingTime)}
          </span>
        </div>
        <Button
          variant="danger"
          size="lg"
          onClick={stopRecording}
          className="rounded-full w-16 h-16 flex items-center justify-center p-0 shadow-lg shadow-red-500/30 ring-4 ring-red-100"
        >
          <Square size={24} fill="currentColor" />
        </Button>
        <p className="text-sm text-slate-500">Tap to finish speaking</p>
      </div>
    );
  }

  // ── Render: Default State ───────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="primary"
        size="lg"
        onClick={startRecording}
        disabled={disabled}
        className="rounded-full w-16 h-16 flex items-center justify-center p-0 bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-500/30 transition-all hover:scale-105"
      >
        <Mic size={28} />
      </Button>
      <p className="text-sm text-slate-400">Tap to answer</p>
    </div>
  );
};
