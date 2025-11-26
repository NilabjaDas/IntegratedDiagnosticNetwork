const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, default: () => uuidv4(), unique: true },
    institutionId: { type: String, required: true, index: true }, // Link to Institution

    // Auth
    username: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // Hash this!
    role: {
      type: String,
      enum: [
        "master_admin",
        "admin",
        "doctor",
        "pathologist",
        "technician",
        "receptionist",
        "accountant",
        "partner",
        "patient",
      ],
      default: "patient",
    },
    // The "God Mode" Flag
    isMasterAdmin: { type: Boolean, default: false },
    // Profile
    fullName: { type: String, required: true },
    email: { type: String, lowercase: true },
    phone: { type: String },
    designation: { type: String },

    // For Doctors/Pathologists
    signatureUrl: { type: String }, // URL to image of signature
    registrationNumber: { type: String }, // Medical Council Reg No.

    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// Composite index to ensure unique username per institution
userSchema.index({ institutionId: 1, username: 1 }, { unique: true });

module.exports = userSchema;