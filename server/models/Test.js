const mongoose = require("mongoose");

// Sub-schema for individual parameters (e.g., Hemoglobin within CBC)
const parameterSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Hemoglobin"
  unit: { type: String }, // e.g., "g/dL"
  inputType: { type: String, enum: ["number", "text", "dropdown"], default: "number" },
  options: [String], // For dropdowns
  
  // Reference Ranges (JSON structure for flexibility)
  // Example: { "Male": { "min": 13, "max": 17 }, "Female": { "min": 12, "max": 15 } }
  bioRefRange: { type: mongoose.Schema.Types.Mixed } 
});

const testSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  testCode: { type: String, required: true }, // e.g., "CBC", "CXR"
  name: { type: String, required: true }, // e.g., "Complete Blood Count"
  
  department: { 
    type: String, 
    enum: ["Pathology", "Radiology", "Cardiology"], 
    default: "Pathology" 
  },
  category: { type: String }, // e.g., "Hematology", "X-Ray"
  
  price: { type: Number, required: true, default: 0 },
  tat: { type: Number }, // Turnaround time in hours
  
  // Configuration
  parameters: [parameterSchema], // Only for Pathology
  template: { type: String }, // HTML Template for Radiology/Descriptive reports
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

testSchema.index({ institutionId: 1, testCode: 1 }, { unique: true });

module.exports = testSchema;