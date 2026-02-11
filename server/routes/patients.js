const express = require("express");
const router = express.Router();
const Patient = require("../models/Patient");
const { authenticateUser } = require("../middleware/auth");
const crypto = require("crypto");

// --- CONFIGURATION ---
const HASH_SECRET = process.env.AES_SEC;

// Helper: Generate Blind Index Hash
const hashData = (text) => {
    if (!text) return null;
    return crypto.createHmac('sha256', HASH_SECRET).update(text).digest('hex');
};

// Helper: Smart Masking
const maskMobileSmart = (mobile) => {
    if (!mobile || mobile.length < 5) return mobile;
    return `${mobile.substring(0, 5)}-xx${mobile.substring(mobile.length - 3)}`;
};

// ==========================================
// 1. SEARCH PATIENTS
// ==========================================
router.get("/search", authenticateUser, async (req, res) => {
    try {
        const { query } = req.query;
        const instId = req.user.institutionId;

        if (!query || query.length < 3) return res.json([]);

        let criteria = { enrolledInstitutions: instId };
        const searchStr = query.trim();
        
        if (/^\d{10}$/.test(searchStr)) {
            // Search by Hash
            criteria.mobileHash = hashData(searchStr);
        } else {
            // Search by Text
            criteria.$or = [
                { searchableName: { $regex: searchStr.toLowerCase(), $options: 'i' } },
                { uhid: { $regex: searchStr, $options: 'i' } }
            ];
        }

        const patients = await Patient.find(criteria).limit(10);

        const response = patients.map(p => {
            // Decrypt logic
            const decrypted = p.getDecrypted ? p.getDecrypted() : p.toObject();
            return {
                _id: decrypted._id,
                uhid: decrypted.uhid,
                firstName: decrypted.firstName,
                lastName: decrypted.lastName,
                mobile: maskMobileSmart(decrypted.mobile), 
                gender: decrypted.gender,
                age: decrypted.age
            };
        });

        res.json(response);

    } catch (err) {
        console.error("Search Error:", err);
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 2. CREATE / LINK PATIENT
// ==========================================
router.post("/", authenticateUser, async (req, res) => {
    try {
        const { mobile, firstName, lastName, gender, age, address, email } = req.body;
        const instId = req.user.institutionId;

        if (!mobile || !firstName || !gender) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const targetHash = hashData(mobile);
        
        // Find existing family members using hash
        const existingFamilyMembers = await Patient.find({ mobileHash: targetHash });

        let matchedPatient = null;

        // Decrypt and Compare Names
        for (let member of existingFamilyMembers) {
            const decryptedMember = member.getDecrypted ? member.getDecrypted() : member.toObject();
            
            const dbName = `${decryptedMember.firstName} ${decryptedMember.lastName || ''}`.toLowerCase().trim();
            const inputName = `${firstName} ${lastName || ''}`.toLowerCase().trim();

            if (dbName === inputName) {
                matchedPatient = member;
                break;
            }
        }

        if (matchedPatient) {
            // Link Existing
            let wasUpdated = false;
            if (!matchedPatient.enrolledInstitutions.includes(instId)) {
                matchedPatient.enrolledInstitutions.push(instId);
                wasUpdated = true;
            }
            if (wasUpdated) await matchedPatient.save();

            const decryptedMatch = matchedPatient.getDecrypted ? matchedPatient.getDecrypted() : matchedPatient.toObject();
            return res.status(200).json({
                message: "Existing patient linked successfully.",
                data: decryptedMatch 
            });

        } else {
            // Create New
            const uhid = `P${Date.now().toString().slice(-6)}`; 

            const newPatient = new Patient({
                firstName,
                lastName,
                mobile, 
                // Hash is now handled by Model's pre('validate') hook automatically
                // But passing it explicitly is also fine and safe
                mobileHash: targetHash, 
                gender,
                age,
                address,
                email,
                institutionId: instId,
                enrolledInstitutions: [instId],
                uhid
            });

            await newPatient.save();
            
            const decryptedNew = newPatient.getDecrypted ? newPatient.getDecrypted() : newPatient.toObject();
            return res.status(201).json({
                message: "New patient registered.",
                data: decryptedNew
            });
        }

    } catch (err) {
        console.error("Create Patient Error:", err);
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 3. GET SINGLE PATIENT
// ==========================================
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: "Patient not found" });

        const decryptedData = patient.getDecrypted ? patient.getDecrypted() : patient.toObject();
        res.json(decryptedData);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 4. UPDATE PATIENT
// ==========================================
router.put("/:id", authenticateUser, async (req, res) => {
    try {
        const { firstName, lastName, age, gender, address, email } = req.body;
        
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: "Patient not found" });

        if (firstName) patient.firstName = firstName;
        if (lastName) patient.lastName = lastName;
        if (age) patient.age = age;
        if (gender) patient.gender = gender;
        if (address) patient.address = address;
        if (email) patient.email = email;

        await patient.save();

        const decryptedData = patient.getDecrypted ? patient.getDecrypted() : patient.toObject();
        res.json(decryptedData);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;