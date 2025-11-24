const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  mobile: { type: String, required: true },
  otp: { type: String, required: true },
  role: { type: String, default: "patient" }, // patient or staff
  createdAt: { type: Date, default: Date.now, index: { expires: 300 } } // Auto-delete after 5 mins (300s)
});

module.exports = mongoose.model("Otp", otpSchema);