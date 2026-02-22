/**
 * Migration Script: Conversations → Embedded Interview History
 *
 * Converts all interviews from the old format (ObjectId references to Conversation collection)
 * to the new format (embedded MessageSchema objects in Interview.history).
 *
 * Usage:
 *   node scripts/migrateConversationsToEmbedded.js              # Dry run
 *   node scripts/migrateConversationsToEmbedded.js --execute    # Actual migration
 *
 * What it does:
 *   1. For each interview with ObjectId-based history entries, fetches the
 *      corresponding Conversation documents.
 *   2. Converts each Conversation to a MessageSchema-compatible object
 *      (content, audioS3Key, audioMimeType, etc.) — strips raw audio data.
 *   3. Handles legacy embedded history objects (role + parts) similarly.
 *   4. Replaces Interview.history with the new embedded array.
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;
const DRY_RUN = !process.argv.includes("--execute");

if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

async function main() {
  console.log(
    `\n🔧 Migration: Conversations → Embedded History (${DRY_RUN ? "DRY RUN" : "EXECUTING"})`,
  );
  console.log("=".repeat(60));

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const interviewsColl = db.collection("interviews");
  const conversationsColl = db.collection("conversations");

  // Check if conversations collection exists
  const collections = await db
    .listCollections({ name: "conversations" })
    .toArray();
  const hasConversations = collections.length > 0;

  if (hasConversations) {
    const totalConversations = await conversationsColl.countDocuments();
    console.log(
      `Found ${totalConversations} documents in conversations collection`,
    );
  } else {
    console.log(
      "No conversations collection found — will only handle legacy embedded objects",
    );
  }

  const interviews = await interviewsColl
    .find({})
    .project({ _id: 1, history: 1, transcriptions: 1 })
    .toArray();

  console.log(`Found ${interviews.length} interviews to process\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const interview of interviews) {
    try {
      const history = interview.history || [];

      if (history.length === 0) {
        skippedCount++;
        continue;
      }

      // Check if already migrated (new format has 'content' and 'role' fields)
      const firstItem = history[0];
      const isAlreadyMigrated =
        firstItem &&
        typeof firstItem === "object" &&
        firstItem.role &&
        firstItem.content !== undefined &&
        !firstItem.parts;

      if (isAlreadyMigrated) {
        skippedCount++;
        continue;
      }

      // Determine if history contains ObjectIds or legacy objects
      const hasObjectIds = history.some(
        (item) => mongoose.isValidObjectId(item) && typeof item !== "object",
      );
      const hasLegacyObjects = history.some(
        (item) => typeof item === "object" && item !== null && item.role,
      );

      let newHistory = [];

      if (hasObjectIds && hasConversations) {
        // Fetch conversations for ObjectId references
        const objectIds = history
          .filter(
            (item) =>
              mongoose.isValidObjectId(item) && typeof item !== "object",
          )
          .map((id) => new mongoose.Types.ObjectId(id));

        const conversations = await conversationsColl
          .find({ _id: { $in: objectIds } })
          .sort({ createdAt: 1 })
          .toArray();

        const convMap = new Map(
          conversations.map((c) => [c._id.toString(), c]),
        );

        for (const item of history) {
          if (typeof item === "object" && item !== null && item.role) {
            // Legacy embedded object
            newHistory.push(convertLegacyItem(item));
          } else if (mongoose.isValidObjectId(item)) {
            const conv = convMap.get(item.toString());
            if (conv) {
              newHistory.push(convertConversation(conv));
            }
          }
        }
      } else if (hasLegacyObjects) {
        // All legacy embedded objects
        for (const item of history) {
          if (typeof item === "object" && item !== null && item.role) {
            newHistory.push(convertLegacyItem(item));
          }
        }
      } else {
        skippedCount++;
        continue;
      }

      if (newHistory.length === 0) {
        console.log(
          `  ⚠ Interview ${interview._id}: No valid history items found`,
        );
        skippedCount++;
        continue;
      }

      console.log(
        `  ${DRY_RUN ? "[DRY]" : "[EXEC]"} Interview ${interview._id}: ${history.length} items → ${newHistory.length} embedded messages`,
      );

      if (!DRY_RUN) {
        await interviewsColl.updateOne(
          { _id: interview._id },
          {
            $set: {
              history: newHistory,
              updatedAt: new Date(),
            },
          },
        );
      }

      migratedCount++;
    } catch (err) {
      console.error(`  ✗ Interview ${interview._id}: ${err.message}`);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Results:`);
  console.log(`  Migrated: ${migratedCount}`);
  console.log(`  Skipped (already migrated or empty): ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);

  if (DRY_RUN) {
    console.log("\n⚠  DRY RUN — no changes made. Run with --execute to apply.");
  } else {
    console.log("\n✓ Migration complete!");
  }

  await mongoose.disconnect();
}

function convertConversation(conv) {
  const msg = {
    _id: new mongoose.Types.ObjectId(),
    role: conv.role || "user",
    content: conv.content || extractTextFromParts(conv.parts),
    timestamp: conv.createdAt || new Date(),
  };

  // S3 key for audio
  if (conv.s3Key) {
    msg.audioS3Key = conv.s3Key;
    msg.audioMimeType = conv.contentType || "audio/webm";
  }

  // Metadata
  if (conv.metadata) {
    const meta =
      conv.metadata instanceof Map
        ? Object.fromEntries(conv.metadata)
        : conv.metadata;

    if (meta.questionIndex) {
      msg.questionIndex = Number(meta.questionIndex);
    }
    if (meta.durationSeconds) {
      msg.audioDurationSeconds = Number(meta.durationSeconds);
    }
    // Keep other metadata
    msg.metadata = {};
    for (const [k, v] of Object.entries(meta)) {
      if (k !== "questionIndex" && k !== "durationSeconds") {
        msg.metadata[k] = String(v);
      }
    }
  }

  return msg;
}

function convertLegacyItem(item) {
  const msg = {
    _id: new mongoose.Types.ObjectId(),
    role: item.role,
    content: extractTextFromParts(item.parts),
    timestamp: item.createdAt || item.timestamp || new Date(),
  };

  // Check for S3 key in legacy format
  if (item.s3Key) {
    msg.audioS3Key = item.s3Key;
    msg.audioMimeType = item.contentType || "audio/webm";
  }

  // Check for audio in parts (inlineData with S3 key reference)
  if (item.parts) {
    for (const part of item.parts) {
      if (part.inlineData) {
        // If the data looks like an S3 key (not base64), keep it
        if (
          part.inlineData.data &&
          part.inlineData.data.includes("/") &&
          !part.inlineData.data.includes("=")
        ) {
          msg.audioS3Key = part.inlineData.data;
          msg.audioMimeType = part.inlineData.mimeType || "audio/webm";
        }
        // Don't store raw base64 audio data
      }
    }
  }

  return msg;
}

function extractTextFromParts(parts) {
  if (!parts || !Array.isArray(parts)) return "";
  const textParts = parts.filter((p) => p.text).map((p) => p.text);
  return textParts.join(" ").trim();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
