const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  mobile: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ["LOGIN", "VERIFICATION"], default: "LOGIN" },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // Auto-delete after expiry
}, { timestamps: true });

module.exports = mongoose.model("Otp", otpSchema);
