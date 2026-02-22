const mongoose = require("mongoose");
require("dotenv").config({
  path: "/Users/harshithprathi/Zinterview/mockmate-ai/backend/.env",
});

const Interview = require("/Users/harshithprathi/Zinterview/mockmate-ai/backend/models/Interview.js");
const Conversation = require("/Users/harshithprathi/Zinterview/mockmate-ai/backend/models/Conversation.js");

const verifyDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    // Fetch the most recent interview
    const recentInterview = await Interview.findOne().sort({ date: -1 });

    if (!recentInterview) {
      console.log("No interviews found.");
      return;
    }

    console.log("--- Recent Interview ---");
    console.log("ID:", recentInterview._id);
    console.log("Role:", recentInterview.role);
    console.log("Recoding Count:", recentInterview.audioRecordings?.length);
    console.log(
      "AudioRecording linking:",
      recentInterview.audioRecordings?.map((r) => ({
        interactionId: r.interactionId || "none",
        historyId: r.historyId || "none",
        questionIndex: r.questionIndex,
      })) || "None",
    );
    console.log("History Length:", recentInterview.history?.length);
    console.log(
      "History Sample (Last item):",
      recentInterview.history?.length > 0
        ? JSON.stringify(
            recentInterview.history[recentInterview.history.length - 1],
            null,
            2,
          )
        : "Empty",
    );

    // Fetch conversations for this interview
    const conversations = await Conversation.find({
      interviewId: recentInterview._id,
    }).sort({ createdAt: 1 });
    console.log("\n--- Conversations ---");
    console.log("Count:", conversations.length);
    if (conversations.length > 0) {
      conversations.forEach((c, i) => {
        console.log(
          `[${i}] Role: ${c.role}, Content: ${c.content?.substring(0, 50)}...`,
        );
        if (c.audioUrl) console.log(`    AudioURL: ${c.audioUrl}`);
        if (c.s3Key) console.log(`    S3Key: ${c.s3Key}`);
      });
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected");
  }
};

verifyDB();
