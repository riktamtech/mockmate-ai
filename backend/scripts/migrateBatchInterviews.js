/**
 * Batch Interview Migration Script
 *
 * Processes N old-format interview records at a time, converting them
 * to the new MessageSchema format with TTS audio generation.
 *
 * Usage:
 *   node scripts/migrateBatchInterviews.js                              # Dry run, 5 records
 *   node scripts/migrateBatchInterviews.js --batch-size=10              # Dry run, 10 records
 *   node scripts/migrateBatchInterviews.js --batch-size=5 --execute     # Execute on 5 records
 *   node scripts/migrateBatchInterviews.js --batch-size=5 --skip=10 --execute  # Skip first 10
 *
 * Logs:
 *   scripts/migration_logs/batch_successes_<timestamp>.json
 *   scripts/migration_logs/batch_failures_<timestamp>.json
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
const DEFAULT_TOTAL_QUESTIONS = 7;

const LOG_DIR = path.resolve(__dirname, "migration_logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Parse CLI args
function parseArg(name, defaultVal) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (arg) return parseInt(arg.split("=")[1], 10);
  return defaultVal;
}

const BATCH_SIZE = parseArg("batch-size", 5);
const SKIP = parseArg("skip", 0);

if (!MONGO_URI) {
  console.error("❌ MONGODB_URL not set in .env");
  process.exit(1);
}

// ─── Helpers (same as migrateOneInterview.js) ────────────────────────

function extractTextFromParts(parts) {
  if (!parts || !Array.isArray(parts)) return "";
  return parts
    .filter((p) => p.text)
    .map((p) => p.text)
    .join(" ")
    .trim();
}

function isOldFormat(item) {
  return item && Array.isArray(item.parts);
}

function hasInlineAudio(item) {
  if (!item.parts) return false;
  return item.parts.some(
    (p) => p.inlineData && p.inlineData.data && p.inlineData.data.length > 100,
  );
}

function extractSpeakableText(content) {
  if (!content) return "";
  try {
    const parsed = JSON.parse(content);
    if (parsed.response) return parsed.response;
  } catch (_) {}
  return content;
}

function assignQuestionIndices(historyItems) {
  let currentQuestion = 0;
  const indices = [];

  for (let i = 0; i < historyItems.length; i++) {
    const item = historyItems[i];

    if (i === 0 && item.role === "user") {
      indices.push(undefined);
      continue;
    }

    if (item.role === "model") {
      if (i === 1) {
        currentQuestion = 1;
      } else {
        const prevItem = historyItems[i - 1];
        if (prevItem && prevItem.role === "user") {
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
      indices.push(currentQuestion);
    }
  }

  return indices;
}

function computeTotalQuestions(status, historyItems, audioRecordingsCount) {
  let answeredCount = audioRecordingsCount;
  if (answeredCount === 0) {
    answeredCount = historyItems.filter(
      (item, idx) => item.role === "user" && idx > 0,
    ).length;
  }

  if (status === "COMPLETED") {
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
    return answeredCount || DEFAULT_TOTAL_QUESTIONS;
  }

  // IN_PROGRESS
  if (answeredCount >= DEFAULT_TOTAL_QUESTIONS) {
    return answeredCount + 3;
  }
  return DEFAULT_TOTAL_QUESTIONS;
}

// ─── Single Record Migration (core logic) ────────────────────────────

async function migrateOneRecord(interviewsColl, interview) {
  const interviewId = interview._id.toString();
  const history = interview.history || [];

  if (history.length === 0) {
    return { status: "SKIPPED", interviewId, reason: "No history items" };
  }

  // Check if already migrated
  const firstItem = history[0];
  const alreadyMigrated =
    firstItem &&
    typeof firstItem === "object" &&
    firstItem.role &&
    firstItem.content !== undefined &&
    !firstItem.parts;

  if (alreadyMigrated) {
    if (
      interview.totalQuestions !== undefined &&
      interview.totalQuestions !== null
    ) {
      return {
        status: "SKIPPED",
        interviewId,
        reason: "Already in new format",
      };
    }
  }

  const questionIndices = assignQuestionIndices(history);
  const language = interview.language || "English";
  const newHistory = [];
  const ttsResults = [];
  const errors = [];

  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    const qIndex = questionIndices[i];

    // Already migrated item — just ensure fields
    if (!isOldFormat(item) && item.content !== undefined) {
      const msg = { ...item };
      if (qIndex !== undefined && !msg.questionIndex)
        msg.questionIndex = qIndex;
      if (!msg.audioDurationSeconds) msg.audioDurationSeconds = 0;
      if (!msg.interactionId) msg.interactionId = uuidv4();
      if (!msg.timestamp) {
        msg.timestamp = item._id
          ? new mongoose.Types.ObjectId(item._id).getTimestamp()
          : new Date();
      }
      newHistory.push(msg);
      continue;
    }

    // ── Old format conversion ──────
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

    if (qIndex !== undefined) msg.questionIndex = qIndex;

    // User message: link to audioRecording
    if (item.role === "user" && i > 0) {
      const matchingRecording = (interview.audioRecordings || []).find(
        (rec) => rec.questionIndex === qIndex,
      );
      if (matchingRecording) {
        msg.audioS3Key = matchingRecording.s3Key;
        msg.audioMimeType = matchingRecording.mimeType || "audio/webm";
      } else if (hasInlineAudio(item)) {
        const audioPart = item.parts.find((p) => p.inlineData);
        msg.audioMimeType = audioPart?.inlineData?.mimeType || "audio/webm";
      } else if (textContent && textContent.trim().length > 0) {
        // ── No audio found — generate TTS from user's text answer ──
        const isPlaceholder =
          textContent ===
            "Please evaluate my answer and ask the next question." ||
          textContent === "🎤 Audio Answer Submitted";

        if (!isPlaceholder) {
          try {
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
                    type: "user_text_tts",
                  });
                }
              } else {
                errors.push({
                  historyIndex: i,
                  error: "TTS returned empty buffer for user text",
                  type: "user_text_tts",
                });
              }
            }
          } catch (err) {
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

    // Model message: generate TTS
    if (item.role === "model") {
      const speakableText = extractSpeakableText(textContent);

      if (speakableText && speakableText.length > 0) {
        try {
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
                });
              }
            } else {
              errors.push({
                historyIndex: i,
                error: "TTS returned empty buffer",
              });
            }
          }
        } catch (err) {
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

  // Compute totalQuestions
  const totalQuestions = computeTotalQuestions(
    interview.status,
    history,
    (interview.audioRecordings || []).length,
  );

  // Update audioRecordings
  const newAudioRecordings = (interview.audioRecordings || []).map((rec) => {
    const updated = { ...rec };
    const matchingMsg =
      newHistory.find(
        (msg) =>
          msg.role === "user" &&
          msg.questionIndex === rec.questionIndex &&
          msg.audioS3Key === rec.s3Key,
      ) ||
      newHistory.find(
        (msg) => msg.role === "user" && msg.questionIndex === rec.questionIndex,
      );

    if (matchingMsg) {
      updated.historyId = matchingMsg._id.toString();
      updated.interactionId = matchingMsg.interactionId;
    }
    return updated;
  });

  // Save
  if (!DRY_RUN) {
    await interviewsColl.updateOne(
      { _id: interview._id },
      {
        $set: {
          history: newHistory,
          audioRecordings: newAudioRecordings,
          totalQuestions,
          updatedAt: new Date(),
        },
      },
    );
  }

  return {
    status: errors.length > 0 ? "PARTIAL_SUCCESS" : "SUCCESS",
    interviewId,
    originalStatus: interview.status,
    historyConverted: newHistory.length,
    totalQuestions,
    ttsGenerated: ttsResults.length,
    audioRecordingsLinked: newAudioRecordings.filter((r) => r.historyId).length,
    errors,
    ttsResults,
  };
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n🔧 Batch Interview Migration (${DRY_RUN ? "DRY RUN" : "EXECUTING"})`,
  );
  console.log("=".repeat(60));
  console.log(`Batch size: ${BATCH_SIZE} | Skip: ${SKIP}`);
  console.log();

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const db = mongoose.connection.db;
  const interviewsColl = db.collection("interviews");

  // Find old-format interviews:
  // Old format has `parts` array in history items, or is missing totalQuestions
  const allInterviews = await interviewsColl
    .find({})
    .project({
      _id: 1,
      status: 1,
      language: 1,
      totalQuestions: 1,
      history: 1,
      audioRecordings: 1,
    })
    .sort({ date: 1 })
    .skip(SKIP)
    .limit(BATCH_SIZE)
    .toArray();

  // Filter to only those needing migration
  const needsMigration = allInterviews.filter((interview) => {
    const history = interview.history || [];
    if (history.length === 0) return false;

    const firstItem = history[0];
    // Has old-format parts array
    if (firstItem.parts) return true;
    // Missing totalQuestions
    if (
      interview.totalQuestions === undefined ||
      interview.totalQuestions === null
    )
      return true;
    // audioRecordings missing historyId
    if (
      interview.audioRecordings &&
      interview.audioRecordings.length > 0 &&
      !interview.audioRecordings[0].historyId
    )
      return true;

    return false;
  });

  console.log(
    `Found ${allInterviews.length} interviews in range, ${needsMigration.length} need migration\n`,
  );

  const successes = [];
  const failures = [];
  let skipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < needsMigration.length; i++) {
    const interview = needsMigration[i];
    const id = interview._id.toString();
    console.log(
      `[${i + 1}/${needsMigration.length}] Processing ${id} (status: ${interview.status})...`,
    );

    try {
      const result = await migrateOneRecord(interviewsColl, interview);

      if (result.status === "SKIPPED") {
        skipped++;
        console.log(`  ⏭ Skipped: ${result.reason}`);
      } else if (
        result.status === "SUCCESS" ||
        result.status === "PARTIAL_SUCCESS"
      ) {
        successes.push(result);
        const emoji = result.status === "SUCCESS" ? "✓" : "⚠";
        console.log(
          `  ${emoji} ${result.status}: ${result.historyConverted} msgs, ${result.ttsGenerated} TTS, totalQ=${result.totalQuestions}`,
        );
        if (result.errors.length > 0) {
          console.log(`  ⚠ ${result.errors.length} non-fatal error(s)`);
        }
      }
    } catch (err) {
      const failureRecord = {
        interviewId: id,
        error: err.message,
        stack: err.stack,
        rawHistory: interview.history
          ? interview.history.map((h) => ({
              role: h.role,
              partsCount: h.parts ? h.parts.length : 0,
              hasContent: !!h.content,
              _id: h._id?.toString(),
            }))
          : [],
        audioRecordingsCount: (interview.audioRecordings || []).length,
        status: interview.status,
      };
      failures.push(failureRecord);
      console.error(`  ✗ FAILED: ${err.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // ── Summary ──────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("MIGRATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Total in range:   ${allInterviews.length}`);
  console.log(`  Needed migration: ${needsMigration.length}`);
  console.log(`  Successful:       ${successes.length}`);
  console.log(`  Skipped:          ${skipped}`);
  console.log(`  Failed:           ${failures.length}`);
  console.log(`  Time:             ${elapsed}s`);

  if (DRY_RUN) {
    console.log(
      "\n⚠ DRY RUN — no changes were made. Run with --execute to apply.",
    );
  }

  // ── Write log files ──────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (successes.length > 0) {
    const successFile = path.join(LOG_DIR, `batch_successes_${timestamp}.json`);
    fs.writeFileSync(successFile, JSON.stringify(successes, null, 2));
    console.log(`\n📄 Success log: ${successFile}`);
  }

  if (failures.length > 0) {
    const failureFile = path.join(LOG_DIR, `batch_failures_${timestamp}.json`);
    fs.writeFileSync(failureFile, JSON.stringify(failures, null, 2));
    console.log(`📄 Failure log: ${failureFile}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
