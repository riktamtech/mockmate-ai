/**
 * TTS Fallback Engines
 *
 * Contains isolated, self-contained TTS implementations for fallback scenarios.
 * Each function returns a Promise that resolves when audio finishes playing.
 *
 * Fallback order (when backend Edge TTS fails):
 *   1. StreamElements  — Free, no auth, fast MP3
 *   2. Web Speech API  — Browser native, no network needed
 *   3. Gemini TTS      — Last resort, slow but high quality
 */

import { api } from "./api"; // Assuming api service is available for authenticated calls

// ─── StreamElements API (Primary Fallback) ──────────────────────────────────────

/**
 * Speak text using StreamElements TTS API.
 * Free, no auth required, returns MP3 audio.
 * Called directly from frontend when backend TTS fails — user won't notice a switch.
 *
 * @param {string} text - Text to speak
 * @param {string} voice - StreamElements voice (default: 'Brian')
 * @returns {Promise<void>} Resolves when audio finishes playing
 */
export async function speakWithStreamElements(text, voice = "Brian") {
  if (!text || text.trim().length === 0) {
    console.warn("[TTS Fallback: StreamElements] Empty text, skipping");
    return;
  }

  // StreamElements has a ~300 char limit per request, so split if needed
  const chunks = splitTextForStreamElements(text);

  for (const chunk of chunks) {
    await playStreamElementsChunk(chunk, voice);
  }
}

function splitTextForStreamElements(text, maxLen = 280) {
  if (text.length <= maxLen) return [text];

  const sentences = text.split(/(?<=[.!?;])\s+/);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text.substring(0, maxLen)];
}

function playStreamElementsChunk(text, voice) {
  return new Promise((resolve, reject) => {
    try {
      const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`;
      const audio = new Audio(url);
      audio.onended = () => resolve();
      audio.onerror = (e) => {
        console.error(
          "[TTS Fallback: StreamElements] Audio playback error:",
          e,
        );
        reject(new Error("StreamElements audio playback failed"));
      };
      audio.play().catch((e) => {
        console.error("[TTS Fallback: StreamElements] Play failed:", e);
        reject(e);
      });
    } catch (err) {
      console.error("[TTS Fallback: StreamElements] Error:", err);
      reject(err);
    }
  });
}

// ─── Gemini TTS (Secondary Backup) ───────────────────────────────────────────

/**
 * Speak using Gemini 2.5 Flash Preview TTS via backend API.
 * Uses the /api/ai/tts-gemini-backup endpoint.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function speakWithGeminiTTS(text, language = "English") {
  try {
    const data = await api.generateSpeechGeminiBackup(text, language);

    if (!data?.audio) {
      console.error("[TTS Backup: Gemini] No audio data returned");
      throw new Error("No audio data from Gemini Backup");
    }

    // Gemini TTS returns WAV-encoded base64 audio — decodeAudioData handles
    // WAV/MP3 natively (sample rate, channels are embedded in the WAV header).
    const binaryString = atob(data.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

    return new Promise((resolve) => {
      const source = audioContext.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        audioContext.close();
        resolve();
      };
      source.start();
    });
  } catch (error) {
    console.error("[TTS Backup: Gemini] Error:", error);
    throw error; // Let caller handle fallback
  }
}

// ─── Web Speech API (Emergency Backup — Last Resort) ─────────────────────────

/**
 * Speak using the browser's built-in Web Speech API.
 * No network required. Quality varies by browser/OS.
 *
 * @param {string} text
 * @param {string} lang - Language (default: 'en-US')
 * @returns {Promise<void>}
 */
export async function speakWithWebSpeechAPI(text, language = "English") {
  const mapLanguageToLangCode = (lang) => {
    const map = {
      English: "en-US",
      Spanish: "es-ES",
      French: "fr-FR",
      German: "de-DE",
      Hindi: "hi-IN",
      Mandarin: "zh-CN",
      Japanese: "ja-JP",
      Portuguese: "pt-BR",
    };
    return map[lang] || "en-US";
  };
  const bcp47Lang = mapLanguageToLangCode(language);

  if (!window.speechSynthesis) {
    console.error("[TTS Backup: Web Speech API] Not supported in this browser");
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = bcp47Lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      console.error("[TTS Backup: Web Speech API] Error:", e);
      resolve(); // Don't reject — this is the last resort
    };
    window.speechSynthesis.speak(utterance);
  });
}
