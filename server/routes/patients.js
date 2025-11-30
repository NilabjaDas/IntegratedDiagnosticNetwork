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
// 1. INSTITUTION-SCOPED SEARCH
// ==========================================
router.get("/search", authenticateUser, async (req, res) => {
  try {
    const { query } = req.query; 
    const instId = req.user.institutionId;

    if (!query || query.length < 4) return res.json([]);

    const searchStr = query.toLowerCase().trim();
    const isNumber = /^\d+$/.test(searchStr);

    let criteria = {};

    if (isNumber) {
        criteria = { searchableMobile: { $regex: searchStr, $options: 'i' } };
    } else {
        criteria = { 
            $or: [
                { searchableName: { $regex: searchStr, $options: 'i' } },
                { uhid: { $regex: query, $options: 'i' } } 
            ]
        };
    }

    // --- CRITICAL PRIVACY FILTER ---
    // Only return patients who have ALREADY visited this institution.
    criteria.enrolledInstitutions = instId; 

    let patients = await Patient.find(criteria).limit(10);

    // Map & Mask
    const response = patients.map(p => ({
        _id: p._id,
        uhid: p.uhid,
        firstName: isNumber ? maskNameSmart(p.firstName) : p.firstName,
        lastName: isNumber ? maskNameSmart(p.lastName) : p.lastName,
        mobile: isNumber ? maskMobileSmart(p.mobile) : maskMobileSmart(p.mobile), // Consistent masking
        gender: p.gender,
        age: p.age,
        isMasked: true
    }));

    res.json(response);

  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. CREATE / LINK PATIENT (Silent Onboarding)
// ==========================================
router.post("/", authenticateUser, async (req, res) => {
  try {
    const { mobile, firstName, lastName, gender, age, address } = req.body;
    const instId = req.user.institutionId;

    // 1. Check Global Registry for Match (Blind Index)
    const mobileHash = hashData(mobile, DB_SECRET);
    const existingPatient = await Patient.findOne({ mobileHash });
    
    if (existingPatient) {
        // --- SCENARIO A: MATCH FOUND ---
        // Patient exists globally but might not be in THIS institution.
        
        // Check if already enrolled here (Duplicate Entry Attempt?)
        if (existingPatient.enrolledInstitutions.includes(instId)) {
            // If already enrolled here, warn the user.
            return res.status(409).json({ 
                message: "Patient already registered in your clinic.", 
                patient: existingPatient 
            });
        }

        // SILENT LINKING:
        // Add this institution to their history.
        existingPatient.enrolledInstitutions.push(instId);
        
        // Optional: Update missing details if current record is sparse? 
        // For now, let's trust the master record to be single source of truth.
        // Or we can update 'latest address' if provided.
        if(address) existingPatient.address = address;

        await existingPatient.save();
        
        return res.status(200).json({
            message: "Patient profile retrieved & linked successfully.",
            data: existingPatient
        });

    } else {
        // --- SCENARIO B: BRAND NEW PATIENT ---
        const uhid = `P${Date.now().toString().slice(-6)}`;
        
        const newPatient = new Patient({
            firstName,
            lastName,
            mobile, 
            gender,
            age,
            address,
            institutionId: instId, // Origin
            enrolledInstitutions: [instId], // Enrolled Here
            uhid
        });

        await newPatient.save();
        return res.status(201).json({
            message: "New Patient Registered.",
            data: newPatient
        });
    }

  } catch (err) {
    console.error("Patient Create Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;