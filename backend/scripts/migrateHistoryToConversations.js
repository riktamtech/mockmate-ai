/**
 * Migration Script: Move embedded Interview.history to Conversations collection
 *
 * This script converts old-format Interview documents (with embedded history objects)
 * to the new format (history contains only Conversation ObjectIds).
 *
 * Usage:
 *   MONGO_URI=mongodb://... node backend/scripts/migrateHistoryToConversations.js
 *
 * Options:
 *   --dry-run    Preview changes without writing to DB
 *   --batch=N    Process N interviews at a time (default: 50)
 *
 * IMPORTANT: Back up your database before running this script!
 */

const mongoose = require("mongoose");

// ── Config ──────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/mockmate";
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = (() => {
  const arg = process.argv.find((a) => a.startsWith("--batch="));
  return arg ? parseInt(arg.split("=")[1], 10) : 50;
})();

// ── Schemas (inline to avoid import issues) ─────────────────────────
const ConversationSchema = new mongoose.Schema({
  interviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Interview",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["user", "model"], required: true },
  content: { type: String },
  parts: [
    {
      text: String,
      inlineData: { mimeType: String, data: String },
    },
  ],
  s3Key: { type: String },
  contentType: { type: String },
  audioUrl: { type: String },
  metadata: { type: Map, of: String },
  createdAt: { type: Date, default: Date.now },
});

const InterviewSchema = new mongoose.Schema({}, { strict: false });

const Conversation = mongoose.model("Conversation", ConversationSchema);
const Interview = mongoose.model("Interview", InterviewSchema);

// ── Helpers ─────────────────────────────────────────────────────────
function isOldFormat(interview) {
  if (!interview.history || interview.history.length === 0) return false;
  const first = interview.history[0];
  // Old format: history items are objects with 'role' and 'parts' fields
  // New format: history items are plain ObjectIds
  return typeof first === "object" && first.role && first.parts;
}

function extractTextContent(parts) {
  if (!parts || !Array.isArray(parts)) return "";
  const textPart = parts.find((p) => p.text);
  return textPart ? textPart.text : "";
}

function buildConversationParts(parts) {
  if (!parts || !Array.isArray(parts)) return [];
  return parts.map((p) => {
    const part = {};
    if (p.text) part.text = p.text;
    if (p.inlineData) {
      part.inlineData = {
        mimeType: p.inlineData.mimeType,
        // NOTE: We do NOT migrate raw base64 audio data.
        // Old inline audio data is dropped — it was already processed by Gemini.
        // Only the mimeType is preserved for reference.
        data: "",
      };
    }
    return part;
  });
}

// ── Main Migration ──────────────────────────────────────────────────
async function migrate() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Interview History → Conversations Migration");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log("═══════════════════════════════════════════════\n");

  await mongoose.connect(MONGO_URI);
  console.log(`Connected to: ${MONGO_URI}\n`);

  const totalInterviews = await Interview.countDocuments({});
  console.log(`Total interviews in DB: ${totalInterviews}`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let offset = 0;

  while (offset < totalInterviews) {
    const batch = await Interview.find({})
      .skip(offset)
      .limit(BATCH_SIZE)
      .lean();

    for (const interview of batch) {
      try {
        if (!isOldFormat(interview)) {
          skippedCount++;
          continue;
        }

        const conversationIds = [];

        for (let i = 0; i < interview.history.length; i++) {
          const histItem = interview.history[i];

          const conversationDoc = {
            interviewId: interview._id,
            userId: interview.user,
            role: histItem.role,
            content: extractTextContent(histItem.parts),
            parts: buildConversationParts(histItem.parts),
            s3Key: histItem.s3Key || undefined,
            createdAt: new Date(Date.now() + i), // Ensure ordering
          };

          // Preserve existing conversationId if one was already created
          if (histItem.conversationId) {
            // Check if conversation already exists
            const existing = await Conversation.findById(
              histItem.conversationId,
            );
            if (existing) {
              // Update with parts if missing
              if (!existing.parts || existing.parts.length === 0) {
                if (!DRY_RUN) {
                  await Conversation.findByIdAndUpdate(existing._id, {
                    parts: conversationDoc.parts,
                    s3Key: conversationDoc.s3Key || existing.s3Key,
                  });
                }
              }
              conversationIds.push(existing._id);
              continue;
            }
          }

          if (!DRY_RUN) {
            const created = await Conversation.create(conversationDoc);
            conversationIds.push(created._id);
          } else {
            conversationIds.push(new mongoose.Types.ObjectId());
          }
        }

        // Update interview's history to only contain ObjectIds
        if (!DRY_RUN) {
          await Interview.updateOne(
            { _id: interview._id },
            { $set: { history: conversationIds } },
          );
        }

        migratedCount++;

        if (migratedCount % 10 === 0) {
          console.log(`  Migrated ${migratedCount} interviews...`);
        }
      } catch (err) {
        errorCount++;
        console.error(
          `  ERROR migrating interview ${interview._id}:`,
          err.message,
        );
      }
    }

    offset += BATCH_SIZE;
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Migration Complete");
  console.log(`  Migrated: ${migratedCount}`);
  console.log(`  Skipped:  ${skippedCount} (already new format or empty)`);
  console.log(`  Errors:   ${errorCount}`);
  console.log("═══════════════════════════════════════════════\n");

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
