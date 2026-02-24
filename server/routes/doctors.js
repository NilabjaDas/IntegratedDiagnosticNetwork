const router = require("express").Router();
const Doctor = require("../models/Doctor");
const { authenticateUser } = require("../middleware/auth");

// 1. CREATE DOCTOR
router.post("/", authenticateUser, async (req, res) => {
    try {
        const newDoctor = new Doctor({
            ...req.body,
            institutionId: req.user.institutionId // Force tenant isolation
        });
        const savedDoctor = await newDoctor.save();
        res.status(201).json(savedDoctor);
    } catch (err) {
        console.error("Create Doctor Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 2. GET ALL DOCTORS FOR INSTITUTION
router.get("/", authenticateUser, async (req, res) => {
    try {
        const doctors = await Doctor.find({ 
            institutionId: req.user.institutionId,
            isActive: true 
        }).sort({ "personalInfo.firstName": 1 });
        res.status(200).json(doctors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. GET SINGLE DOCTOR BY ID
router.get("/:doctorId", authenticateUser, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ 
            doctorId: req.params.doctorId, 
            institutionId: req.user.institutionId 
        });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });
        res.status(200).json(doctor);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. UPDATE DOCTOR PROFILE / SCHEDULE
router.put("/:doctorId", authenticateUser, async (req, res) => {
    try {
        const updatedDoctor = await Doctor.findOneAndUpdate(
            { doctorId: req.params.doctorId, institutionId: req.user.institutionId },
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!updatedDoctor) return res.status(404).json({ message: "Doctor not found" });
        res.status(200).json(updatedDoctor);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. ADD DAILY OVERRIDE (The "Delay / Cancel" Engine)
router.post("/:doctorId/overrides", authenticateUser, async (req, res) => {
    try {
        const { date, shiftName, delayMinutes, isCancelled, note } = req.body;
        
        const doctor = await Doctor.findOne({ 
            doctorId: req.params.doctorId, 
            institutionId: req.user.institutionId 
        });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        // Remove any existing override for this exact date and shift to prevent duplicates
        doctor.dailyOverrides = doctor.dailyOverrides.filter(
            o => !(o.date === date && o.shiftName === shiftName)
        );

        // Push the new delay/cancel rule
        doctor.dailyOverrides.push({ date, shiftName, delayMinutes, isCancelled, note });
        
        await doctor.save();
        
        // TODO: Here we will later add SSE Trigger to instantly update TVs and Patient Apps about the delay!
        
        res.status(200).json(doctor.dailyOverrides);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. DEACTIVATE DOCTOR (Soft Delete)
router.delete("/:doctorId", authenticateUser, async (req, res) => {
    try {
        await Doctor.findOneAndUpdate(
            { doctorId: req.params.doctorId, institutionId: req.user.institutionId },
            { $set: { isActive: false } }
        );
        res.status(200).json({ message: "Doctor deactivated successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;