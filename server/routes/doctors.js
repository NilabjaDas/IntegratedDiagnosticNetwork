const router = require("express").Router();
const Doctor = require("../models/Doctor");
const { authenticateUser } = require("../middleware/auth");
const mongoose = require("mongoose");
const getModel = require("../middleware/getModelsHandler");
const QueueTokenSchema = require("../models/QueueToken");
const moment = require("moment-timezone");
const { sendToBrand } = require("../sseManager");

// --- NEW HELPER: Finds the actual next working day for a specific shift ---
const getNextWorkingDayForShift = (doctor, startDateStr, shiftName) => {
    let current = moment(startDateStr).add(1, 'days');
    // Look up to 14 days ahead
    for(let i = 0; i < 14; i++) {
        const dayIndex = current.day();
        const daySch = doctor.schedule.find(s => s.dayOfWeek === dayIndex);
        if (daySch && daySch.isAvailable) {
            const shiftExists = daySch.shifts.some(s => s.shiftName === shiftName);
            if (shiftExists) return current.format("YYYY-MM-DD");
        }
        current.add(1, 'days');
    }
    return null; 
};

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


// ==========================================
// 5. ADD DAILY OVERRIDE (Synced with Leave Ledger)
// ==========================================
router.post("/:doctorId/overrides", authenticateUser, async (req, res) => {
    try {
        const { date, isFullDayCancel, note, overrides } = req.body;
        const instId = req.user.institutionId;

        const doctor = await Doctor.findOne({ doctorId: req.params.doctorId, institutionId: instId });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        const dayOfWeek = moment(date).day();
        const todaysSchedule = doctor.schedule.find(s => s.dayOfWeek === dayOfWeek);
        const todayShifts = todaysSchedule?.isAvailable ? todaysSchedule.shifts.map(s => s.shiftName) : [];

        // 1. Remove existing overrides for this exact date
        doctor.dailyOverrides = doctor.dailyOverrides.filter(o => o.date !== date);

        // --- LEAVE LEDGER MATH ---
        let daysToConsume = 0;
        let cancelledShiftsForAudit = [];

        if (isFullDayCancel) {
            daysToConsume = 1;
            cancelledShiftsForAudit = todayShifts;
        } else if (overrides && overrides.length > 0) {
            cancelledShiftsForAudit = overrides.filter(o => o.isCancelled).flatMap(o => o.shiftNames);
            if (cancelledShiftsForAudit.length > 0 && todayShifts.length > 0) {
                // E.g., Cancelled 1 out of 2 shifts = 0.5 days consumed
                daysToConsume = cancelledShiftsForAudit.length / todayShifts.length;
            }
        }

        // Deduct balance and log to ledger if there is a cancellation
        if (daysToConsume > 0) {
            const limit = doctor.leaveSettings?.leaveLimitPerYear || 20;
            if (doctor.metrics.leavesTaken + daysToConsume > limit) {
                return res.status(400).json({ message: `Cannot apply ad-hoc leave. Requested ${daysToConsume} days, but only ${limit - doctor.metrics.leavesTaken} remaining.` });
            }
            
            doctor.metrics.leavesTaken += daysToConsume;
            doctor.leaveAuditLogs.push({
                action: "AD_HOC_LEAVE",
                byUserName: req.user.username,
                details: `Emergency/Ad-Hoc Leave on ${date} (${isFullDayCancel ? 'Full Day' : 'Shifts: ' + cancelledShiftsForAudit.join(', ')}). Reason: ${note || 'None'}`
            });
        }
        // ------------------------------

        const Institution = require("../models/Institutions");
        const institution = await Institution.findOne({ institutionId: instId });
        const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
        const TenantQueueToken = getModel(tenantDb, "QueueToken", QueueTokenSchema);

        let affectedShiftNames = [];
        let policyToApply = null;

        // 2. PROCESS FULL DAY CANCEL
        if (isFullDayCancel) {
            doctor.dailyOverrides.push({ date, shiftNames: todayShifts, delayMinutes: 0, isCancelled: true, note });
            affectedShiftNames = todayShifts;
            policyToApply = institution.settings?.queuePolicies?.dayCancelPolicy || 'MANUAL_ALLOCATION';
        } 
        // 3. PROCESS MIXED GRANULAR SHIFTS
        else if (overrides && overrides.length > 0) {
            for (let o of overrides) {
                const targetShifts = Array.isArray(o.shiftNames) ? o.shiftNames : [o.shiftNames];

                doctor.dailyOverrides.push({
                    date,
                    shiftNames: targetShifts, 
                    delayMinutes: o.delayMinutes || 0,
                    isCancelled: o.isCancelled || false,
                    note
                });

                if (o.isCancelled) {
                    doctor.metrics.cancellationsCount += 1;
                    affectedShiftNames.push(...targetShifts);
                } else if (o.delayMinutes > 0) {
                    doctor.metrics.lateCount += 1;
                }
            }
            policyToApply = institution.settings?.queuePolicies?.shiftCancelPolicy || 'MANUAL_ALLOCATION';
        }

        await doctor.save();

        // 4. APPLY QUEUE CANCELLATION POLICIES
        if (affectedShiftNames.length > 0) {
            const affectedTokens = await TenantQueueToken.find({
                date: date,
                doctorId: doctor._id,
                status: { $in: ['WAITING', 'HOLD'] },
                shiftName: { $in: affectedShiftNames } 
            });

            if (affectedTokens.length > 0) {
                if (policyToApply === 'CANCEL_ALL') {
                    await TenantQueueToken.updateMany(
                        { _id: { $in: affectedTokens.map(t => t._id) } },
                        { $set: { status: 'DOC_UNVAILABLE', notes: `Doctor Unavailable. Policy: Cancel All.` } }
                    );
                } else if (policyToApply === 'MANUAL_ALLOCATION') {
                    await TenantQueueToken.updateMany(
                        { _id: { $in: affectedTokens.map(t => t._id) } },
                        { $set: { status: 'DOC_UNVAILABLE', isRescheduled: false, notes: `Doctor Leave. Action Required.` } }
                    );
                } else if (policyToApply === 'AUTO_NEXT_AVAILABLE') {
                   for (let token of affectedTokens) {
                        const nextDayStr = getNextWorkingDayForShift(doctor, date, token.shiftName);
                        if (nextDayStr) {
                            token.originalDate = token.originalDate || token.date;
                            token.date = nextDayStr;
                            token.isRescheduled = true;
                            token.priority = 1;
                            token.notes = `Auto-rescheduled from ${token.originalDate} due to doctor absence.`;
                            await token.save();
                        } else {
                            token.status = 'DOC_UNVAILABLE';
                            token.notes = `Doctor Unavailable. Could not find a future shift to auto-reschedule.`;
                            await token.save();
                        }
                    }
                }
                sendToBrand(instId, { type: 'TOKENS_UPDATED' }, 'tests_queue_updated');
            }
        }
        
        res.status(200).json(doctor.dailyOverrides);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 6. REVOKE ABSENCE (Restores Ledger & Patients)
// ==========================================
router.delete("/:doctorId/absence/:date", authenticateUser, async (req, res) => {
    try {
        const { date } = req.params;
        const instId = req.user.institutionId;
        const doctor = await Doctor.findOne({ doctorId: req.params.doctorId, institutionId: instId });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        const Institution = require("../models/Institutions");
        const institution = await Institution.findOne({ institutionId: instId });
        const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
        const TenantQueueToken = getModel(tenantDb, "QueueToken", QueueTokenSchema);

        let shiftsToRestore = [];
        let restoreAllShifts = false;

        // 1. Remove Overrides & Reverse Metrics
        const overridesForDate = doctor.dailyOverrides.filter(o => o.date === date);
        if (overridesForDate.length > 0) {
            
            // --- REVERSE AD-HOC LEAVE LEDGER ---
            const todayIndex = moment(date).day();
            const todayShifts = doctor.schedule.find(s => s.dayOfWeek === todayIndex)?.shifts || [];
            const cancelledShifts = overridesForDate.filter(o => o.isCancelled).flatMap(o => o.shiftNames || []);
            
            if (cancelledShifts.length > 0) shiftsToRestore.push(...cancelledShifts);

            let daysToRefund = 0;
            if (cancelledShifts.length >= todayShifts.length && todayShifts.length > 0) {
                daysToRefund = 1;
            } else if (cancelledShifts.length > 0 && todayShifts.length > 0) {
                daysToRefund = cancelledShifts.length / todayShifts.length;
            }

            if (daysToRefund > 0) {
                doctor.metrics.leavesTaken = Math.max(0, doctor.metrics.leavesTaken - daysToRefund);
                doctor.leaveAuditLogs.push({
                    action: "REVOKE_AD_HOC",
                    byUserName: req.user.username,
                    details: `Revoked Ad-Hoc Leave for ${date}. Refunded ${daysToRefund} day(s) to balance.`
                });
            }

            for (let o of overridesForDate) {
                if (o.isCancelled) doctor.metrics.cancellationsCount = Math.max(0, doctor.metrics.cancellationsCount - 1);
                if (o.delayMinutes > 0) doctor.metrics.lateCount = Math.max(0, doctor.metrics.lateCount - 1);
            }
            doctor.dailyOverrides = doctor.dailyOverrides.filter(o => o.date !== date);
        }

        // 2. Remove Planned Leaves that cover this date & Reverse Metric
        const leaveIndex = doctor.leaves.findIndex(l => date >= l.startDate && date <= l.endDate);
        if (leaveIndex > -1) {
            const targetLeave = doctor.leaves[leaveIndex];

            if (!targetLeave.shiftNames || targetLeave.shiftNames.length === 0) {
                restoreAllShifts = true;
            } else {
                shiftsToRestore.push(...targetLeave.shiftNames);
            }

            doctor.leaves.splice(leaveIndex, 1);
            
            doctor.metrics.leavesTaken = Math.max(0, doctor.metrics.leavesTaken - (targetLeave.leaveDaysCount || 0));
            doctor.leaveAuditLogs.push({
                action: "FULL_REVOKE",
                byUserName: req.user.username,
                details: `Forced Revoke of Planned Leave (${targetLeave.startDate} to ${targetLeave.endDate}) via Master Reset.`
            });
        }

        // 3. --- SMART PATIENT RESTORATION ---
        if (restoreAllShifts || shiftsToRestore.length > 0) {
            let shiftFilter = {};
            if (!restoreAllShifts && shiftsToRestore.length > 0) {
                shiftFilter = { shiftName: { $in: shiftsToRestore } };
            }

            await TenantQueueToken.updateMany(
                {
                    date: date,
                    doctorId: doctor._id,
                    status: 'DOC_UNVAILABLE', // Only restore tokens that are actively dead
                    ...shiftFilter
                },
                {
                    $set: {
                        status: 'WAITING',
                        notes: 'Schedule restored. Leave revoked.'
                    }
                }
            );
        }

        await doctor.save();
        res.status(200).json({ message: "Absence revoked and schedule restored." });
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


// --- HELPER: Calculate Actual Working Days (Supports Partial Shifts) ---
const calculateWorkingDays = (datesArray, schedule, targetShifts = []) => {
    let count = 0;
    datesArray.forEach(dateStr => {
        const dayIndex = moment(dateStr).day();
        const daySch = schedule.find(s => s.dayOfWeek === dayIndex);
        
        if (daySch && daySch.isAvailable && daySch.shifts?.length > 0) {
            if (targetShifts && targetShifts.length > 0) {
                const matchingShifts = daySch.shifts.filter(s => targetShifts.includes(s.shiftName)).length;
                count += (matchingShifts / daySch.shifts.length);
            } else {
                count += 1;
            }
        }
    });
    return count;
};

const getDatesInRange = (startDate, endDate) => {
    let dates = [];
    let curr = moment(startDate);
    let end = moment(endDate);
    while (curr <= end) {
        dates.push(curr.format('YYYY-MM-DD'));
        curr.add(1, 'days');
    }
    return dates;
};

// ==========================================
// 7. PLANNED LEAVE MANAGEMENT (LEDGER)
// ==========================================

// A. ADD PLANNED LEAVE
router.post("/:doctorId/leaves", authenticateUser, async (req, res) => {
    try {
        const { startDate, endDate, reason, shiftNames } = req.body;
        const instId = req.user.institutionId;
        const doctor = await Doctor.findOne({ doctorId: req.params.doctorId, institutionId: instId });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        const requestedDates = getDatesInRange(startDate, endDate);

        // STRICT BACKEND OVERLAP CHECK
        for (let d of requestedDates) {
            const existingLeave = doctor.leaves.find(l => d >= l.startDate && d <= l.endDate);
            if (existingLeave) {
                const isExistingFullDay = !existingLeave.shiftNames || existingLeave.shiftNames.length === 0;
                const isRequestFullDay = !shiftNames || shiftNames.length === 0;
                
                if (isExistingFullDay || isRequestFullDay) {
                    return res.status(400).json({ message: `Leave overlap detected. A leave is already registered on ${d}.` });
                } else {
                    const overlappingShift = shiftNames.some(s => existingLeave.shiftNames.includes(s));
                    if (overlappingShift) {
                         return res.status(400).json({ message: `Shift leave overlap detected on ${d}. This shift is already off.` });
                    }
                }
            }
        }

        const daysToConsume = calculateWorkingDays(requestedDates, doctor.schedule, shiftNames);

        if (daysToConsume === 0) {
            return res.status(400).json({ message: "Leave rejected: Doctor has no working shifts matching this request during this date range." });
        }

        const currentTaken = doctor.metrics.leavesTaken || 0;
        const limit = doctor.leaveSettings?.leaveLimitPerYear || 20;
        if (currentTaken + daysToConsume > limit) {
            return res.status(400).json({ message: `Leave rejected: Exceeds annual limit. Requested ${daysToConsume}, but only ${limit - currentTaken} remaining.` });
        }

        // Apply Leave
        doctor.leaves.push({ startDate, endDate, reason, shiftNames: shiftNames || [], leaveDaysCount: daysToConsume });
        doctor.metrics.leavesTaken += daysToConsume;
        
        // Log to Ledger
        const scopeStr = (shiftNames && shiftNames.length > 0) ? `Shifts: ${shiftNames.join(', ')}` : "Full Day";
        doctor.leaveAuditLogs.push({
            action: "GRANTED",
            byUserName: req.user.username,
            details: `Granted ${daysToConsume} day(s) from ${startDate} to ${endDate} (${scopeStr}). Reason: ${reason}`
        });

        await doctor.save();

        // --- NEW: APPLY QUEUE CANCELLATION FOR PLANNED LEAVE ---
        const Institution = require("../models/Institutions");
        const institution = await Institution.findOne({ institutionId: instId });
        const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
        const TenantQueueToken = getModel(tenantDb, "QueueToken", QueueTokenSchema);

        let shiftFilter = {};
        if (shiftNames && shiftNames.length > 0) {
            shiftFilter = { shiftName: { $in: shiftNames } };
        }

        const policyToApply = institution.settings?.queuePolicies?.dayCancelPolicy || 'MANUAL_ALLOCATION';

        const affectedTokens = await TenantQueueToken.find({
            date: { $in: requestedDates },
            doctorId: doctor._id,
            status: { $in: ['WAITING', 'HOLD'] },
            ...shiftFilter
        });

        if (affectedTokens.length > 0) {
            if (policyToApply === 'CANCEL_ALL') {
                await TenantQueueToken.updateMany(
                    { _id: { $in: affectedTokens.map(t => t._id) } },
                    { $set: { status: 'DOC_UNVAILABLE', notes: `Doctor Planned Leave. Policy: Cancel All.` } }
                );
            } else if (policyToApply === 'MANUAL_ALLOCATION') {
                await TenantQueueToken.updateMany(
                    { _id: { $in: affectedTokens.map(t => t._id) } },
                    { $set: { status: 'DOC_UNVAILABLE', isRescheduled: false, notes: `Doctor Planned Leave. Action Required.` } }
                );
            } else if (policyToApply === 'AUTO_NEXT_AVAILABLE') {
                // Shift patients to the day after the leave block ends
                let nextDay = moment(endDate).add(1, 'days');
                for (let token of affectedTokens) {
                    token.date = nextDay.format("YYYY-MM-DD");
                    token.isRescheduled = true;
                    token.priority = 1;
                    await token.save();
                }
            }
        }

        res.status(200).json(doctor);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B. REVOKE LEAVE (Full or Partial)
router.put("/:doctorId/leaves/:leaveId/revoke", authenticateUser, async (req, res) => {
    try {
        const { datesToRevoke } = req.body; 
        const instId = req.user.institutionId;
        const doctor = await Doctor.findOne({ doctorId: req.params.doctorId, institutionId: instId });
        
        const leaveIndex = doctor.leaves.findIndex(l => l._id.toString() === req.params.leaveId);
        if (leaveIndex === -1) return res.status(404).json({ message: "Leave record not found" });

        const targetLeave = doctor.leaves[leaveIndex];
        const allOriginalDates = getDatesInRange(targetLeave.startDate, targetLeave.endDate);
        const remainingDates = allOriginalDates.filter(d => !datesToRevoke.includes(d));

        const daysToRefund = calculateWorkingDays(datesToRevoke, doctor.schedule, targetLeave.shiftNames);

        doctor.leaves.splice(leaveIndex, 1);
        doctor.metrics.leavesTaken = Math.max(0, doctor.metrics.leavesTaken - daysToRefund);

        if (remainingDates.length > 0) {
            let blocks = [];
            let currentBlock = [remainingDates[0]];

            for (let i = 1; i < remainingDates.length; i++) {
                if (moment(remainingDates[i]).diff(moment(remainingDates[i-1]), 'days') === 1) {
                    currentBlock.push(remainingDates[i]);
                } else {
                    blocks.push(currentBlock);
                    currentBlock = [remainingDates[i]];
                }
            }
            blocks.push(currentBlock);

            blocks.forEach(block => {
                doctor.leaves.push({
                    startDate: block[0],
                    endDate: block[block.length - 1],
                    shiftNames: targetLeave.shiftNames, 
                    reason: targetLeave.reason + " (Split after partial revoke)",
                    leaveDaysCount: calculateWorkingDays(block, doctor.schedule, targetLeave.shiftNames)
                });
            });
        }

        doctor.leaveAuditLogs.push({
            action: remainingDates.length === 0 ? "FULL_REVOKE" : "PARTIAL_REVOKE",
            byUserName: req.user.username,
            details: `Revoked ${daysToRefund} working day(s) from original leave (${targetLeave.startDate} to ${targetLeave.endDate}). Dates revoked: ${datesToRevoke.join(', ')}`
        });

        // --- RESTORE QUEUE TOKENS ---
        const Institution = require("../models/Institutions");
        const institution = await Institution.findOne({ institutionId: instId });
        const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
        const TenantQueueToken = getModel(tenantDb, "QueueToken", QueueTokenSchema);

        let shiftFilter = {};
        if (targetLeave.shiftNames && targetLeave.shiftNames.length > 0) {
            shiftFilter = { shiftName: { $in: targetLeave.shiftNames } };
        }

        await TenantQueueToken.updateMany(
            {
                date: { $in: datesToRevoke },
                doctorId: doctor._id,
                status: 'DOC_UNVAILABLE',
                ...shiftFilter
            },
            {
                $set: {
                    status: 'WAITING',
                    notes: 'Schedule restored. Planned Leave revoked.'
                }
            }
        );

        await doctor.save();
        res.status(200).json(doctor);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;