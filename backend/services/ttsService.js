/**
 * TTS Service — Multi-engine TTS with automatic fallback chain.
 *
 * Priority chain (controlled by AppConfig flags):
 *   1. Edge TTS   (node-edge-tts) — High quality, neural voices
 *   2. Google TTS (google-tts-api) — Free, fast, multi-language
 *   3. Web Speech API — Client-side (signaled back to frontend)
 *   4. Gemini TTS — Client-side (signaled back to frontend)
 *
 * When a backend engine fails, its flag is auto-disabled and the next engine
 * takes over with immediate effect for all subsequent requests.
 */

const { EdgeTTS } = require("node-edge-tts");
const googleTTS = require("google-tts-api");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const configService = require("./configService");

// ─── Voice Maps ─────────────────────────────────────────────────────────────────

const EDGE_VOICE_MAP = {
  English: "en-US-JennyNeural",
  Spanish: "es-ES-ElviraNeural",
  French: "fr-FR-DeniseNeural",
  German: "de-DE-KatjaNeural",
  Hindi: "hi-IN-SwaraNeural",
  Mandarin: "zh-CN-XiaoxiaoNeural",
  Japanese: "ja-JP-NanamiNeural",
  Portuguese: "pt-BR-FranciscaNeural",
};

// Google TTS language codes — maps our language names to BCP-47 codes
const GOOGLE_LANG_MAP = {
  English: "en",
  Spanish: "es",
  French: "fr",
  German: "de",
  Hindi: "hi",
  Mandarin: "zh-CN",
  Japanese: "ja",
  Portuguese: "pt",
};

// ─── Configuration ──────────────────────────────────────────────────────────────

const CONFIG = {
  voice: EDGE_VOICE_MAP["English"] || "en-US-AvaMultilingualNeural",
  // voice: "en-US-AriaNeural", // Clear, professional female voice
  // voice: "en-US-AvaNeural", // Other choices
  // voice: "en-US-JennyNeural",
  // voice: "en-US-EmmaNeural",
  // voice: "en-US-AnaNeural",
  // voice: "en-IN-NeerjaNeural",
  // voice: "en-IN-PrabhatNeural",
  rate: "-3%",
  pitch: "+15Hz",
  outputFormat: "audio-24khz-96kbitrate-mono-mp3",
  poolSize: 5, // Pre-created EdgeTTS instances
  maxConcurrent: 50, // Max simultaneous WebSocket TTS calls
  cacheMaxEntries: 500, // LRU cache size (sentence → mp3 buffer)
  tempDir: path.join(os.tmpdir(), "mockmate-tts"),
  sentenceTimeout: 8000, // Timeout per sentence synthesis (ms)
};

// Ensure temp directory exists
if (!fs.existsSync(CONFIG.tempDir)) {
  fs.mkdirSync(CONFIG.tempDir, { recursive: true });
}

// ─── Semaphore (Concurrency Limiter) ────────────────────────────────────────────

class Semaphore {
  constructor(max) {
    this._max = max;
    this._current = 0;
    this._queue = [];
  }

  async acquire() {
    if (this._current < this._max) {
      this._current++;
      return;
    }
    return new Promise((resolve) => this._queue.push(resolve));
  }

  release() {
    this._current--;
    if (this._queue.length > 0) {
      this._current++;
      const next = this._queue.shift();
      next();
    }
  }
}

const concurrencySemaphore = new Semaphore(CONFIG.maxConcurrent);

// ─── LRU Cache ──────────────────────────────────────────────────────────────────

class LRUCache {
  constructor(maxSize) {
    this._maxSize = maxSize;
    this._map = new Map();
  }

  get(key) {
    if (!this._map.has(key)) return null;
    const value = this._map.get(key);
    // Move to end (most recently used)
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this._map.has(key)) {
      this._map.delete(key);
    } else if (this._map.size >= this._maxSize) {
      // Evict the least recently used (first entry)
      const firstKey = this._map.keys().next().value;
      this._map.delete(firstKey);
    }
    this._map.set(key, value);
  }

  get size() {
    return this._map.size;
  }
}

const audioCache = new LRUCache(CONFIG.cacheMaxEntries);

// ─── EdgeTTS Connection Pool ────────────────────────────────────────────────────

/**
 * Pool of EdgeTTS instances. Each instance is stateless between calls,
 * but pre-creation avoids constructor overhead under load.
 */
class TTSPool {
  constructor(size) {
    this._pool = [];
    this._available = [];
    for (let i = 0; i < size; i++) {
      const instance = new EdgeTTS({
        voice: CONFIG.voice,
        rate: CONFIG.rate,
        pitch: CONFIG.pitch,
        outputFormat: CONFIG.outputFormat,
        timeout: CONFIG.sentenceTimeout,
      });
      this._pool.push(instance);
      this._available.push(instance);
    }
    this._waiters = [];
  }

  async acquire() {
    if (this._available.length > 0) {
      return this._available.pop();
    }
    // All instances in use — wait for one to be released
    return new Promise((resolve) => this._waiters.push(resolve));
  }

  release(instance) {
    if (this._waiters.length > 0) {
      const waiter = this._waiters.shift();
      waiter(instance);
    } else {
      this._available.push(instance);
    }
  }

  /**
   * Create a fresh instance (not from pool) for overflow scenarios or custom languages.
   * Used when pool is exhausted or using a non-default language voice.
   */
  static createFresh(language = "English") {
    const voice = EDGE_VOICE_MAP[language] || CONFIG.voice;
    return new EdgeTTS({
      voice,
      rate: CONFIG.rate,
      pitch: CONFIG.pitch,
      outputFormat: CONFIG.outputFormat,
      timeout: CONFIG.sentenceTimeout,
      // poolSize: CONFIG.poolSize,
      // maxConcurrent: CONFIG.maxConcurrent,
      // cacheMaxEntries: CONFIG.cacheMaxEntries,
      // tempDir: CONFIG.tempDir,
      // sentenceTimeout: CONFIG.sentenceTimeout,
    });
  }
}

const ttsPool = new TTSPool(CONFIG.poolSize);

// ─── Sentence Splitter ──────────────────────────────────────────────────────────

/**
 * Split text into natural sentences for parallel TTS synthesis.
 * Preserves punctuation. Coalesces tiny fragments (< 10 chars) into the previous sentence.
 */
function splitSentences(text) {
  if (!text || typeof text !== "string") return [];

  // Clean up any JSON artifacts or markdown
  let cleaned = text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/\*\*/g, "") // Remove bold markers
    .replace(/\*/g, "") // Remove italic markers
    .replace(/#{1,6}\s/g, "") // Remove heading markers
    .trim();

  if (!cleaned) return [];

  // Split on sentence boundaries: . ! ? ; and newlines
  // Lookahead ensures we keep the delimiter with the sentence
  const rawParts = cleaned.split(/(?<=[.!?;])\s+|\n+/);

  const sentences = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Coalesce tiny fragments into the previous sentence
    if (trimmed.length < 10 && sentences.length > 0) {
      sentences[sentences.length - 1] += " " + trimmed;
    } else {
      sentences.push(trimmed);
    }
  }

  // If splitting produced nothing useful, return the whole text as one sentence
  if (sentences.length === 0 && cleaned.length > 0) {
    sentences.push(cleaned);
  }

  return sentences;
}

// ─── Engine 1: Edge TTS Synthesis ───────────────────────────────────────────────

async function synthesizeSentenceEdge(
  sentence,
  retryCount = 0,
  language = "English",
) {
  const cacheKey = `edge_${language}_${sentence.trim().toLowerCase()}`;
  const cached = audioCache.get(cacheKey);
  if (cached) return cached;

  await concurrencySemaphore.acquire();
  let poolInstance = null;
  let usedFresh = false;
  let retrying = false;

  try {
    // Try to acquire from pool with a short timeout only if using English
    // since the pool is initialized with the default English voice
    if (language === "English" || !language) {
      const poolPromise = ttsPool.acquire();
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve(null), 200),
      );
      poolInstance = await Promise.race([poolPromise, timeoutPromise]);
    }

    if (!poolInstance) {
      // Pool exhausted or different language — create a fresh instance
      poolInstance = TTSPool.createFresh(language);
      usedFresh = true;
    }

    // Generate unique temp file path
    const hash = crypto.randomBytes(8).toString("hex");
    const tempFile = path.join(CONFIG.tempDir, `tts_${hash}.mp3`);

    try {
      await poolInstance.ttsPromise(sentence, tempFile);
      const mp3Buffer = await fs.promises.readFile(tempFile);

      // Clean up temp file (fire and forget)
      fs.promises.unlink(tempFile).catch(() => {});

      // Cache the result
      if (mp3Buffer && mp3Buffer.length > 0) {
        audioCache.set(cacheKey, mp3Buffer);
      }

      return mp3Buffer;
    } finally {
      // Clean up temp file if it still exists
      fs.promises.unlink(tempFile).catch(() => {});
    }
  } catch (err) {
    // Retry once on transient failures (WebSocket drops, etc.)
    if (retryCount < 1) {
      console.warn(
        `[TTS:Edge] Sentence synthesis failed, retrying (attempt ${retryCount + 1}): "${sentence.substring(0, 40)}..."`,
      );
      // Release resources before retry — flag prevents double-release in finally
      retrying = true;
      concurrencySemaphore.release();
      if (poolInstance && !usedFresh) ttsPool.release(poolInstance);
      return synthesizeSentenceEdge(sentence, retryCount + 1, language);
    }
    throw err;
  } finally {
    if (!retrying) {
      concurrencySemaphore.release();
      if (poolInstance && !usedFresh) {
        ttsPool.release(poolInstance);
      }
    }
  }
}

// ─── Engine 2: Google TTS Synthesis ─────────────────────────────────────────────

/**
 * Synthesize a single sentence using Google Translate TTS.
 * Free, no auth, ~200ms latency, multi-language.
 */
async function synthesizeSentenceGoogle(sentence, language = "English") {
  const cacheKey = `google_${language}_${sentence.trim().toLowerCase()}`;
  const cached = audioCache.get(cacheKey);
  if (cached) return cached;

  const langCode = GOOGLE_LANG_MAP[language] || "en";

  try {
    // getAllAudioBase64 handles splitting for long texts automatically
    const results = await googleTTS.getAllAudioBase64(sentence, {
      lang: langCode,
      slow: false,
      host: "https://translate.google.com",
      timeout: 5000,
    });

    // Combine all base64 chunks into a single buffer
    const buffers = results.map((result) =>
      Buffer.from(result.base64, "base64"),
    );
    const mp3Buffer = Buffer.concat(buffers);

    if (mp3Buffer && mp3Buffer.length > 0) {
      audioCache.set(cacheKey, mp3Buffer);
    }

    return mp3Buffer;
  } catch (err) {
    console.error(
      `[TTS:Google] Synthesis failed for "${sentence.substring(0, 40)}...":`,
      err.message,
    );
    throw err;
  }
}

// ─── Unified Sentence Synthesis (Flag-Aware) ────────────────────────────────────

/**
 * Synthesize a sentence using the currently active TTS engine.
 * Automatically cascades on failure.
 *
 * @returns {Buffer|null} MP3 buffer, or null if active engine is client-side
 */
async function synthesizeSentenceSafe(sentence, language = "English") {
  const activeService = await configService.getActiveTtsService();

  // If active service is client-side, signal that backend can't generate audio
  if (configService.isClientSideService(activeService)) {
    return null;
  }

  if (activeService === "edge-tts") {
    try {
      return await synthesizeSentenceEdge(sentence, 0, language);
    } catch (err) {
      console.error(
        `[TTS] Edge TTS failed, cascading to google-tts: ${err.message}`,
      );
      // Disable edge-tts and cascade
      await configService.disableService(
        "edge-tts",
        `Edge TTS synthesis error: ${err.message}`,
      );

      // Fall through to Google TTS
      try {
        return await synthesizeSentenceGoogle(sentence, language);
      } catch (googleErr) {
        console.error(
          `[TTS] Google TTS also failed, cascading to client-side: ${googleErr.message}`,
        );
        await configService.disableService(
          "google-tts",
          `Google TTS synthesis error: ${googleErr.message}`,
        );
        return null; // Signal client-side fallback
      }
    }
  }

  if (activeService === "google-tts") {
    try {
      return await synthesizeSentenceGoogle(sentence, language);
    } catch (err) {
      console.error(
        `[TTS] Google TTS failed, cascading to client-side: ${err.message}`,
      );
      await configService.disableService(
        "google-tts",
        `Google TTS synthesis error: ${err.message}`,
      );
      return null; // Signal client-side fallback
    }
  }

  // Should not reach here, but safety net
  return null;
}

// ─── Parallel Synthesis with Ordered Streaming ──────────────────────────────────

/**
 * Synthesize all sentences in parallel, stream MP3 chunks to HTTP response
 * in original sentence order as they complete.
 *
 * If the active TTS engine is client-side, returns null (caller should
 * send a JSON signal to the frontend instead).
 *
 * Binary protocol per chunk: [4-byte big-endian length][MP3 data]
 * Terminal signal: [4 bytes of 0x00000000]
 *
 * @param {string} text - Full text to synthesize
 * @param {import('express').Response} res - Express response object
 * @param {string} language - Language name
 * @returns {Promise<Buffer|null>} The complete audio buffer, or null for client-side
 */
async function streamTtsChunks(text, res, language = "English") {
  // Check if we need to signal client-side fallback
  const activeService = await configService.getActiveTtsService();
  if (configService.isClientSideService(activeService)) {
    return null; // Caller should return JSON signal
  }

  const sentences = splitSentences(text);

  if (sentences.length === 0) {
    const endSignal = Buffer.alloc(4, 0);
    res.write(endSignal);
    res.end();
    return Buffer.alloc(0);
  }

  // Launch all sentences in parallel using the flag-aware synthesizer
  const synthesisPromises = sentences.map((sentence, index) => {
    return synthesizeSentenceSafe(sentence, language)
      .then((buffer) => ({ index, buffer, error: null }))
      .catch((error) => {
        console.error(
          `[TTS] Sentence ${index} synthesis failed: "${sentence.substring(0, 50)}..."`,
          error.message,
        );
        return { index, buffer: null, error };
      });
  });

  // Stream results in order as they complete
  const results = new Array(sentences.length).fill(null);
  const resolvers = sentences.map(() => {
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    return { promise, resolve };
  });

  for (const synthPromise of synthesisPromises) {
    synthPromise.then((result) => {
      results[result.index] = result;
      resolvers[result.index].resolve();
    });
  }

  let fullAudioParts = [];
  let hasAnyNull = false;

  // Stream in order
  for (let i = 0; i < sentences.length; i++) {
    await resolvers[i].promise;

    const result = results[i];
    if (result && result.buffer && result.buffer.length > 0) {
      // Store for full buffer return
      fullAudioParts.push(result.buffer);

      // Write length header (4 bytes, big-endian)
      const lengthBuf = Buffer.alloc(4);
      lengthBuf.writeUInt32BE(result.buffer.length, 0);

      // Check if response is still writable
      if (!res.writableEnded) {
        res.write(lengthBuf);
        res.write(result.buffer);
      }
    } else if (result && result.buffer === null) {
      hasAnyNull = true;
    }
  }

  // If all sentences returned null (client-side fallback was triggered mid-stream),
  // we still need to end the response properly
  if (!res.writableEnded) {
    const endSignal = Buffer.alloc(4, 0);
    res.write(endSignal);
    res.end();
  }

  if (hasAnyNull && fullAudioParts.length === 0) {
    return null; // All sentences needed client-side fallback
  }

  return Buffer.concat(fullAudioParts);
}

/**
 * Synthesize full text to a single MP3 buffer (non-streaming).
 * Returns null if active engine is client-side.
 */
async function synthesizeFull(text, language = "English") {
  const activeService = await configService.getActiveTtsService();
  if (configService.isClientSideService(activeService)) {
    return null;
  }

  const sentences = splitSentences(text);
  if (sentences.length === 0) return Buffer.alloc(0);

  const results = await Promise.allSettled(
    sentences.map((s) => synthesizeSentenceSafe(s, language)),
  );

  const buffers = [];
  results.forEach((result, i) => {
    if (
      result.status === "fulfilled" &&
      result.value &&
      result.value.length > 0
    ) {
      buffers.push(result.value);
    } else if (result.status === "rejected") {
      console.error(
        `[TTS] Full synthesis — sentence ${i} failed:`,
        result.reason?.message,
      );
    }
  });

  if (buffers.length === 0) return null;
  return Buffer.concat(buffers);
}

// ─── Health / Stats ─────────────────────────────────────────────────────────────

async function getStats() {
  const activeService = await configService.getActiveTtsService();
  return {
    activeService,
    cacheSize: audioCache.size,
    cacheMaxSize: CONFIG.cacheMaxEntries,
    poolSize: CONFIG.poolSize,
    maxConcurrent: CONFIG.maxConcurrent,
    voice: CONFIG.voice,
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  streamTtsChunks,
  synthesizeSentenceSafe,
  synthesizeSentenceEdge,
  synthesizeSentenceGoogle,
  synthesizeFull,
  splitSentences,
  getStats,
  CONFIG,
};
