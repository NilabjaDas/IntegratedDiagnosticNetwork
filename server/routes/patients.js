const express = require("express");
const router = express.Router();
const Patient = require("../models/Patient");
const { authenticateUser } = require("../middleware/auth"); // Your middleware

// Search Patient by Mobile or Name
router.get("/search", authenticateUser, async (req, res) => {
  try {
    const { query } = req.query; // mobile or name
    const instId = req.user.institutionId;

    // Regex for partial match, case insensitive
    const regex = new RegExp(query, 'i');

    const patients = await Patient.find({
      institutionId: instId,
      $or: [
        { mobile: regex },
        { firstName: regex },
        { uhid: regex }
      ]
    }).limit(20);

    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create / Register Patient
router.post("/", authenticateUser, async (req, res) => {
  try {
    const { mobile } = req.body;
    const instId = req.user.institutionId;

    // Check for existing patient (optional strict check)
    const existing = await Patient.findOne({ institutionId: instId, mobile });
    if (existing) {
      return res.status(409).json({ message: "Patient with this mobile already exists.", patient: existing });
    }

    // Simple Auto-increment logic for UHID (better to use a counter collection in production)
    // For now, using a timestamp based string
    const uhid = `P${Date.now().toString().slice(-6)}`;

    const newPatient = new Patient({
      ...req.body,
      institutionId: instId,
      uhid: uhid
    });

    await newPatient.save();
    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;