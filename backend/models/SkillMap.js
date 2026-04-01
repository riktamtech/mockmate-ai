const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * SkillMap Schema
 * 
 * Dynamic collection of skills mapped to their canonical parent names.
 * Ensures consistent skill naming across the platform dynamically.
 */
const SkillMapSchema = new Schema(
  {
    parentSkill: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    children: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
  },
  { timestamps: true }
);

// Ensure the children array can be efficiently searched for alias lookups
SkillMapSchema.index({ children: 1 });

module.exports = mongoose.model("SkillMap", SkillMapSchema);
