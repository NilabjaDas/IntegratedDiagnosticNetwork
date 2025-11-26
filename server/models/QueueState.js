// models/QueueState.js
const mongoose = require("mongoose");

const queueStateSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  doctorId: { type: String, required: true, index: true },
  date: { type: String, required: true }, // Format: "YYYY-MM-DD"
  
  // Real-time metrics
  currentTokenProcessing: { type: Number, default: 0 }, // Who is inside?
  cumulativeDelay: { type: Number, default: 0 }, // In minutes (e.g., +45 mins)
  
  lastUpdated: { type: Date, default: Date.now }
});

// Ensure one record per doctor per day
queueStateSchema.index({ institutionId: 1, doctorId: 1, date: 1 }, { unique: true });

module.exports = queueStateSchema;