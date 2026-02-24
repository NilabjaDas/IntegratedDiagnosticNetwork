const router = require("express").Router();
const Doctor = require("../models/Doctor");
const { authenticateUser } = require("../middleware/auth");


const hasOverlappingShifts = (schedule) => {
    if (!schedule) return false;

    for (let day of schedule) {
        if (day.isAvailable && day.shifts && day.shifts.length > 1) {
            // Sort shifts by start time string (e.g. "08:00" < "13:00")
            const sortedShifts = [...day.shifts].sort((a, b) => a.startTime.localeCompare(b.startTime));
            
            for (let i = 0; i < sortedShifts.length - 1; i++) {
                // If current shift ends AFTER the next shift starts, it's an overlap!
                if (sortedShifts[i].endTime > sortedShifts[i + 1].startTime) {
                    return `Overlapping shifts detected on Day ${day.dayOfWeek} between '${sortedShifts[i].shiftName}' and '${sortedShifts[i + 1].shiftName}'.`;
                }
            }
        }
    }
    return false; // No overlaps found
};


// 1. CREATE DOCTOR
router.post("/", authenticateUser, async (req, res) => {
    try {
        // --- NEW: Backend Overlap Validation ---
        const overlapError = hasOverlappingShifts(req.body.schedule);
        if (overlapError) {
            return res.status(400).json({ error: overlapError });
        }

        const newDoctor = new Doctor({
            ...req.body,
            institutionId: req.user.institutionId
        });
        const savedDoctor = await newDoctor.save();
        res.status(201).json(savedDoctor);
    } catch (err) {
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
router.put("/:doctorId", authenticateUser, async (req, res) => {
    try {
        // --- NEW: Backend Overlap Validation ---
        if (req.body.schedule) {
            const overlapError = hasOverlappingShifts(req.body.schedule);
            if (overlapError) {
                return res.status(400).json({ error: overlapError });
            }
        }

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
        // ACCEPT shiftNames ARRAY
        const { date, shiftNames, delayMinutes, isCancelled, note } = req.body;
        
        const doctor = await Doctor.findOne({ 
            doctorId: req.params.doctorId, 
            institutionId: req.user.institutionId 
        });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        // Remove any existing override for this EXACT DATE to prevent duplicates
        // A doctor should only have one master override record per day
        doctor.dailyOverrides = doctor.dailyOverrides.filter(o => o.date !== date);

        // Push the new delay/cancel rule
        doctor.dailyOverrides.push({ date, shiftNames, delayMinutes, isCancelled, note });
        
        await doctor.save();
        
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