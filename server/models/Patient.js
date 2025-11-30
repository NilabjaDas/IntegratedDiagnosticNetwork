const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const encryptPlugin = require("./plugins/encryptPlugin");

const patientSchema = new mongoose.Schema({
  patientId: { type: String, default: () => uuidv4(), unique: true },
  
  // Searchable fields (Plaintext, Indexed for performance)
  uhid: { type: String, index: true, uppercase: true, trim: true },
  searchableName: { type: String, index: true }, 
  searchableMobile: { type: String, index: true }, // NEW: Allows partial search (e.g. "9876%")

  // Encrypted fields (Stored as ciphertext)
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, trim: true },
  mobile: { type: String, required: true }, // Encrypted Source of Truth
  email: { type: String, lowercase: true, trim: true },
  
  // Blind Indexes (Still useful for exact match speed)
  mobileHash: { type: String, index: true },
  emailHash: { type: String, index: true },

  // ... (Rest of schema remains same: otp, dob, age, address, etc.)
  otp: { type: String, select: false },
  otpExpires: { type: Date },
  isVerified: { type: Boolean, default: false },
  dob: { type: Date },
  age: { type: Number },
  ageUnit: { type: String, default: "Years" },
  gender: { type: String, required: true },
  address: { line: String, city: String, pincode: String },
  medicalHistory: { type: String },
  enrolledInstitutions: [{ type: String }],

}, { timestamps: true });

// --- HOOK: Populate Searchable Fields ---
// This runs BEFORE the encryption plugin, so 'this.mobile' is still plaintext
patientSchema.pre('save', function(next) {
    // 1. Prepare Name for Search (Lowercase)
    if (this.isModified('firstName') || this.isModified('lastName')) {
        const full = `${this.firstName} ${this.lastName || ''}`;
        this.searchableName = full.toLowerCase().replace(/\s+/g, ' ').trim();
    }
    
    // 2. Prepare Mobile for Search (Plaintext)
    if (this.isModified('mobile')) {
        this.searchableMobile = this.mobile;
    }
    next();
});

// --- PLUGINS ---
const DB_SECRET = process.env.DB_SECRET || process.env.AES_SEC || "dev-secret-key-123";

patientSchema.plugin(encryptPlugin, {
  fields: ["firstName", "lastName", "mobile", "email", "address.line", "medicalHistory"],
  blindIndexFields: ["mobile", "email"], // Keep blind index for fast exact lookups
  secret: DB_SECRET
});

// Composite index for text searching
patientSchema.index({ searchableMobile: 1 });
patientSchema.index({ searchableName: 1 });

module.exports = mongoose.model("Patient", patientSchema);