/**
 * TTS Player — Audio orchestrator with streaming playback, ordered queue,
 * and automatic fallback chain. Supports Pause/Resume.
 *
 * Singleton pattern. Main entry: speak(text) → Promise<Result>
 */

import {
  speakWithStreamElements,
  speakWithGeminiTTS,
  speakWithWebSpeechAPI,
} from "./ttsFallbacks";
import { api } from "./api";

// ─── Configuration ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15000; // Max wait for backend TTS response

// ─── State ──────────────────────────────────────────────────────────────────────

let audioContext = null;
let playbackQueue = []; // Array of { buffer: AudioBuffer, index: number }
let isCurrentlyPlaying = false;
let isPaused = false;
let currentSource = null; // Can be AudioBufferSourceNode or verify-alike object for HTML5 Audio
let stopRequested = false;
let currentResolve = null; // Resolve function for the current speak() Promise
let pendingChunks = 0; // How many chunks are still expected
let chunksPlayed = 0; // How many chunks have finished playing
let playbackListeners = new Set(); // Functions to notify on state change
let _lastGeneratedAudioUrl = null; // Cached audio URL from last speak() call

// ─── Notification Helper ──────────────────────────────────────────────────────

function notifyListeners() {
  const state = {
    isPlaying: isCurrentlyPlaying,
    isPaused: isPaused,
  };
  playbackListeners.forEach((listener) => listener(state));
}

export function addPlaybackListener(listener) {
  playbackListeners.add(listener);
  // Immediate callback with current state
  listener({ isPlaying: isCurrentlyPlaying, isPaused: isPaused });
  return () => playbackListeners.delete(listener);
}

// ─── Audio Context Management ───────────────────────────────────────────────────

function getAudioContext() {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Ensure we are running if we weren't paused explicitly
  if (audioContext.state === "suspended" && !isPaused) {
    audioContext.resume();
  }
  return audioContext;
}

// ─── Binary Stream Parser ───────────────────────────────────────────────────────

async function* parseBinaryStream(reader) {
  let buffer = new Uint8Array(0);
  let chunkIndex = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const newBuffer = new Uint8Array(buffer.length + value.length);
    newBuffer.set(buffer, 0);
    newBuffer.set(value, buffer.length);
    buffer = newBuffer;

    while (buffer.length >= 4) {
      const view = new DataView(buffer.buffer, buffer.byteOffset, 4);
      const chunkLength = view.getUint32(0, false);
      if (chunkLength === 0) return; // Terminal
      if (buffer.length < 4 + chunkLength) break;

      const mp3Data = buffer.slice(4, 4 + chunkLength);
      yield { index: chunkIndex++, mp3Data };
      buffer = buffer.slice(4 + chunkLength);
    }
  }
}

// ─── Chunk Decoding & Playback ──────────────────────────────────────────────────

async function decodeMP3(mp3Data) {
  const ctx = getAudioContext();
  const arrayBuffer = mp3Data.buffer.slice(
    mp3Data.byteOffset,
    mp3Data.byteOffset + mp3Data.byteLength,
  );
  return ctx.decodeAudioData(arrayBuffer);
}

function playNextInQueue() {
  if (stopRequested) {
    finalizePlayback({ stopped: true });
    return;
  }

  // If paused, don't play next yet. Logic elsewhere handles resume.
  if (isPaused) return;

  if (playbackQueue.length === 0) {
    isCurrentlyPlaying = false;
    notifyListeners();

    // If no more chunks pending and queue is empty, we're done
    if (pendingChunks === 0) {
      finalizePlayback({ completed: true });
    }
    return;
  }

  // Sort queue by index to maintain order
  playbackQueue.sort((a, b) => a.index - b.index);

  const expectedIndex = chunksPlayed;
  const nextChunk = playbackQueue[0];

  if (nextChunk.index !== expectedIndex) {
    isCurrentlyPlaying = false; // Waiting for data
    notifyListeners();
    return;
  }

  playbackQueue.shift();
  isCurrentlyPlaying = true;
  notifyListeners();

  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = nextChunk.buffer;
  source.connect(ctx.destination);
  currentSource = source;

  source.onended = () => {
    // Only proceed if we weren't just stopped/paused manually
    if (!stopRequested && !isPaused) {
      currentSource = null;
      chunksPlayed++;
      playNextInQueue();
    }
  };

  source.start();
}

function enqueueAudioBuffer(index, buffer) {
  playbackQueue.push({ index, buffer });
  if (!isCurrentlyPlaying && !isPaused && !stopRequested) {
    playNextInQueue();
  }
}

// ─── Simple URL Playback (Audio Element) ──────────────────────────────────────

export function playUrl(url) {
  stop(); // Stop any existing playback
  stopRequested = false;
  isCurrentlyPlaying = true;
  isPaused = false;
  notifyListeners();

  return new Promise((resolve, reject) => {
    currentResolve = resolve;
    const audio = new Audio(url);

    // Attach to currentSource so we can control it
    currentSource = {
      type: "html5",
      audio: audio,
      stop: () => {
        audio.pause();
        audio.currentTime = 0;
      },
      pause: () => audio.pause(),
      resume: () => audio.play().catch((e) => console.warn("Resume failed", e)),
    };

    audio.onended = () => {
      isCurrentlyPlaying = false;
      isPaused = false;
      currentSource = null;
      notifyListeners();
      finalizePlayback({ completed: true });
    };

    audio.onerror = (e) => {
      console.error("Audio URL playback error", e);
      finalizePlayback({ completed: false, error: e });
    };

    audio.play().catch((e) => {
      console.warn("Audio play failed (maybe user gesture required):", e);
      finalizePlayback({ completed: false, error: e });
    });
  });
}

function playAudioUrl(url) {
  return playUrl(url);
}

// ─── Controls ───────────────────────────────────────────────────────────────────

export function pause() {
  console.log(
    `[TTS Player] Pause requested. isCurrentlyPlaying: ${isCurrentlyPlaying}, isPaused: ${isPaused}`,
  );
  if (!isCurrentlyPlaying || isPaused) return;

  isPaused = true;
  notifyListeners();

  // 1. Web Audio API
  if (audioContext && audioContext.state === "running") {
    audioContext.suspend();
  }

  // 2. HTML5 Audio
  if (currentSource && currentSource.type === "html5") {
    currentSource.pause();
  }

  // 3. Web Speech API
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
  }
}

export function resume() {
  console.log(`[TTS Player] Resume requested. isPaused: ${isPaused}`);
  if (!isPaused) return;

  isPaused = false;
  notifyListeners();

  // 1. Web Audio API
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume();
    // Use timeout to ensure state matches before continuing queue
    if (!currentSource && playbackQueue.length > 0) {
      playNextInQueue();
    }
  }

  // 2. HTML5 Audio
  if (currentSource && currentSource.type === "html5") {
    currentSource.resume();
  }

  // 3. Web Speech API
  if (window.speechSynthesis && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
}

function finalizePlayback(result) {
  isCurrentlyPlaying = false;
  isPaused = false;
  currentSource = null;
  notifyListeners();

  if (currentResolve) {
    const resolve = currentResolve;
    currentResolve = null;
    resolve(result); // { completed: true } or { stopped: true }
  }
}

export function stop() {
  stopRequested = true;

  // 1. Stop Web Audio
  if (
    currentSource &&
    typeof currentSource.stop === "function" &&
    !currentSource.type
  ) {
    // Detach onended BEFORE stopping — source.stop() fires onended
    // asynchronously, and by that time stopRequested may have been reset
    // by a subsequent playUrl() call, causing the stale handler to wipe
    // currentSource and resolve the wrong promise.
    currentSource.onended = null;
    try {
      currentSource.stop();
    } catch (e) {}
  }
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume(); // Resume to clear buffer/context
  }

  // 2. Stop HTML5 Audio
  if (currentSource && currentSource.type === "html5") {
    currentSource.stop();
  }

  // 3. Stop Web Speech
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  playbackQueue = [];
  isCurrentlyPlaying = false;
  isPaused = false;
  pendingChunks = 0;

  // Resolve pending promise with stopped status
  finalizePlayback({ stopped: true });
}

export function getIsPlaying() {
  return isCurrentlyPlaying;
}

export function getIsPaused() {
  return isPaused;
}

// ─── Main API ───────────────────────────────────────────────────────────────────

export async function speak(
  text,
  interviewId = null,
  questionIndex = null,
  isFinalMessage = false,
  historyId = null,
  language = "English",
) {
  if (!text || text.trim().length === 0) return { completed: true };

  stop(); // Stop previous
  stopRequested = false;
  playbackQueue = [];
  isCurrentlyPlaying = false; // Will trigger true when first chunk plays
  isPaused = false;
  chunksPlayed = 0;
  pendingChunks = 1;
  _lastGeneratedAudioUrl = null; // Reset cached URL for this new call

  notifyListeners();

  return new Promise(async (resolve) => {
    currentResolve = resolve;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      // Pass cache context if available
      const questionIdx = questionIndex !== undefined ? questionIndex : null;

      const response = await api.ttsStream(
        text,
        interviewId,
        questionIdx,
        controller.signal,
        isFinalMessage,
        historyId,
        language,
      );

      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        throw new Error(`[TTS Player] Backend returned ${response.status}`);
      }

      const contentType = response.headers.get("content-type");

      // CASE 1: Cache Hit (JSON)
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.audioUrl) {
          _lastGeneratedAudioUrl = data.audioUrl; // Cache for frontend reuse
          const playResult = await playAudioUrl(data.audioUrl);
          resolve(playResult); // Resolve speak promise explicitly since currentResolve has been overwritten
          return;
        }
      }

      // CASE 2: Binary Stream
      const reader = response.body.getReader();
      let receivedAny = false;
      const collectedMp3Chunks = []; // Collect raw MP3 data for Blob URL caching

      for await (const { index, mp3Data } of parseBinaryStream(reader)) {
        if (stopRequested) break;
        receivedAny = true;
        collectedMp3Chunks.push(new Uint8Array(mp3Data));
        try {
          const audioBuffer = await decodeMP3(mp3Data);
          enqueueAudioBuffer(index, audioBuffer);
        } catch (decodeErr) {
          console.error(`[TTS Player] Decode error chunk ${index}:`, decodeErr);
        }
      }

      // Create a Blob URL from collected chunks for instant replay
      if (collectedMp3Chunks.length > 0 && !stopRequested) {
        const blob = new Blob(collectedMp3Chunks, { type: "audio/mp3" });
        _lastGeneratedAudioUrl = URL.createObjectURL(blob);
      }

      pendingChunks = 0;

      if (!receivedAny && !stopRequested) {
        throw new Error("[TTS Player] No audio chunks received");
      }

      // If we finished downloading and nothing is playing/queued (rare but possible for short clips), finish.
      if (
        !isCurrentlyPlaying &&
        playbackQueue.length === 0 &&
        !isPaused &&
        !stopRequested
      ) {
        finalizePlayback({ completed: true });
      }
    } catch (error) {
      if (stopRequested) return; // Ignore errors if stopped manually

      console.error("[TTS Player] Streaming failed, trying fallbacks:", error);

      // Fallback Chain
      try {
        await speakWithStreamElements(text);
      } catch (fe1) {
        try {
          await speakWithWebSpeechAPI(text);
        } catch (fe2) {
          try {
            await speakWithGeminiTTS(text);
          } catch (fe3) {
            console.error("All fallbacks failed", fe3);
          }
        }
      }
      finalizePlayback({ completed: true });
    }
  });
}

/**
 * Retrieve and consume the audio URL generated by the last speak() call.
 * Returns a Blob URL (from binary stream) or signed S3 URL (from cache hit).
 * Returns null if no URL is available. Consumed on read (returns null on second call).
 */
export function getLastGeneratedAudioUrl() {
  const url = _lastGeneratedAudioUrl;
  _lastGeneratedAudioUrl = null;
  return url;
}

// Re-export for backward compatibility
export const stopAudio = stop;
