const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const encryptPlugin = require("./plugins/encryptPlugin");
const crypto = require("crypto");

// --- CONFIGURATION ---
// Ensure this matches your .env exactly
const HASH_SECRET = process.env.AES_SEC || "dev-secret-key-123";

// Shared Hash Function
const hashData = (text) => {
    if (!text) return undefined;
    return crypto.createHmac('sha256', HASH_SECRET).update(text).digest('hex');
};

const patientSchema = new mongoose.Schema({
  patientId: { type: String, default: () => uuidv4(), unique: true },
  
  // Searchable fields (Plaintext)
  uhid: { type: String, index: true, uppercase: true, trim: true },
  searchableName: { type: String, index: true }, 
  searchableMobile: { type: String, index: true }, 

  // Encrypted fields
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, trim: true },
  mobile: { type: String, required: true }, 
  email: { type: String, lowercase: true, trim: true },
  
  // Blind Indexes (Manual Hashing)
  mobileHash: { type: String, index: true, required: true },
  emailHash: { type: String, index: true },

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

// --- HOOK 1: PRE-VALIDATE (Generates Hashes) ---
// Runs BEFORE validation, fixing the "mobileHash required" error
patientSchema.pre('validate', function(next) {
    if (this.isModified('mobile') && this.mobile) {
        this.mobileHash = hashData(this.mobile);
        this.searchableMobile = this.mobile; // Plaintext copy for partial search (optional)
    }
    if (this.isModified('email') && this.email) {
        this.emailHash = hashData(this.email);
    }
    next();
});

// --- HOOK 2: PRE-SAVE (Generates Searchable Name) ---
// Runs BEFORE encryption
patientSchema.pre('save', function(next) {
    if (this.isModified('firstName') || this.isModified('lastName')) {
        const full = `${this.firstName} ${this.lastName || ''}`;
        this.searchableName = full.toLowerCase().replace(/\s+/g, ' ').trim();
    }
    next();
});

// --- PLUGINS ---
const DB_SECRET = process.env.DB_SECRET || process.env.AES_SEC || "dev-secret-key-123";

patientSchema.plugin(encryptPlugin, {
  fields: ["firstName", "lastName", "mobile", "email", "address.line", "medicalHistory"],
  // *** CRITICAL CHANGE: REMOVED blindIndexFields ***
  // We are handling mobileHash manually above to ensure it matches the Route's logic.
  secret: DB_SECRET
});

// Indexes
patientSchema.index({ mobileHash: 1 });
patientSchema.index({ searchableName: 1 });
patientSchema.index({ enrolledInstitutions: 1 });

module.exports = mongoose.model("Patient", patientSchema);