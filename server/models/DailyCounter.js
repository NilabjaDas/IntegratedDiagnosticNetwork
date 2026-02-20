const mongoose = require("mongoose");

const dailyCounterSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true }, // Format: "YYYY-MM-DD"
  department: { type: String, required: true, index: true }, // e.g., "Pathology"
  sequence_value: { type: Number, default: 0 }
});

// Ensures a unique counter per institution, per day, per department
dailyCounterSchema.index({ institutionId: 1, date: 1, department: 1 }, { unique: true });

module.exports = dailyCounterSchema;