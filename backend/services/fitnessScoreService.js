const mongoose = require("mongoose");

/**
 * Fitness Score Service
 *
 * Computes resume-to-JD match score using Google Gemini LLM.
 * Implements MongoDB TTL caching to avoid redundant LLM calls.
 */

// Simple TTL cache collection
const FitnessScoreCache = mongoose.model(
  "FitnessScoreCache",
  new mongoose.Schema({
    cacheKey: { type: String, unique: true, index: true },
    score: Number,
    breakdown: Object,
    createdAt: { type: Date, default: Date.now, expires: 86400 }, // 24h TTL
  }),
);

function buildCacheKey(resumeId, openingId) {
  return `fitness:${resumeId}:${openingId}`;
}

async function calculateFitnessScore(resumeText, jobDescription, resumeId, openingId) {
  // Check cache first
  const cacheKey = buildCacheKey(resumeId, openingId);
  const cached = await FitnessScoreCache.findOne({ cacheKey }).lean();
  if (cached) {
    return { score: cached.score, breakdown: cached.breakdown, cached: true };
  }

  // Call Gemini API for scoring
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an expert HR recruiter. Analyze the fitness of this resume for the given job description.

Return ONLY a valid JSON object with this exact structure:
{
  "score": <number 0-100>,
  "breakdown": {
    "skillsMatch": <number 0-100>,
    "experienceMatch": <number 0-100>,
    "educationMatch": <number 0-100>,
    "overallFit": <number 0-100>
  },
  "summary": "<one-line summary>"
}

RESUME:
${resumeText?.substring(0, 3000)}

JOB DESCRIPTION:
${jobDescription?.substring(0, 2000)}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse LLM response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const score = Math.max(0, Math.min(100, Math.round(parsed.score || 0)));

    // Cache the result
    await FitnessScoreCache.findOneAndUpdate(
      { cacheKey },
      { cacheKey, score, breakdown: parsed.breakdown || {}, createdAt: new Date() },
      { upsert: true },
    );

    return { score, breakdown: parsed.breakdown, summary: parsed.summary, cached: false };
  } catch (error) {
    console.error("Fitness score calculation error:", error);
    // Fallback: simple keyword matching
    return fallbackScore(resumeText, jobDescription);
  }
}

function fallbackScore(resumeText, jobDescription) {
  if (!resumeText || !jobDescription) return { score: 0, breakdown: {}, cached: false };

  const resumeWords = new Set(resumeText.toLowerCase().split(/\W+/));
  const jdWords = jobDescription.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const uniqueJdWords = [...new Set(jdWords)];

  let matches = 0;
  for (const word of uniqueJdWords) {
    if (resumeWords.has(word)) matches++;
  }

  const score = uniqueJdWords.length > 0
    ? Math.round((matches / uniqueJdWords.length) * 100)
    : 0;

  return { score: Math.min(score, 95), breakdown: { keywordMatch: score }, cached: false };
}

module.exports = { calculateFitnessScore, FitnessScoreCache };
