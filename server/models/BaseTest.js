const mongoose = require("mongoose");

const baseTestSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true }, // e.g. CBC
  name: { type: String, required: true }, // e.g. Complete Blood Count
  department: { type: String, required: true }, // Pathology/Radiology
  category: { type: String }, // Hematology
  
  // The scientific definition (Parameters, Units, Normal Ranges)
  parameters: [{
    name: String,
    unit: String,
    inputType: { type: String, enum: ["number", "text", "dropdown"], default: "number" },
    options: [String],
    bioRefRange: mongoose.Schema.Types.Mixed 
  }],
  
  template: String, // For Radiology HTML templates
  description: String, // Educational info about the test
}, { timestamps: true });

// Index for fast searching by name or code
baseTestSchema.index({ name: "text", code: "text" });

module.exports = mongoose.model("BaseTest", baseTestSchema);