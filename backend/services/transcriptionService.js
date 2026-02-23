const { GoogleGenAI } = require("@google/genai");

// ─── Configuration ───────────────────────────────────────────────────
if (!process.env.GOOGLE_API_KEY) {
  console.error("GOOGLE_API_KEY is missing for Transcription Service");
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
// const TRANSCRIPTION_MODEL = "gemini-2.5-flash";
// const TRANSCRIPTION_MODEL = "gemini-3-flash-preview"; // Flash for speed/cost
const TRANSCRIPTION_MODEL = "gemini-2.0-flash-lite"; // Fastest model for STT

// ─── Constants ───────────────────────────────────────────────────────
const MIN_AUDIO_SIZE = 512; // 512 bytes — anything smaller is likely empty/noise
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB — prevent OOM
const TRANSCRIPTION_TIMEOUT_MS = 60_000; // 60 seconds

// Concise but strict prompt — keeps anti-hallucination safeguards
const STT_PROMPT =
  "Transcribe the spoken audio exactly as spoken. Output only the raw transcript text. " +
  "If the audio is completely silent, has no human speech, or contains only noise/static/clicking, output exactly: [SILENT]. " +
  "Do not invent words or interpret non-speech sounds. If parts are unclear, mark them as [inaudible].";

/**
 * Transcribe audio buffer using Gemini (streaming for lower latency).
 * @param {Buffer} audioBuffer - The audio file buffer
 * @param {string} mimeType - The MIME type of the audio
 * @returns {Promise<string|null>} - Transcribed text, or null for empty/invalid audio
 */
const transcribeWithGemini = async (audioBuffer, mimeType = "audio/webm") => {
  // ── Input Validation ──────────────────────────────────────────────
  if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
    console.warn("[Transcription] Invalid audio buffer provided");
    return null;
  }

  if (audioBuffer.length < MIN_AUDIO_SIZE) {
    console.warn(
      `[Transcription] Audio buffer too small (${audioBuffer.length} bytes). Skipping.`,
    );
    return null;
  }

  if (audioBuffer.length > MAX_AUDIO_SIZE) {
    console.error(
      `[Transcription] Audio buffer too large (${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB). Rejecting.`,
    );
    return "[Audio too large for transcription]";
  }

  const startTime = Date.now();

  try {
    const base64Audio = audioBuffer.toString("base64");

    // Set up timeout via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      TRANSCRIPTION_TIMEOUT_MS,
    );

    const response = await ai.models.generateContentStream({
      model: TRANSCRIPTION_MODEL,
      config: {
        temperature: 0.0, // Strict determinism
        maxOutputTokens: 8192, // Cap output length
      },
      contents: [
        {
          parts: [
            { text: STT_PROMPT },
            { inlineData: { data: base64Audio, mimeType } },
          ],
        },
      ],
      signal: controller.signal,
    });

    // Collect streaming response — faster time-to-first-token
    let text = "";
    for await (const chunk of response) {
      if (chunk.text) text += chunk.text;
    }

    clearTimeout(timeoutId);

    text = text.trim() || null;
    const elapsed = Date.now() - startTime;
    console.log(
      `[Transcription] Completed in ${elapsed}ms (${(audioBuffer.length / 1024).toFixed(0)} KB audio)`,
    );

    if (!text) {
      console.warn("[Transcription] Gemini returned empty transcription");
      return "[Silent]";
    }

    // Strip [SILENT] markers that Gemini inserts for brief pauses within speech.
    // Only treat as silent if the ENTIRE audio had no speech.
    const strippedText = text
      .replace(/\[SILENT\]/gi, "")
      .replace(/\(SILENT\)/gi, "")
      .replace(/\[inaudible\]/gi, "")
      .replace(/\(inaudible\)/gi, "")
      .trim();

    // If nothing remains after stripping silent markers, the audio was truly silent
    if (!strippedText) {
      return "[Silent]";
    }

    // Detect hallucinated responses for silent audio
    const lower = strippedText.toLowerCase();
    if (
      lower === "[silent]" ||
      lower === "(silent)" ||
      lower === "silent" ||
      lower.includes("no speech") ||
      lower.includes("no audio") ||
      lower.includes("silence") ||
      lower.includes("no discernible") ||
      lower.includes("empty audio")
    ) {
      return "[Silent]";
    }

    return strippedText;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("[Transcription] Gemini API timed out after 60s");
      return "[Transcription timed out]";
    }
    console.error("[Transcription] Gemini Transcription Error:", error.message);
    return `[Transcription Failed: ${error.message}]`;
  }
};

module.exports = {
  transcribeWithGemini,
};
