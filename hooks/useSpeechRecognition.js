import { useState, useEffect, useRef, useCallback } from "react";

// ─── Hook ───────────────────────────────────────────────────────────
const useSpeechRecognition = () => {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef(null);
  const transcriptRef = useRef(""); // Mirror of transcript state to avoid stale closures
  const isListeningRef = useRef(false); // Mirror of isListening for onend handler
  const errorRef = useRef(null); // Track if an error occurred during the session

  // ── Initialize Web Speech API ───────────────────────────────────
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn(
        "[SpeechRecognition] Web Speech API not supported. Transcription will happen on backend after upload.",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalTranscriptChunk = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscriptChunk += event.results[i][0].transcript;
        }
      }

      if (finalTranscriptChunk) {
        const updated =
          (transcriptRef.current ? transcriptRef.current + " " : "") +
          finalTranscriptChunk;
        transcriptRef.current = updated;
        setTranscript(updated);
      }
    };

    recognition.onerror = (event) => {
      console.warn("[SpeechRecognition] Web Speech Error:", event.error);
      if (event.error !== "aborted") {
        errorRef.current = event.error;
      }
    };

    // Handle unexpected stops — restart if we're still supposed to be listening
    recognition.onend = () => {
      if (isListeningRef.current && !recognitionRef.current?._manualStop) {
        try {
          recognition.start();
        } catch {
          // Already started or other issue, ignore
        }
      }
    };

    recognitionRef.current = recognition;
    recognitionRef.current._manualStop = false;

    // Cleanup on unmount
    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current._manualStop = true;
          recognitionRef.current.abort();
        }
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start Listening ─────────────────────────────────────────────
  const startListening = useCallback(() => {
    // Reset state for new recording
    transcriptRef.current = "";
    errorRef.current = null;
    setTranscript("");
    setIsListening(true);
    isListeningRef.current = true;

    if (recognitionRef.current) {
      try {
        recognitionRef.current._manualStop = false;
        recognitionRef.current.start();
      } catch (e) {
        // Could be "already started" — safe to ignore
        console.warn("[SpeechRecognition] Failed to start Web Speech:", e);
      }
    }
  }, []);

  // ── Stop Listening ──────────────────────────────────────────────
  const stopListening = useCallback(async (audioBlob) => {
    setIsListening(false);
    isListeningRef.current = false;

    // Stop Web Speech if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current._manualStop = true;
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }

    // Give Web Speech API a moment to fire the final 'onresult' event
    // stop() is asynchronous and the final result usually arrives a few hundred ms later.
    await new Promise((resolve) => setTimeout(resolve, 800));

    // If Web Speech API is not supported (recognitionRef is null)
    // OR if we encountered a specific error (like network, no-speech, etc.)
    // return null so that the backend takes over transcription.
    if (!recognitionRef.current || errorRef.current) {
      console.log(
        "[SpeechRecognition] Fallback condition met (No support or Error). Returning null.",
      );
      return null;
    }

    // Return current transcript from ref (avoids stale closure issue)
    return transcriptRef.current || "";
  }, []);

  // ── Reset Transcript ────────────────────────────────────────────
  const resetTranscript = useCallback(() => {
    transcriptRef.current = "";
    setTranscript("");
    errorRef.current = null;
  }, []);

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
  };
};

export default useSpeechRecognition;
