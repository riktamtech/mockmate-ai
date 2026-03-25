/**
 * compressionUtils — Zlib compression helpers for large text fields.
 *
 * Uses Node.js built-in zlib (deflate/inflate) to compress text before
 * storing in MongoDB. Output is Base64-encoded for safe string storage.
 *
 * Typical compression ratios on natural language text: 70–85%.
 */

const zlib = require("zlib");

/**
 * Compress a text string → Base64-encoded deflated string.
 * @param {string} text - Raw text to compress
 * @returns {string} Base64-encoded compressed data
 */
function compressText(text) {
  if (!text || typeof text !== "string") return "";
  try {
    const buffer = zlib.deflateSync(Buffer.from(text, "utf-8"), { level: 6 });
    return buffer.toString("base64");
  } catch (err) {
    console.error("compressText error:", err.message);
    return "";
  }
}

/**
 * Decompress a Base64-encoded deflated string → original text.
 * @param {string} compressed - Base64-encoded compressed data
 * @returns {string} Original text
 */
function decompressText(compressed) {
  if (!compressed || typeof compressed !== "string") return "";
  try {
    const buffer = zlib.inflateSync(Buffer.from(compressed, "base64"));
    return buffer.toString("utf-8");
  } catch (err) {
    console.error("decompressText error:", err.message);
    return "";
  }
}

module.exports = { compressText, decompressText };
