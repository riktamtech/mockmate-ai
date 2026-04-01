require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const interviewRoutes = require("./routes/interviewRoutes");
const aiRoutes = require("./routes/aiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const audioRoutes = require("./routes/audioRoutes");
const userRoutes = require("./routes/userRoutes");
const proctoredInterviewRoutes = require("./routes/proctoredInterviewRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const {
  globalLimiter,
  authLimiter,
  aiLimiter,
  proctoredLimiter,
} = require("./middleware/rateLimitMiddleware");

const app = express();
app.disable("x-powered-by");

// Trust proxy for correct client IP behind reverse proxies (e.g., Nginx, AWS ELB)
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Rate Limiting — applied before routes
app.use(globalLimiter);

// Database Connection
mongoose
  .connect(process.env.MONGODB_URL || "mongodb://localhost:27017/mockmate")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Routes (with per-group rate limiters)
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/audio", aiLimiter, audioRoutes);
app.use("/api/user", userRoutes);
app.use("/api/proctored", proctoredLimiter, proctoredInterviewRoutes);
app.use("/api/jobs", require("./routes/jobRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/events", require("./routes/eventsRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/applications", require("./routes/applicationRoutes"));
app.use("/api/fitness", require("./routes/fitnessRoutes"));
app.use("/api/centralised-resume", require("./routes/centralisedResumeRoutes"));
app.use("/api/recruiter", require("./routes/recruiterRoutes"));

// Health Check
app.get("/", (req, res) => {
  res.send("MockMate AI Backend Running");
});

// Error handling — notFound must come after all routes, errorHandler last
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
