import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Loader2, Trash2, Send } from "lucide-react";
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

// ─── Component: LiveAudioVisualizer ─────────────────────────────────
const LiveAudioVisualizer = ({ stream }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!stream) return;

    let audioContext;
    let analyser;
    let source;
    let animationId;

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const draw = () => {
        animationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = 3;
        const barGap = 3;
        const totalBars = Math.floor(canvas.width / (barWidth + barGap));
        const centerY = canvas.height / 2;

        for (let i = 0; i < totalBars; i++) {
          const dataIndex = Math.floor((i / totalBars) * (bufferLength / 3));
          let value = dataArray[dataIndex];
          const normalizedValue = value / 255;

          const minHeight = 3;
          const maxHeight = canvas.height - 4;
          let h = minHeight + normalizedValue * maxHeight;

          // Gentle idle wave when silent
          if (value === 0) {
            h = minHeight + Math.abs(Math.sin(Date.now() / 300 + i)) * 3;
          }

          const x = i * (barWidth + barGap);
          const y = centerY - h / 2;

          ctx.fillStyle = "#ea4335";
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, h, barWidth / 2);
          ctx.fill();
        }
      };

      draw();
    } catch (err) {
      console.error("Audio visualizer error:", err);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (source) source.disconnect();
      if (analyser) analyser.disconnect();
      if (audioContext && audioContext.state !== "closed") audioContext.close();
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      width={110}
      height={24}
      className="opacity-90 mx-1"
    />
  );
};

// ─── Component ──────────────────────────────────────────────────────
export const AudioRecorder = ({
  onRecordingComplete,
  disabled,
  isProcessing,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedData, setRecordedData] = useState(null);
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);

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
          setIsProcessingLocal(false);
          return;
        }

        try {
          // Stop recognition and get final transcript (Web Speech or Puter)
          const finalTranscript = await stopListening(blob);
          setRecordedData({ blob, transcript: finalTranscript });
        } catch (err) {
          console.error("[AudioRecorder] Error finalizing recording:", err);
        } finally {
          setIsProcessingLocal(false);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("[AudioRecorder] MediaRecorder error:", event.error);
        cleanupRecording();
        setIsRecording(false);
        setIsProcessingLocal(false);
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

    setIsRecording(false);
    setIsProcessingLocal(true);

    try {
      mediaRecorderRef.current.stop(); // This triggers onstop above
    } catch (e) {
      console.error("[AudioRecorder] Error stopping recorder:", e);
      cleanupRecording();
      setIsProcessingLocal(false);
    }
  }, [cleanupRecording]);

  // ── Format Time Display ─────────────────────────────────────────
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ── Render: Processing State ────────────────────────────────────
  if (isProcessing || isProcessingLocal) {
    return (
      <div className="flex items-center gap-3 text-slate-500 bg-white px-6 py-3 rounded-full border border-slate-200 shadow-sm">
        <Loader2 className="animate-spin text-blue-500" size={20} />
        <span>Processing...</span>
      </div>
    );
  }

  // ── Render: Recorded State (Waiting to send) ────────────────────
  if (recordedData) {
    return (
      <div className="flex items-center gap-2 bg-white p-1.5 pl-3 rounded-full shadow-md border border-slate-100 transition-all duration-300">
        <button
          onClick={() => setRecordedData(null)}
          className="w-10 h-10 flex items-center justify-center rounded-full text-[#ea4335] hover:bg-red-50 transition-colors"
          title="Delete recording"
        >
          <Trash2 size={20} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => {
            onRecordingComplete(recordedData.blob, recordedData.transcript);
            setRecordedData(null);
          }}
          className="flex items-center gap-2 bg-[#1a73e8] hover:bg-blue-600 text-white px-5 py-2.5 rounded-full font-medium transition-all shadow-sm"
        >
          Send Response
          <Send size={18} />
        </button>
      </div>
    );
  }

  // ── Render: Recording State ─────────────────────────────────────
  if (isRecording) {
    return (
      <div className="flex items-center gap-3 bg-[#fff1f0] pr-2 pl-6 py-2 rounded-full border border-red-100 shadow-sm transition-all duration-300">
        <LiveAudioVisualizer stream={streamRef.current} />
        <span className="text-slate-600 font-medium text-[15px] w-12 text-center font-mono">
          {formatTime(recordingTime)}
        </span>
        <button
          onClick={stopRecording}
          className="w-12 h-12 ml-1 bg-[#ea4335] hover:bg-[#d63c2e] text-white rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105"
        >
          <Square size={16} fill="currentColor" className="opacity-90" />
        </button>
      </div>
    );
  }

  // ── Render: Default State ───────────────────────────────────────
  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="flex items-center justify-center gap-2.5 bg-[#d93025] hover:bg-[#c5221f] disabled:bg-red-300 disabled:cursor-not-allowed text-white px-7 py-3 rounded-full shadow-md hover:shadow-lg transition-all border-0 focus:ring-0 focus:outline-none"
    >
      <Mic size={20} className="opacity-90" strokeWidth={2.5} />
      <span className="font-medium text-[16px] tracking-wide">
        Start Speaking
      </span>
    </button>
  );
};
