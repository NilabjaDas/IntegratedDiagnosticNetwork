const mongoose = require("mongoose");

// Sub-schema for individual parameters (e.g., Hemoglobin within CBC)
const parameterSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Hemoglobin"
  unit: { type: String }, // e.g., "g/dL"
  inputType: { type: String, enum: ["number", "text", "dropdown", "long_text"], default: "number" },
  options: [String], // For dropdowns
  
  // Reference Ranges (JSON structure for flexibility)
  // Example: { "Male": { "min": 13, "max": 17 }, "Female": { "min": 12, "max": 15 } }
  bioRefRange: { type: mongoose.Schema.Types.Mixed, default: {} } 
});

const testSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  
  // --- Link to Master Catalog ---
  baseTestId: { type: String, index: true }, // The _id from BaseTest (if imported)
  baseTestCode: { type: String }, // e.g. "CBC"
  
  // --- Identification ---
  testCode: { type: String, required: true }, // Local code, e.g. "CBC-APOLLO"
  name: { type: String, required: true }, 
  alias: { type: String }, // e.g. "Hemogram"
  
  department: { 
    type: String, 
    enum: ["Pathology", "Radiology", "Cardiology", "Other"], 
    default: "Pathology" 
  },
  category: { type: String }, // e.g. "Hematology"
  
  // --- Commercials ---
  price: { type: Number, required: true, default: 0 },
  tat: { type: Number }, // Turnaround time in hours
  
  // --- Lab Workflow Specifics ---
  specimenType: { type: String }, // e.g., "Whole Blood (EDTA)", "Serum", "Urine"
  sampleQuantity: { type: String }, // e.g., "3 ml"
  method: { type: String }, // e.g., "Flow Cytometry", "ELISA"
  
  // --- Configuration ---
  // If Pathology -> use parameters. If Radiology -> use template.
  parameters: [parameterSchema], 
  template: { type: String }, 
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Compound index to ensure unique test codes within one institution
testSchema.index({ institutionId: 1, testCode: 1 }, { unique: true });

// Search Index
testSchema.index({ name: "text", testCode: "text", alias: "text" });

module.exports = testSchema;