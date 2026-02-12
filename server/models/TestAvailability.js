const mongoose = require("mongoose");

const testAvailabilitySchema = new mongoose.Schema({
  // We don't need institutionId here anymore because the DB itself IS the institution
  testId: { type: String, required: true, index: true }, 
  date: { type: String, required: true, index: true }, // Format: "YYYY-MM-DD"
  
  count: { type: Number, default: 0 },
  dailyLimit: { type: Number, required: true } // Snapshot of limit
}, { timestamps: true });

// Ensure unique entry per test per day
testAvailabilitySchema.index({ testId: 1, date: 1 }, { unique: true });

module.exports = testAvailabilitySchema;