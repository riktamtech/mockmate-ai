/**
 * Skill Normalisation Service — Semantic capability with LLM Resolution.
 *
 * Uses MongoDB to cache parent/child skill aliases.
 * When a completely unknown skill is encountered, it uses Gemini to semantically
 * resolve the industry-standard canonical name (e.g. "AWS" -> "Amazon Web Services").
 */

const { GoogleGenAI } = require("@google/genai");
const SkillMap = require("../models/SkillMap");

const PARSING_MODEL = "gemini-2.0-flash";

const getGenAI = () =>
  new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "" });

/**
 * Normalise a skill name to its canonical form from the database.
 * If no mapping exists, uses AI to semantically resolve the parent name.
 *
 * @param {string} rawSkillName - The raw skill name to normalise
 * @returns {Promise<string>} The canonical parent skill name
 */
async function normaliseSkill(rawSkillName) {
  if (!rawSkillName || typeof rawSkillName !== "string" || !rawSkillName.trim()) {
    return rawSkillName;
  }
  
  const trimmed = rawSkillName.trim();
  const lowercased = trimmed.toLowerCase();

  try {
    // 1. Fast path: Check if it exists in any children array
    let skillMap = await SkillMap.findOne({ children: lowercased });
    if (skillMap) {
      return skillMap.parentSkill;
    }

    // 2. Check if it matches a parentSkill exactly (case-insensitive)
    skillMap = await SkillMap.findOne({ parentSkill: new RegExp(`^${lowercased}$`, "i") });
    if (skillMap) {
      if (!skillMap.children.includes(lowercased)) {
        skillMap.children.push(lowercased);
        await skillMap.save();
      }
      return skillMap.parentSkill;
    }

    // 3. Completely new skill. Use semantic LLM resolution to find true canonical parent.
    const resolvedCanonical = await _resolveCanonicalNameWithAI(trimmed);
    const resolvedLower = resolvedCanonical.toLowerCase();

    // The AI gave us a canonical name. See if THAT already exists in the DB.
    skillMap = await SkillMap.findOne({ parentSkill: new RegExp(`^${resolvedLower}$`, "i") });
    
    if (skillMap) {
      // The parent exists, but it didn't know about our original raw alias. Teach it.
      if (!skillMap.children.includes(lowercased)) {
        skillMap.children.push(lowercased);
        await skillMap.save();
      }
      return skillMap.parentSkill;
    }

    // The resolved canonical name is completely new to our system.
    // Ensure we don't insert duplicate children.
    const newChildren = [...new Set([lowercased, resolvedLower])];

    skillMap = await SkillMap.create({
      parentSkill: resolvedCanonical,
      children: newChildren
    });

    return skillMap.parentSkill;

  } catch (err) {
    if (err.code === 11000) {
      const existing = await SkillMap.findOne({ children: lowercased }) || 
                       await SkillMap.findOne({ parentSkill: new RegExp(`^${lowercased}$`, "i") });
      if (existing) {
        return existing.parentSkill;
      }
    }
    console.error(`[SkillNormalisation] Error normalising skill "${rawSkillName}":`, err.message);
    return trimmed;
  }
}

/**
 * Bulk normalisation of skills. Optimized to fetch known aliases in one query.
 * Any missing skills are processed through the AI pipeline individually.
 */
async function normaliseSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return [];
  
  const uniqueRaw = [...new Set(skills.filter(s => s && typeof s === "string" && s.trim()))];
  if (uniqueRaw.length === 0) return [];

  const keysTrimmed = uniqueRaw.map(s => s.trim());
  const keysLower = keysTrimmed.map(s => s.toLowerCase());

  const docs = await SkillMap.find({ children: { $in: keysLower } });
  
  const map = new Map();
  docs.forEach(doc => {
    doc.children.forEach(child => {
      map.set(child, doc.parentSkill);
    });
  });

  const normalised = [];
  
  // We will run the missing items through the AI concurrently (Promise.all)
  // to prevent a waterfall of slow LLM requests.
  const promises = keysTrimmed.map(async (raw, i) => {
    const key = keysLower[i];
    if (map.has(key)) {
      return map.get(key);
    } else {
      return await normaliseSkill(raw);
    }
  });

  const resolved = await Promise.all(promises);

  return [...new Set(resolved)];
}

/**
 * Uses Gemini to semantically resolve an unrecognised skill to its canonical name.
 */
async function _resolveCanonicalNameWithAI(rawName) {
  try {
    const genAI = getGenAI();
    const prompt = `You are an expert technical skills taxonomist. Given the raw text "${rawName}", your task is to identify the industry-standard canonical name for this skill.

Rules:
1. Fix abbreviations and casing (e.g. "aws" -> "Amazon Web Services", "js" -> "JavaScript", "k8s" -> "Kubernetes", "react native" -> "React Native").
2. Only output the canonical skill name, with proper capitalization.
3. DO NOT output any extra text, explanations, code blocks, or markdown. Just the name.
4. If the input is already the canonical name or cannot be confidently mapped to a broader technology, output the input exactly but with proper capitalization.`;

    const response = await genAI.models.generateContent({
      model: PARSING_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1, // Low temp for deterministic taxonomy
        maxOutputTokens: 20,
      },
    });

    const output = (response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    
    // Ensure it's not empty and stripped of anything weird
    if (output && output.length < 50) {
      return output.replace(/^["']|["']$/g, ""); // Strip surrounding quotes if the LLM added them
    }
    return rawName;
  } catch (err) {
    console.warn(`[SkillNormalisation] AI resolution failed for "${rawName}":`, err.message);
    return rawName; // Fallback to raw name if the LLM call fails
  }
}

module.exports = {
  normaliseSkill,
  normaliseSkills,
};
