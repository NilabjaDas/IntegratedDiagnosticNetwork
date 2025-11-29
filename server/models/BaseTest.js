const mongoose = require("mongoose");

const baseTestSchema = new mongoose.Schema({
  // --- Identification ---
  code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true }, // e.g. CBC
  name: { type: String, required: true, trim: true }, // e.g. Complete Blood Count
  alias: { type: String, trim: true }, // e.g. "Hemogram" (Alternative names for search)
  
  // --- Categorization ---
  department: { type: String, required: true, enum: ["Pathology", "Radiology", "Cardiology", "Other"] }, 
  category: { type: String, index: true }, // e.g. Hematology, Biochemistry, X-Ray
  
  // --- Pathology Specifics ---
  specimenType: { type: String }, // e.g. "Whole Blood (EDTA)", "Serum", "Urine"
  sampleQuantity: { type: String }, // e.g. "3 ml"
  method: { type: String }, // e.g. "Flow Cytometry", "ELISA"

  // --- Radiology/Report Specifics ---
  // If true, it uses the 'template'. If false, it uses 'parameters'.
  isDescriptive: { type: Boolean, default: false }, 
  template: { type: String }, // HTML string for Radiology/Consultation reports

  // --- Parameter Definition (For Pathology) ---
  parameters: [{
    name: { type: String, required: true },
    unit: { type: String }, // e.g. "mg/dL"
    inputType: { type: String, enum: ["number", "text", "dropdown", "long_text"], default: "number" },
    options: [String], // For dropdowns (e.g. ["Positive", "Negative"])
    
    // Bio Ref Range is complex. Storing as Mixed is flexible, but consider structure:
    // Structure suggestion: { male: { min: 13, max: 17 }, female: { min: 12, max: 15 }, child: {...} }
    bioRefRange: { type: mongoose.Schema.Types.Mixed, default: {} } 
  }],

  // --- Patient Instructions ---
  prerequisites: { type: String }, // e.g. "12 hours fasting required"
  
  // --- Visibility & Scope ---
  // If created by super-admin, institutionId is null (Global). 
  // If created by a user for their own use, link it (Private).
  institutionId: { type: String, index: true, default: null }, 
  isActive: { type: Boolean, default: true }

}, { timestamps: true });

// Compound text index for powerful search
baseTestSchema.index({ name: "text", code: "text", alias: "text", category: "text" });

// Ensure unique code *per institution* (Global codes are unique, but private codes shouldn't clash with global)
// This unique index might be tricky if mixing global/private. 
// Simpler approach: Keep 'code' unique globally and prefix private codes (e.g. "CUST-001").

module.exports = mongoose.model("BaseTest", baseTestSchema);