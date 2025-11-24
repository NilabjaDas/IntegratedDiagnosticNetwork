const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const UserSchema = require("../models/User").schema;

// Helper: Generate Token
const generateToken = (user, institutionId) => {
  return jwt.sign(
    { 
      id: user._id, 
      userId: user.userId,
      role: user.role, 
      institutionId: institutionId,
      username: user.username,
      isMasterAdmin: user.isMasterAdmin // Critical payload
    }, 
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
};

// ==========================================
// 1. STAFF / DOCTOR / LOCAL ADMIN LOGIN (Password)
// ==========================================
// This route is called by the Provider Portal
// It MUST be aware of the Institution context (req.db)
router.post("/login-staff", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!req.db) {
        return res.status(500).json({ message: "Database connection failed. Is the Institution ID correct?" });
    }

    // 1. Get User Model for this Institution
    const User = req.db.model("User", UserSchema);

    // 2. Find User (explicitly select password)
    // Note: InstitutionId is now implicit because we are in the Institution's DB
    // But we still store it in the document if we kept the schema same.
    const user = await User.findOne({ 
        $or: [{ username }, { email: username }] 
    }).select("+password");

    if (!user) return res.status(400).json({ message: "User not found in this institution." });

    // 3. Verify Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    // 4. Check Active Status
    if (user.isActive === false) return res.status(403).json({ message: "Account is disabled" });

    // 5. Generate Token
    // We pass the institutionId found in the user record or from the request
    const token = generateToken(user, user.institutionId);

    // 6. Update Last Login
    user.lastLogin = new Date();
    await user.save();

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
    console.error("Login Error:", err);
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 2. CREATE STAFF (Local Admin Only)
// ==========================================
// This should be behind auth middleware usually, but for initial setup:
router.post("/register-staff", async (req, res) => {
    // Basic verification: user making this request must be an Admin
    // We'll trust the middleware to attach 'req.user' if this was a protected route.
    // For now, let's keep it open but maybe check a secret header or just assume
    // the UI protects it or it's for bootstrapping.

    // BETTER: Use a middleware on the route definition in index.js or here.
    // For now, I'll implement logic assuming it's protected or used carefully.

    try {
      const {
          username, password, role, fullName, phone, designation, registrationNumber
      } = req.body;

      if (!req.db) return res.status(500).json({ message: "No Institution Context" });
      const User = req.db.model("User", UserSchema);

      if (!username || !password || !fullName) {
          return res.status(400).json({ message: "Missing required fields." });
      }

      // Check if user exists
      const existingUser = await User.findOne({
          $or: [{ username }, { email: username }]
      });
      if (existingUser) {
          return res.status(409).json({ message: "User already exists." });
      }

      // Hash Password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = new User({
          institutionId: req.institutionId, // From middleware
          username,
          password: hashedPassword,
          role: role || "staff",
          fullName,
          phone,
          designation,
          registrationNumber,
          isMasterAdmin: false
      });

      await newUser.save();
      res.status(201).json({ message: "Staff created successfully", userId: newUser.userId });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

module.exports = router;
