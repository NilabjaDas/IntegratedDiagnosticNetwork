const mongoose = require("mongoose");

// Sub-schema for individual parameters
const parameterSchema = new mongoose.Schema({
  name: { type: String, required: true }, 
  unit: { type: String }, 
  inputType: { type: String, enum: ["number", "text", "dropdown", "long_text"], default: "number" },
  options: [String], 
  bioRefRange: { type: mongoose.Schema.Types.Mixed, default: {} } 
});

const testSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  
  // --- Link to Master Catalog ---
  baseTestId: { type: String, index: true }, 
  baseTestCode: { type: String }, 
  
  // --- Identification ---
  testCode: { type: String, required: true }, 
  name: { type: String, required: true }, 
  alias: { type: String }, 
  
  department: { 
    type: String, 
    enum: ["Pathology", "Radiology", "Cardiology", "Other"], 
    default: "Pathology" 
  },
  category: { type: String }, 
  
  // --- Commercials ---
  price: { type: Number, required: true, default: 0 },
  tat: { type: Number }, // Turnaround time in hours
  
  // --- NEW: Capacity & Logistics (Institution Specific) ---
  dailyLimit: { type: Number, default: null }, // Null = unlimited. Useful for MRI slots or limited reagents.
  processingLocation: { type: String, enum: ["In-house", "Outsourced"], default: "In-house" },
  homeCollectionAvailable: { type: Boolean, default: false },
  
  // --- NEW: Patient Prerequisites ---
  fastingRequired: { type: Boolean, default: false },
  fastingDuration: { type: Number }, // Duration in hours, e.g., 8 or 12

  // --- Lab Workflow Specifics ---
  specimenType: { type: String }, 
  sampleQuantity: { type: String }, 
  method: { type: String }, 
  
  // --- Configuration ---
  parameters: [parameterSchema], 
  template: { type: String }, 
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Compound index to ensure unique test codes within one institution
testSchema.index({ institutionId: 1, testCode: 1 }, { unique: true });

// Search Index
testSchema.index({ name: "text", testCode: "text", alias: "text" });

module.exports = testSchema;