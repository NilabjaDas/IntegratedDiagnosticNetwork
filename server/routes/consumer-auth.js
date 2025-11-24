const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Otp = require("../models/Otp");
const Patient = require("../models/Patient");
const { hashValue } = require("../models/plugins/encryptPlugin");

const DB_SECRET = process.env.DB_SECRET || process.env.AES_SEC || "dev-secret-key-123";

// Helper: Generate Token for Patient
const generateToken = (patient) => {
  return jwt.sign(
    {
      id: patient._id,
      patientId: patient.patientId,
      role: "patient",
      mobileHash: patient.mobileHash
    },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "30d" }
  );
};

// ==========================================
// 1. REQUEST OTP
// ==========================================
router.post("/send-otp", async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ message: "Mobile number is required" });

    // Generate 6 digit OTP (Mock logic)
    const otp = "123456";

    // Save to Otp Collection (Master DB)
    await Otp.findOneAndUpdate(
      { mobile },
      { mobile, otp, purpose: "LOGIN", expiresAt: new Date(Date.now() + 5 * 60000) },
      { upsert: true, new: true }
    );

    console.log(`📱 OTP for ${mobile}: ${otp}`);
    res.json({ message: "OTP sent successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. VERIFY OTP & LOGIN/REGISTER
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    // 1. Verify OTP
    const validOtp = await Otp.findOne({ mobile, otp });
    if (!validOtp) return res.status(400).json({ message: "Invalid or Expired OTP" });

    // 2. Check if Patient exists
    // We search by Blind Index (Hash)
    const mobileHash = hashValue(mobile, DB_SECRET);
    let patient = await Patient.findOne({ mobileHash });

    let isNew = false;

    // 3. If not exists, wait... we need Name/Age to register.
    // If it's a login attempt but no patient found, we might return a "Registration Required" state
    // OR we create a temporary profile.
    // User Requirement: "Simple registration, name number sex age"
    // So if patient doesn't exist, we send back { status: "register_required", mobile }

    if (!patient) {
        // Cleanup OTP? No, we might need to verify it again during registration?
        // Actually, better flow: Verify OTP -> Receive Token (Temp) -> If !Profile, redirect to Complete Profile.

        // Let's create a placeholder patient or just return a signal.
        return res.json({
            status: "registration_required",
            message: "User not found. Please complete registration.",
            mobile // Pass back to pre-fill
        });
    }

    // 4. Generate Token
    const token = generateToken(patient);
    await Otp.deleteOne({ _id: validOtp._id });

    res.json({ status: "success", token, patient: { firstName: patient.firstName, lastName: patient.lastName } });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. COMPLETE REGISTRATION
// ==========================================
router.post("/register", async (req, res) => {
    try {
        const { mobile, otp, firstName, lastName, gender, age, ageUnit } = req.body;

        // Re-verify OTP to ensure they own the number (since we didn't issue a token yet)
        // OR we could have issued a temporary "pre-auth" token.
        // For simplicity: verify OTP again.
        const validOtp = await Otp.findOne({ mobile, otp });
        if (!validOtp) return res.status(400).json({ message: "Invalid or Expired OTP" });

        // Check duplicate
        const mobileHash = hashValue(mobile, DB_SECRET);
        const existing = await Patient.findOne({ mobileHash });
        if (existing) return res.status(409).json({ message: "User already registered." });

        const newPatient = new Patient({
            firstName,
            lastName,
            mobile, // Will be encrypted by plugin
            gender,
            age,
            ageUnit,
            isVerified: true
        });

        await newPatient.save();
        await Otp.deleteOne({ _id: validOtp._id });

        const token = generateToken(newPatient);
        res.status(201).json({ status: "success", token, patient: { firstName, lastName } });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
