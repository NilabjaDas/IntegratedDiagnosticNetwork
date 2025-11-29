const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const packageSchema = new mongoose.Schema({
  // --- Ownership ---
  institutionId: { type: String, required: true, index: true },
  packageId: { type: String, default: () => uuidv4(), unique: true },
  
  // --- Basic Identification ---
  name: { type: String, required: true, trim: true }, // e.g., "Platinum Health Checkup"
  code: { type: String, uppercase: true, trim: true }, // e.g., "PKG-001"
  
  // --- Marketing & Display ---
  description: { type: String }, // Detailed markdown/text for the website
  image: { type: String }, // URL to a banner or icon image
  category: { type: String, index: true }, // e.g., "Wellness", "Diabetes", "Cardiac"
  
  // --- Demographics ---
  targetGender: { 
    type: String, 
    enum: ["Male", "Female", "Both"], 
    default: "Both" 
  },
  ageGroup: { type: String }, // e.g., "40+ Years", "Senior Citizens", "Kids"
  
  // --- Medical Content ---
  // List of Test ObjectIds from the Institution's 'Test' collection
  tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }], 
  
  // --- Patient Instructions ---
  precautions: { type: String }, // e.g., "12 Hours Fasting Required"
  tat: { type: String }, // e.g., "24 Hours" (Overall package reporting time)
  
  // --- Pricing ---
  // actualPrice is useful to show "You Save 20%" (Sum of individual tests)
  actualPrice: { type: Number, default: 0 }, 
  offerPrice: { type: Number, required: true }, 
  
  // --- Status ---
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Compound text index for search functionality
packageSchema.index({ name: "text", code: "text", description: "text", category: "text" });

module.exports = packageSchema;