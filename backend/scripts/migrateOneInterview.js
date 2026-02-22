/**
 * Single Interview Migration Script
 *
 * Converts ONE old-format interview record to the new MessageSchema format.
 * Use this to test the migration on a single record before running the batch script.
 *
 * Usage:
 *   node scripts/migrateOneInterview.js <interviewId>              # Dry run (no DB writes)
 *   node scripts/migrateOneInterview.js <interviewId> --execute    # Actually save to DB
 *
 * Logs are written to scripts/migration_logs/single_<id>_<timestamp>.json
 */

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// ─── Services ────────────────────────────────────────────────────────
const ttsService = require("../services/ttsService");
const { uploadAIResponseAudio } = require("../services/s3Service");

// ─── Config ──────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URL;
const DRY_RUN = !process.argv.includes("--execute");
const INTERVIEW_ID = process.argv[2];
const DEFAULT_TOTAL_QUESTIONS = 7;

const LOG_DIR = path.resolve(__dirname, "migration_logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

if (!MONGO_URI) {
  console.error("❌ MONGODB_URL not set in .env");
  process.exit(1);
}

if (!INTERVIEW_ID || INTERVIEW_ID.startsWith("--")) {
  console.error(
    "❌ Usage: node scripts/migrateOneInterview.js <interviewId> [--execute]",
  );
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Extract text content from legacy `parts` array.
 */
function extractTextFromParts(parts) {
  if (!parts || !Array.isArray(parts)) return "";
  return parts
    .filter((p) => p.text)
    .map((p) => p.text)
    .join(" ")
    .trim();
}

/**
 * Check if a history item is in old format (has `parts` array).
 */
function isOldFormat(item) {
  return item && Array.isArray(item.parts);
}

/**
 * Check if a history item has inline audio data in parts.
 */
function hasInlineAudio(item) {
  if (!item.parts) return false;
  return item.parts.some(
    (p) => p.inlineData && p.inlineData.data && p.inlineData.data.length > 500,
  );
}

/**
 * Extract the spoken text from a model response for TTS.
 * Model responses are JSON with a `response` field.
 */
function extractSpeakableText(content) {
  if (!content) return "";
  try {
    const parsed = JSON.parse(content);
    if (parsed.response) return parsed.response;
  } catch (_) {
    // Not JSON — use raw text
  }
  return content;
}

/**
 * Determine question indices for history items.
 * Logic:
 *   - First user message (system prompt) → no questionIndex
 *   - First model reply → questionIndex = 1
 *   - User answer to Q1 → questionIndex = 1
 *   - Next model question → questionIndex = 2
 *   - ...and so on
 */
function assignQuestionIndices(historyItems) {
  let currentQuestion = 0;
  const indices = [];

  for (let i = 0; i < historyItems.length; i++) {
    const item = historyItems[i];

    if (i === 0 && item.role === "user") {
      // First user message is the system prompt — no questionIndex
      indices.push(undefined);
      continue;
    }

    if (item.role === "model") {
      // Model responses increment the question counter
      // unless it's a follow-up to the same question
      if (i === 1) {
        // First model response after system prompt
        currentQuestion = 1;
      } else {
        // Check if previous item was a user answer (meaning we're moving to next Q)
        const prevItem = historyItems[i - 1];
        if (prevItem && prevItem.role === "user") {
          // Previous user answered, check if this model is asking a NEW question
          // Parse model content to see if questionNumber changed
          const text = extractTextFromParts(item.parts) || item.content || "";
          try {
            const parsed = JSON.parse(text);
            if (parsed.questionNumber !== undefined) {
              currentQuestion = parsed.questionNumber;
            } else {
              currentQuestion++;
            }
          } catch (_) {
            currentQuestion++;
          }
        }
      }
      indices.push(currentQuestion);
    } else {
      // User messages get the current question index
      indices.push(currentQuestion);
    }
  }

  return indices;
}

/**
 * Compute totalQuestions for the interview.
 *
 * - COMPLETED: parse from last model message's questionNumber, or count unique model questionIndices
 * - IN_PROGRESS: use default (7), or if answered > default → answered + 3
 */
function computeTotalQuestions(status, historyItems, audioRecordingsCount) {
  // Count answered questions
  let answeredCount = audioRecordingsCount;
  if (answeredCount === 0) {
    // Count user history items that have audio (i.e., not the initial system prompt)
    answeredCount = historyItems.filter(
      (item, idx) => item.role === "user" && idx > 0, // Skip the first system prompt
    ).length;
  }

  if (status === "COMPLETED") {
    // Try to get from last model message
    const modelMessages = [...historyItems].reverse();
    for (const msg of modelMessages) {
      if (msg.role === "model") {
        const text = extractTextFromParts(msg.parts) || msg.content || "";
        try {
          const parsed = JSON.parse(text);
          if (parsed.questionNumber !== undefined) {
            return parsed.questionNumber;
          }
        } catch (_) {}
      }
    }
    // Fallback: count unique question indices from model messages
    return answeredCount || DEFAULT_TOTAL_QUESTIONS;
  }

  // IN_PROGRESS
  if (answeredCount >= DEFAULT_TOTAL_QUESTIONS) {
    return answeredCount + 3;
  }
  return DEFAULT_TOTAL_QUESTIONS;
}

// ─── Main Migration Logic ────────────────────────────────────────────

async function migrateInterview(interviewId) {
  const db = mongoose.connection.db;
  const interviewsColl = db.collection("interviews");

  // 1. Load the raw document (bypassing Mongoose schema validation)
  const interview = await interviewsColl.findOne({
    _id: new mongoose.Types.ObjectId(interviewId),
  });

  if (!interview) {
    throw new Error(`Interview ${interviewId} not found`);
  }

  const history = interview.history || [];
  if (history.length === 0) {
    return { status: "SKIPPED", reason: "No history items" };
  }

  // 2. Check if already migrated
  const firstItem = history[0];
  const alreadyMigrated =
    firstItem &&
    typeof firstItem === "object" &&
    firstItem.role &&
    firstItem.content !== undefined &&
    !firstItem.parts;

  if (alreadyMigrated) {
    // Check if it also has totalQuestions — if not, still needs partial migration
    if (
      interview.totalQuestions !== undefined &&
      interview.totalQuestions !== null
    ) {
      return { status: "SKIPPED", reason: "Already in new format" };
    }
    console.log(
      "  ℹ History already migrated but missing totalQuestions — will add it",
    );
  }

  // 3. Determine question indices
  const questionIndices = assignQuestionIndices(history);
  const language = interview.language || "English";

  // 4. Convert each history item
  const newHistory = [];
  const ttsResults = [];
  const errors = [];

  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    const qIndex = questionIndices[i];

    // If already migrated (content-based), just ensure fields are present
    if (!isOldFormat(item) && item.content !== undefined) {
      const msg = { ...item };
      if (qIndex !== undefined && !msg.questionIndex) {
        msg.questionIndex = qIndex;
      }
      if (!msg.audioDurationSeconds) {
        msg.audioDurationSeconds = 0;
      }
      if (!msg.interactionId) {
        msg.interactionId = uuidv4();
      }
      if (!msg.timestamp) {
        msg.timestamp = item._id
          ? new mongoose.Types.ObjectId(item._id).getTimestamp()
          : new Date();
      }
      newHistory.push(msg);
      continue;
    }

    // ── Old format conversion ──────────────────────────────────
    const textContent = extractTextFromParts(item.parts);
    const interactionId = uuidv4();

    const msg = {
      _id: item._id || new mongoose.Types.ObjectId(),
      role: item.role,
      content: textContent,
      audioDurationSeconds: 0,
      timestamp: item._id
        ? new mongoose.Types.ObjectId(item._id).getTimestamp()
        : new Date(),
      interactionId,
    };

    if (qIndex !== undefined) {
      msg.questionIndex = qIndex;
    }

    // ── User message: link to existing audioRecording ──────────
    if (item.role === "user" && i > 0) {
      // Find matching audioRecording by questionIndex
      const matchingRecording = (interview.audioRecordings || []).find(
        (rec) => rec.questionIndex === qIndex,
      );

      if (matchingRecording) {
        msg.audioS3Key = matchingRecording.s3Key;
        msg.audioMimeType = matchingRecording.mimeType || "audio/webm";
      } else if (hasInlineAudio(item)) {
        // Has inline audio but no audioRecording — note as warning
        const audioPart = item.parts.find((p) => p.inlineData);
        msg.audioMimeType = audioPart?.inlineData?.mimeType || "audio/webm";
        console.log(
          `  ⚠ User msg index ${i} (Q${qIndex}): has inline audio but no matching audioRecording`,
        );
      } else if (textContent && textContent.trim().length > 0) {
        // ── No audio found — generate TTS from user's text answer ──
        // (text-based interviews or missing audio recordings)
        const isPlaceholder =
          textContent ===
            "Please evaluate my answer and ask the next question." ||
          textContent === "🎤 Audio Answer Submitted";

        if (!isPlaceholder) {
          try {
            console.log(
              `  🔊 Generating TTS for user text msg index ${i} (Q${qIndex}): "${textContent.substring(0, 60)}..."`,
            );

            if (!DRY_RUN) {
              const ttsBuffer = await ttsService.synthesizeFull(
                textContent,
                language,
              );

              if (ttsBuffer && ttsBuffer.length > 0) {
                const uploadResult = await uploadAIResponseAudio(
                  ttsBuffer,
                  interviewId,
                  qIndex || 0,
                  "audio/mp3",
                );

                if (uploadResult && uploadResult.s3Key) {
                  msg.audioS3Key = uploadResult.s3Key;
                  msg.audioMimeType = "audio/mp3";
                  ttsResults.push({
                    historyIndex: i,
                    questionIndex: qIndex,
                    s3Key: uploadResult.s3Key,
                    textLength: textContent.length,
                    type: "user_text_tts",
                  });
                  console.log(
                    `  ✓ User text TTS uploaded: ${uploadResult.s3Key}`,
                  );
                }
              } else {
                console.warn(
                  `  ⚠ TTS returned empty buffer for user msg index ${i}`,
                );
                errors.push({
                  historyIndex: i,
                  error: "TTS returned empty buffer for user text",
                  type: "user_text_tts",
                });
              }
            } else {
              console.log(
                `  [DRY] Would generate TTS for user text (${textContent.length} chars)`,
              );
            }
          } catch (err) {
            console.error(
              `  ✗ User text TTS failed for msg index ${i}: ${err.message}`,
            );
            errors.push({
              historyIndex: i,
              error: err.message,
              stack: err.stack,
              type: "user_text_tts",
            });
          }
        }
      }
    }

    // ── Model message: generate TTS audio ─────────────────────
    if (item.role === "model") {
      const speakableText = extractSpeakableText(textContent);

      if (speakableText && speakableText.length > 0) {
        try {
          console.log(
            `  🔊 Generating TTS for model msg index ${i} (Q${qIndex}): "${speakableText.substring(0, 60)}..."`,
          );

          if (!DRY_RUN) {
            const ttsBuffer = await ttsService.synthesizeFull(
              speakableText,
              language,
            );

            if (ttsBuffer && ttsBuffer.length > 0) {
              const uploadResult = await uploadAIResponseAudio(
                ttsBuffer,
                interviewId,
                qIndex || 0,
                "audio/mp3",
              );

              if (uploadResult && uploadResult.s3Key) {
                msg.audioS3Key = uploadResult.s3Key;
                msg.audioMimeType = "audio/mp3";
                ttsResults.push({
                  historyIndex: i,
                  questionIndex: qIndex,
                  s3Key: uploadResult.s3Key,
                  textLength: speakableText.length,
                });
                console.log(`  ✓ TTS uploaded: ${uploadResult.s3Key}`);
              }
            } else {
              console.warn(`  ⚠ TTS returned empty buffer for msg index ${i}`);
              errors.push({
                historyIndex: i,
                error: "TTS returned empty buffer",
              });
            }
          } else {
            console.log(
              `  [DRY] Would generate TTS (${speakableText.length} chars)`,
            );
          }
        } catch (err) {
          console.error(`  ✗ TTS failed for msg index ${i}: ${err.message}`);
          errors.push({
            historyIndex: i,
            error: err.message,
            stack: err.stack,
          });
        }
      }
    }

    newHistory.push(msg);
  }

  // 5. Compute totalQuestions
  const totalQuestions = computeTotalQuestions(
    interview.status,
    history,
    (interview.audioRecordings || []).length,
  );

  // 6. Update audioRecordings with interactionId + historyId
  const newAudioRecordings = (interview.audioRecordings || []).map((rec) => {
    const updated = { ...rec };

    // Find the matching user history item
    const matchingMsg = newHistory.find(
      (msg) =>
        msg.role === "user" &&
        msg.questionIndex === rec.questionIndex &&
        msg.audioS3Key === rec.s3Key,
    );

    if (matchingMsg) {
      updated.historyId = matchingMsg._id.toString();
      updated.interactionId = matchingMsg.interactionId;
    } else {
      // Try matching by questionIndex alone
      const fallbackMsg = newHistory.find(
        (msg) => msg.role === "user" && msg.questionIndex === rec.questionIndex,
      );
      if (fallbackMsg) {
        updated.historyId = fallbackMsg._id.toString();
        updated.interactionId = fallbackMsg.interactionId;
      }
    }

    return updated;
  });

  // 7. Build the update
  const updatePayload = {
    $set: {
      history: newHistory,
      audioRecordings: newAudioRecordings,
      totalQuestions,
      updatedAt: new Date(),
    },
  };

  // 8. Build migration result
  const result = {
    status: errors.length > 0 ? "PARTIAL_SUCCESS" : "SUCCESS",
    interviewId,
    originalStatus: interview.status,
    historyItemsConverted: newHistory.length,
    totalQuestions,
    ttsGenerated: ttsResults.length,
    audioRecordingsUpdated: newAudioRecordings.filter((r) => r.historyId)
      .length,
    errors,
    ttsResults,
    beforeSummary: {
      historyCount: history.length,
      hadParts: history.some(isOldFormat),
      hadInlineAudio: history.some(hasInlineAudio),
      audioRecordingsCount: (interview.audioRecordings || []).length,
      hadTotalQuestions: interview.totalQuestions !== undefined,
    },
  };

  // 9. Save to DB
  if (!DRY_RUN) {
    await interviewsColl.updateOne(
      { _id: new mongoose.Types.ObjectId(interviewId) },
      updatePayload,
    );
    console.log("  ✓ Saved to database");
  } else {
    console.log("  [DRY RUN] Would save to database");
  }

  return result;
}

// ─── Entry Point ─────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n🔧 Single Interview Migration (${DRY_RUN ? "DRY RUN" : "EXECUTING"})`,
  );
  console.log("=".repeat(60));
  console.log(`Interview ID: ${INTERVIEW_ID}\n`);

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const startTime = Date.now();
  let result;

  try {
    result = await migrateInterview(INTERVIEW_ID);
  } catch (err) {
    result = {
      status: "FAILED",
      interviewId: INTERVIEW_ID,
      error: err.message,
      stack: err.stack,
    };
    console.error(`\n❌ Migration failed: ${err.message}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  result.elapsedSeconds = parseFloat(elapsed);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("Result Summary:");
  console.log(`  Status: ${result.status}`);
  if (result.reason) console.log(`  Reason: ${result.reason}`);
  if (result.historyItemsConverted !== undefined)
    console.log(`  History items converted: ${result.historyItemsConverted}`);
  if (result.totalQuestions !== undefined)
    console.log(`  Total questions: ${result.totalQuestions}`);
  if (result.ttsGenerated !== undefined)
    console.log(`  TTS audio generated: ${result.ttsGenerated}`);
  if (result.audioRecordingsUpdated !== undefined)
    console.log(`  Audio recordings updated: ${result.audioRecordingsUpdated}`);
  if (result.errors && result.errors.length > 0)
    console.log(`  Errors: ${result.errors.length}`);
  console.log(`  Time: ${elapsed}s`);

  if (DRY_RUN) {
    console.log("\n⚠ DRY RUN — no changes made. Run with --execute to apply.");
  }

  // Write log file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = path.join(
    LOG_DIR,
    `single_${INTERVIEW_ID}_${timestamp}.json`,
  );
  fs.writeFileSync(logFile, JSON.stringify(result, null, 2));
  console.log(`\n📄 Log written to: ${logFile}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
