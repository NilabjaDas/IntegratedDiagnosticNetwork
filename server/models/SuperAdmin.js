const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const superAdminSchema = new mongoose.Schema(
  {
    userId: { type: String, default: () => uuidv4(), unique: true },
    username: { type: String, required: true, lowercase: true, trim: true, unique: true },
    password: { type: String, required: true, select: false }, // Hashed
    fullName: { type: String, required: true },
    email: { type: String, lowercase: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SuperAdmin", superAdminSchema);
