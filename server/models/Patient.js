const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const encryptPlugin = require("./plugins/encryptPlugin");

const patientSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  patientId: { type: String, default: () => uuidv4(), unique: true },
  
  // Searchable fields
  uhid: { type: String }, // Custom short ID (e.g., P-1001)
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, trim: true },

  // Encrypted fields (Stored as ciphertext)
  mobile: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true },
  
  // Blind Indexes for Searching (Hashed)
  mobileHash: { type: String, index: true },
  emailHash: { type: String, index: true },

  // Demographics (Critical for Normal Ranges)
  dob: { type: Date },
  age: { type: Number }, // Fallback if DOB unknown
  ageUnit: { type: String, enum: ["Years", "Months", "Days"], default: "Years" },
  gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
  
  address: {
    line: String,
    city: String,
    pincode: String
  },

  medicalHistory: { type: String }, // Notes on diabetes, BP, etc.
}, { timestamps: true });

// Apply Encryption Plugin
const DB_SECRET = process.env.DB_SECRET || process.env.AES_SEC;

if (!DB_SECRET) {
    throw new Error("CRITICAL SECURITY ERROR: Missing DB_SECRET or AES_SEC. Cannot start safely.");
}

patientSchema.plugin(encryptPlugin, {
  fields: ["firstName", "lastName", "mobile", "email", "address.line", "medicalHistory"],
  blindIndexFields: ["mobile", "email"],
  secret: DB_SECRET
});

patientSchema.index({ institutionId: 1, mobileHash: 1 });
patientSchema.index({ institutionId: 1, firstName: 1, lastName: 1 });

module.exports = mongoose.model("Patient", patientSchema);