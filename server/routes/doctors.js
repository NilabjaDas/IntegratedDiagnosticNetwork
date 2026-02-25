const router = require("express").Router();
const Doctor = require("../models/Doctor");
const { authenticateUser } = require("../middleware/auth");
const mongoose = require("mongoose");
const getModel = require("../middleware/getModelsHandler");
const queueTokenSchema = require("../models/QueueToken");

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

// ADD DAILY OVERRIDE (The "Delay / Cancel" Engine)
router.post("/:doctorId/overrides", authenticateUser, async (req, res) => {
    try {
        const { date, shiftNames, delayMinutes, isCancelled, note } = req.body;
        const instId = req.user.institutionId;

        const doctor = await Doctor.findOne({ doctorId: req.params.doctorId, institutionId: instId });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        // --- REQ 5 & 6: METRICS TRACKING & LIMITS ---
        const dayOfWeek = moment(date).day();
        const todaysSchedule = doctor.schedule.find(s => s.dayOfWeek === dayOfWeek);
        const totalShiftsToday = todaysSchedule?.isAvailable ? todaysSchedule.shifts.length : 0;
        
        const isFullDayCancel = isCancelled && shiftNames.length === totalShiftsToday;

        if (isCancelled) {
            if (isFullDayCancel) {
                // Check limit before allowing full day leave
                if (doctor.metrics.leavesTaken >= doctor.leaveSettings.leaveLimitPerYear) {
                    return res.status(400).json({ message: `Cannot approve leave. Doctor has reached their yearly limit of ${doctor.leaveSettings.leaveLimitPerYear} leaves.` });
                }
                doctor.metrics.leavesTaken += 1;
            } else {
                doctor.metrics.cancellationsCount += 1;
            }
        } else if (delayMinutes > 0) {
            doctor.metrics.lateCount += 1;
        }

        // Apply Override
        doctor.dailyOverrides = doctor.dailyOverrides.filter(o => o.date !== date);
        doctor.dailyOverrides.push({ date, shiftNames, delayMinutes, isCancelled, note });
        await doctor.save();

        // --- APPLY INSTITUTION POLICIES (Req 1 & 2) ---
        if (isCancelled) {
            const Institution = require("../models/Institutions");
            const institution = await Institution.findOne({ institutionId: instId });
            
            // Determine which policy to use based on Full Day vs Shift
            const policy = isFullDayCancel 
                ? (institution.settings?.queuePolicies?.dayCancelPolicy || 'MANUAL_ALLOCATION')
                : (institution.settings?.queuePolicies?.shiftCancelPolicy || 'MANUAL_ALLOCATION');

            const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
            const TenantQueueToken = getModel(tenantDb, "QueueToken", QueueTokenSchema);

            const affectedTokens = await TenantQueueToken.find({
                date: date,
                doctorId: doctor._id,
                status: { $in: ['WAITING', 'HOLD'] },
                ...(shiftNames && shiftNames.length > 0 && { shiftName: { $in: shiftNames } })
            });

            if (affectedTokens.length > 0) {
                if (policy === 'CANCEL_ALL') {
                    // Hard cancel, no reschedule offered
                    await TenantQueueToken.updateMany(
                        { _id: { $in: affectedTokens.map(t => t._id) } },
                        { $set: { status: 'CANCELLED', notes: `Doctor Unavailable. Policy: Cancel All.` } }
                    );
                } 
                else if (policy === 'MANUAL_ALLOCATION') {
                    // Mark cancelled, Receptionist uses Action Required Dashboard
                    await TenantQueueToken.updateMany(
                        { _id: { $in: affectedTokens.map(t => t._id) } },
                        { $set: { status: 'CANCELLED', isRescheduled: false, notes: `Doctor Leave. Action Required.` } }
                    );
                }
                else if (policy === 'AUTO_NEXT_AVAILABLE') {
                    // Auto-push to tomorrow (or next working day)
                    let nextDay = moment(date).add(1, 'days');
                    for (let token of affectedTokens) {
                        token.date = nextDay.format("YYYY-MM-DD");
                        token.isRescheduled = true;
                        token.priority = 1;
                        await token.save();
                    }
                }
            }
        }
        
        res.status(200).json(doctor.dailyOverrides);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REQ 4: ADD SPECIAL SHIFT ---
router.post("/:doctorId/special-shifts", authenticateUser, async (req, res) => {
    try {
        const { date, shiftName, startTime, endTime, maxTokens, note } = req.body;
        
        const doctor = await Doctor.findOne({ _id: req.params.doctorId, institutionId: req.user.institutionId });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        doctor.specialShifts.push({ date, shiftName, startTime, endTime, maxTokens, note });
        await doctor.save();
        
        res.status(201).json(doctor.specialShifts);
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