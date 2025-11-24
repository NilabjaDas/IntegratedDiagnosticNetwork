const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Patient = require("../models/Patient");
const Otp = require("../models/Otp");
const Institution = require("../models/Institutions"); // If checking valid institution
const { hashValue } = require("../models/plugins/encryptPlugin");

// Helper: Generate Token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      userId: user.userId,
      role: user.role, 
      institutionId: user.institutionId,
      isMasterAdmin: user.isMasterAdmin // Critical payload
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: "7d" }
  );
};

// ==========================================
// 1. SEND OTP (For Patients & Staff Login)
// ==========================================
router.post("/send-otp", async (req, res) => {
  try {
    const { mobile, role } = req.body;
    
    // Generate 6 digit OTP (Mock logic)
    // In Prod: Math.floor(100000 + Math.random() * 900000).toString();
    const otp = "123456"; 

    // Save to DB (Upsert: Update if exists, else Insert)
    await Otp.findOneAndUpdate(
      { mobile }, 
      { mobile, otp, role }, 
      { upsert: true, new: true }
    );

    // TODO: Integrate SMS Provider here (Twilio/Kaleyra)
    console.log(`🔐 OTP for ${mobile} [Role: ${role || 'patient'}]: ${otp}`);

    res.json({ message: "OTP sent successfully", devNote: "Check console for code" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 2. VERIFY OTP (Login for Patients)
// ==========================================
router.post("/login-patient", async (req, res) => {
  try {
    const { mobile, otp, institutionId } = req.body;

    // 1. Verify OTP
    const validOtp = await Otp.findOne({ mobile, otp });
    if (!validOtp) return res.status(400).json({ message: "Invalid or Expired OTP" });

    // 2. Find or Create Patient User
    // Note: Patient login is specific to an Institution usually, 
    // but the User table is global. Let's find via Mobile.
    
    let user = await User.findOne({ phone: mobile, role: "patient", institutionId });
    
    // If first time login, check if Patient Profile exists in that Institution
    if (!user) {
        // Check if a patient record exists created by Frontdesk
        // Use BLIND INDEX (mobileHash) because 'mobile' is encrypted
        // Must use SAME secret as plugin.
        // WARNING: We need to import secret logic or pass it.
        // Best way: Use a shared config or env.
        const DB_SECRET = process.env.DB_SECRET || process.env.AES_SEC;
        const hashedMobile = hashValue(mobile, DB_SECRET);
        const patientProfile = await Patient.findOne({ mobileHash: hashedMobile, institutionId });
        
        if (patientProfile) {
            // Create a User login for this existing patient
            user = new User({
                institutionId,
                username: mobile, // Mobile is username for patients
                phone: mobile,
                role: "patient",
                fullName: `${patientProfile.firstName} ${patientProfile.lastName}`
            });
            await user.save();
        } else {
            // New User entirely (Self Registration Flow logic needed or deny)
            // For MVP: We allow, but they have empty profile
            user = new User({
                institutionId,
                username: mobile,
                phone: mobile,
                role: "patient",
                fullName: "Guest Patient"
            });
            await user.save();
        }
    }

    // 3. Generate Token
    const token = generateToken(user);

    // 4. Cleanup OTP
    await Otp.deleteOne({ _id: validOtp._id });

    res.json({ token, user: { name: user.fullName, role: "patient" } });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 3. STAFF / DOCTOR / MASTER ADMIN LOGIN (Password)
// ==========================================
router.post("/login-staff", async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Find User (explicitly select password)
    const user = await User.findOne({ 
        $or: [{ username }, { email: username }] 
    }).select("+password");

    if (!user) return res.status(400).json({ message: "User not found" });

    // 2. Verify Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // 3. Check Active Status
    if (!user.isActive) return res.status(403).json({ message: "Account is disabled" });

    // 4. Generate Token
    const token = generateToken(user);

    res.json({ 
        token, 
        user: { 
            id: user._id, 
            name: user.fullName, 
            role: user.role,
            institutionId: user.institutionId,
            isMasterAdmin: user.isMasterAdmin 
        } 
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 4. CREATE STAFF (Admin Only)
// ==========================================
// You need a temporary route or a script to create your FIRST Admin/Master Admin
// Postman -> POST /api/auth/register-staff
router.post("/register-staff", async (req, res) => {
  try {
    const { 
        institutionId, username, password, role, fullName, phone, isMasterAdmin 
    } = req.body;

    if (!institutionId || !username || !password || !fullName) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    // Check if user exists
    const existingUser = await User.findOne({
        institutionId,
        $or: [{ username }, { email: username }]
    });
    if (existingUser) {
        return res.status(409).json({ message: "User already exists in this institution." });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
        institutionId,
        username,
        password: hashedPassword,
        role: role || "staff",
        fullName,
        phone,
        isMasterAdmin: isMasterAdmin || false
    });

    await newUser.save();
    res.status(201).json({ message: "Staff created successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;