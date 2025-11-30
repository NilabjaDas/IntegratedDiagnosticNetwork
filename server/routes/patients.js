const express = require("express");
const router = express.Router();
const Patient = require("../models/Patient");
const { authenticateUser } = require("../middleware/auth");
const encryptPlugin = require("../models/plugins/encryptPlugin"); 

const hashData = encryptPlugin.hashValue;
const DB_SECRET = process.env.DB_SECRET || process.env.AES_SEC || "dev-secret-key-123";

// --- SMART MASKING HELPERS ---

// Mobile: Show first 5 digits (Carrier+Region) and last 3 digits. Mask middle.
// Ex: 7872278998 -> "78722-xx998"
const maskMobileSmart = (mobile) => {
    if (!mobile || mobile.length < 5) return mobile;
    const first5 = mobile.substring(0, 5);
    const last3 = mobile.substring(mobile.length - 3);
    return `${first5}-xx${last3}`;
};

// Name: Show First 2 and Last 1 chars. Middle replaced by "..".
// Ex: "Nilabja" -> "Ni..a" | "Das" -> "Da..s"
// This is distinctive enough to verify but hides the full spelling.
const maskNameSmart = (name) => {
    if (!name) return "";
    const parts = name.split(" ");
    
    return parts.map(part => {
        if (part.length <= 3) return part; // Short names like "Roy" shown fully
        const start = part.substring(0, 2);
        const end = part.substring(part.length - 1);
        return `${start}..${end}`;
    }).join(" ");
};

// ==========================================
// 1. SMART SEARCH (Updated)
// ==========================================
router.get("/search", authenticateUser, async (req, res) => {
  try {
    const { query } = req.query; 
    
    // Allow search with just 4 chars now (matches "populate within 4 chars")
    if (!query || query.length < 4) {
        return res.json([]); 
    }

    // NORMALIZATION
    const searchStr = query.toLowerCase().trim();
    const isNumber = /^\d+$/.test(searchStr);

    let patients = [];

    if (isNumber) {
        // --- PARTIAL MOBILE SEARCH ---
        // Uses the new 'searchableMobile' field
        patients = await Patient.find({ 
            searchableMobile: { $regex: searchStr, $options: 'i' } 
        }).limit(10);

        // MASKING: Since we searched by number, we reveal the number (partially)
        // but hide the name more aggressively to prevent fishing.
        patients = patients.map(p => ({
            _id: p._id,
            uhid: p.uhid,
            firstName: maskNameSmart(p.firstName), // Masked Name
            lastName: maskNameSmart(p.lastName),   // Masked Name
            mobile: maskMobileSmart(p.mobile),     // Partially Visible Mobile
            gender: p.gender,
            age: p.age,
            isMasked: true
        }));

    } else {
        // --- PARTIAL NAME SEARCH ---
        patients = await Patient.find({ 
            $or: [
                { searchableName: { $regex: searchStr, $options: 'i' } },
                { uhid: { $regex: query, $options: 'i' } } 
            ]
        }).limit(10);

        // MASKING: User searched by Name, so we show Name clearly 
        // but mask the mobile number heavily.
        patients = patients.map(p => ({
            _id: p._id,
            uhid: p.uhid,
            firstName: p.firstName, // Show Name
            lastName: p.lastName,   // Show Name
            mobile: maskMobileSmart(p.mobile), // Mask Mobile
            gender: p.gender,
            age: p.age,
            isMasked: true
        }));
    }

    res.json(patients);

  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. CREATE PATIENT
// ==========================================
router.post("/", authenticateUser, async (req, res) => {
  try {
    const { mobile } = req.body;
    const instId = req.user.institutionId;

    // Check for existing (Exact Match)
    const mobileHash = hashData(mobile, DB_SECRET);
    const existing = await Patient.findOne({ mobileHash });
    
    if (existing) {
      return res.status(409).json({ message: "Patient with this mobile already exists.", patient: existing });
    }

    const uhid = `P${Date.now().toString().slice(-6)}`;

    // 'searchableMobile' is populated automatically by the pre-save hook
    const newPatient = new Patient({
      ...req.body,
      institutionId: instId,
      enrolledInstitutions: [instId],
      uhid: uhid
    });

    await newPatient.save();
    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;