const express = require("express");
const router = express.Router();
const moment = require("moment");
const mongoose = require("mongoose");

const Institution = require("../models/Institutions");
const Order = require("../models/Order");
const QueueState = require("../models/QueueState");
const Doctor = require("../models/Doctor");
const QueueTokenSchema = require("../models/QueueToken");
const DailyCounterSchema = require("../models/DailyCounter");
const LiveShiftSchema = require("../models/LiveShift");
const { authenticateUser } = require("../middleware/auth");
const getModel = require("../middleware/getModelsHandler");
const { sendToBrand } = require("../sseManager");

// ==========================================
// 1. GLOBAL TENANT CONTEXT MIDDLEWARE
// ==========================================
// We apply this globally to ALL routes in this file so req.TenantQueueToken never crashes.
const getTenantContext = async (req, res, next) => {
    try {
        const institution = await Institution.findOne({ institutionId: req.user.institutionId });
        if (!institution) return res.status(404).json({ message: "Institution not found." });
        
        const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
        req.TenantQueueToken = getModel(tenantDb, "QueueToken", QueueTokenSchema);
        req.TenantDailyCounter = getModel(tenantDb, "DailyCounter", DailyCounterSchema);
        req.TenantLiveShift = getModel(tenantDb, "LiveShift", LiveShiftSchema);
        next();
    } catch (err) {
        res.status(500).json({ message: "Database Connection Error" });
    }
};

// Apply to ALL routes
router.use(authenticateUser, getTenantContext);


// ==========================================
// 2. CORE QUEUE FETCHING
// ==========================================

// GET ALL TOKENS (WITH FILTERS) - Used by Doctor Workspace
router.get("/", async (req, res) => {
    try {
        const { date, department, doctorId, status, isRescheduled } = req.query;
        let query = { institutionId: req.user.institutionId };

        if (date) query.date = date;
        if (department) query.department = department;
        if (doctorId) query.doctorId = doctorId; 
        if (status) query.status = status;
        if (isRescheduled !== undefined) query.isRescheduled = isRescheduled === 'true';
        const tokens = await req.TenantQueueToken.find(query)
            .sort({ priority: -1, sequence: 1 }) // Priority first!
            .populate('doctorId', 'personalInfo professionalInfo');
        res.status(200).json(tokens);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET LIVE QUEUE FOR SPECIFIC DEPARTMENT
router.get("/department/:deptName", async (req, res) => {
    try {
        const todayStr = moment().format("YYYY-MM-DD");
        const queue = await req.TenantQueueToken.find({
            institutionId: req.user.institutionId,
            date: todayStr,
            department: req.params.deptName,
            status: { $in: ['WAITING','IN_CABIN', 'CALLED', 'IN_PROGRESS', 'HOLD'] } 
        }).sort({ sequence: 1 });
        
        res.json(queue);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 3. PHYSICAL COUNTER MANAGEMENT
// ==========================================

// Fetch Physical Layout
router.get("/counters", async (req, res) => {
    try {
        const institution = await Institution.findOne({ institutionId: req.user.institutionId });
        res.json({
            departments: institution.settings?.queue?.departments || [],
            counters: institution.counters || []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Desk Status (e.g. Pause, Close)
router.put("/counters/:counterId/status", async (req, res) => {
    try {
        const { status } = req.body; 
        await Institution.updateOne(
            { institutionId: req.user.institutionId, "counters.counterId": req.params.counterId },
            { $set: { "counters.$.status": status, "counters.$.currentStaffId": req.user._id } }
        );
        res.json({ message: "Counter status updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 4. QUEUE TOKEN ACTIONS
// ==========================================

// ATOMIC CALL NEXT: Assigns oldest waiting patient to the requesting counter
router.post("/department/:dept/call-next", async (req, res) => {
    try {
        const { counterId, counterName } = req.body;
        const todayStr = moment().format("YYYY-MM-DD");
         const instId = req.user.institutionId;
         const brandCode = req.user.brand;
        const token = await req.TenantQueueToken.findOneAndUpdate(
            { 
                institutionId: instId, 
                date: todayStr, 
                department: req.params.dept,
                status: 'WAITING' 
            },
            { 
                $set: { 
                    status: 'CALLED', 
                    calledAt: new Date(),
                    assignedCounterId: counterId,
                    assignedCounterName: counterName,
                    assignedStaffId: req.user._id 
                } 
            },
            { new: true, sort: { sequence: 1 } } 
        );

        if (!token) return res.status(404).json({ message: "No patients waiting in queue." });

        sendToBrand(brandCode, { 
                    type: 'TV_ANNOUNCEMENT', 
                    token: token.tokenNumber, 
                    counterName: token.assignedCounterName 
                }, 'tv_display');

        sendToBrand(brandCode, { type: 'QUEUE_UPDATE', token: token }, `queue_${token.department}`);

        res.json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DIRECT STATUS CONTROL (Start, Complete, Hold, Recall, Send to Cabin)
router.put("/token/:tokenId/action", async (req, res) => {
    try {
        const { action } = req.body; 
        const brandCode = req.user.brand;
        const token = await req.TenantQueueToken.findById(req.params.tokenId);
        if (!token) return res.status(404).json({ message: "Token not found" });
        switch(action) {
            case "START": 
                token.status = "IN_PROGRESS"; 
                console.log("sent sse IN_PROGRESS")
                sendToBrand(brandCode, { type: 'TOKEN_UPDATED', token: token }, 'tests_queue_updated');
                break;
            case "COMPLETE":
                token.status = "COMPLETED";
                token.completedAt = new Date();
                sendToBrand(brandCode, { type: 'TOKEN_UPDATED', token: token }, 'tests_queue_updated');
                break;
            case "HOLD": 
                token.status = "HOLD"; 
                sendToBrand(brandCode, { type: 'TOKEN_UPDATED', token: token }, 'tests_queue_updated');
                break;
            case "RECALL":
                token.status = "CALLED";
                token.calledAt = new Date();
                sendToBrand(brandCode, { 
                    type: 'TV_ANNOUNCEMENT', 
                    token: token.tokenNumber, 
                    counterName: token.assignedCounterName 
                }, 'tv_display');
                sendToBrand(brandCode, { type: 'TOKEN_UPDATED', token: token }, 'tests_queue_updated');
                break;
            // --- NEW: Handle SEND_TO_CABIN action ---
            case "SEND_TO_CABIN":
                token.status = "IN_CABIN";
                token.calledAt = new Date();
                sendToBrand(brandCode, { 
                    type: 'TV_ANNOUNCEMENT', 
                    token: token.tokenNumber, 
                }, 'tv_display');
                sendToBrand(brandCode, { type: 'TOKEN_UPDATED', token: token }, 'tests_queue_updated');
                break;
        }

        await token.save();
        
        // --- CRITICAL FIX: Send to unified channel so App.jsx picks it up ---
        sendToBrand(brandCode, { type: 'TOKEN_UPDATED', token: token }, 'tests_queue_updated');

        res.json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 5. DOCTOR EMR (PRESCRIPTION)
// ==========================================

// SAVE PRESCRIPTION & COMPLETE CONSULTATION
router.put("/:id/prescription", async (req, res) => {
    try {
        const { prescriptionHtml } = req.body;
         const instId = req.user.institutionId;
        const brandCode = req.user.brand;
        const token = await req.TenantQueueToken.findOneAndUpdate(
            { _id: req.params.id, institutionId: instId },
            { 
                $set: { 
                    prescriptionHtml, 
                    status: 'COMPLETED', 
                    completedAt: new Date() 
                } 
            },
            { new: true }
        );

        if (!token) return res.status(404).json({ message: "Token not found" });
        console.log("sse fired for prescription")
        // Trigger SSE to remove the patient from "In Progress" TV screens
        sendToBrand(brandCode, { type: 'TOKEN_UPDATED', token: token }, 'tests_queue_updated');
        res.status(200).json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 6. EMERGENCY RESCHEDULING 
// ==========================================
router.put("/token/:tokenId/reschedule", async (req, res) => {
    try {
        const { newDate, newShiftName } = req.body;
        const instId = req.user.institutionId;
        const brandCode = req.user.brand;
        const token = await req.TenantQueueToken.findOne({ _id: req.params.tokenId, institutionId: instId });
        if (!token) return res.status(404).json({ message: "Token not found" });

        // 1. Generate a new sequence number for the NEW date & shift
        const counterKey = `DOC_${token.doctorId}_${newShiftName}`;
        const queueCounter = await req.TenantDailyCounter.findOneAndUpdate(
            { institutionId: instId, date: newDate, department: counterKey },
            { $inc: { sequence_value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        
        // 2. Re-format the Token String (e.g. DRSMI-001)
        const prefix = token.tokenNumber.split('-')[0]; // Keep original prefix
        const newTokenNumber = `${prefix}-${String(queueCounter.sequence_value).padStart(3, '0')}`;

        // 3. Update the token!
        token.originalDate = token.originalDate || token.date; // Preserve first booking date
        token.date = newDate;
        token.shiftName = newShiftName;
        token.sequence = queueCounter.sequence_value;
        token.tokenNumber = newTokenNumber;
        token.status = 'WAITING'; // Back into the live queue
        token.priority = 1;       // Priority treatment!
        token.isRescheduled = true;
        token.notes = token.notes + ` | Rescheduled to ${newDate}`;

        await token.save();
        sendToBrand(brandCode, { type: 'TOKEN_UPDATED', token: token }, 'tests_queue_updated');
        res.status(200).json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 7. LIVE SHIFT MANAGEMENT
// ==========================================

// Get today's live shifts for a specific doctor
router.get("/shifts/:doctorId", async (req, res) => {
    try {
        const todayStr = moment().format("YYYY-MM-DD");
        const shifts = await req.TenantLiveShift.find({
            institutionId: req.user.institutionId,
            date: todayStr,
            doctorId: req.params.doctorId
        });
        res.json(shifts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Action on a Shift (START, COMPLETE, CANCEL)
router.post("/shifts/:doctorId/action", async (req, res) => {
    try {
        const { action, shiftName, plannedStartTime, plannedEndTime, maxTokens, cancelReason } = req.body;
        const todayStr = moment().format("YYYY-MM-DD");
        const instId = req.user.institutionId;
        const doctorId = req.params.doctorId;

        // Find existing or initialize a new shift tracking doc
        let liveShift = await req.TenantLiveShift.findOne({
            institutionId: instId,
            date: todayStr,
            doctorId: doctorId,
            shiftName: shiftName
        });

        if (!liveShift && action === 'START') {
            liveShift = new req.TenantLiveShift({
                institutionId: instId,
                date: todayStr,
                doctorId: doctorId,
                shiftName: shiftName,
                plannedStartTime,
                plannedEndTime,
                maxTokens
            });
        }

        if (!liveShift) {
            return res.status(404).json({ message: "Shift not found or not started yet." });
        }

        switch(action) {
            case 'START':
                if (liveShift.status !== 'IN_PROGRESS') {
                    liveShift.status = 'IN_PROGRESS';
                    liveShift.actualStartTime = new Date();
                    liveShift.startedBy = req.user.userId;
                }
                break;
            case 'COMPLETE':
                liveShift.status = 'COMPLETED';
                liveShift.actualEndTime = new Date();
                break;
            case 'CANCEL':
                liveShift.status = 'CANCELLED';
                liveShift.cancelledBy = req.user.userId;
                liveShift.cancelReason = cancelReason || "Cancelled by user";
                liveShift.actualEndTime = new Date();
                // --- NEW: AUTO-SYNC CANCELLATION TO DOCTOR PROFILE ---
                const doc = await Doctor.findOne({ _id: doctorId, institutionId: instId });
                if (doc) {
                    let override = doc.dailyOverrides.find(o => o.date === todayStr);
                    if (override) {
                        override.isCancelled = true;
                        if (!override.shiftNames) override.shiftNames = [];
                        if (!override.shiftNames.includes(shiftName)) {
                            override.shiftNames.push(shiftName);
                        }
                    } else {
                        doc.dailyOverrides.push({
                            date: todayStr,
                            isCancelled: true,
                            shiftNames: [shiftName],
                            note: "Auto-cancelled via Live Workspace"
                        });
                    }
                    await doc.save();
                }
                break;
            default:
                return res.status(400).json({ message: "Invalid action" });
        }

        await liveShift.save();

        // Broadcast shift update so UI locks/unlocks instantly on all screens
        sendToBrand(instId, { type: 'SHIFT_UPDATED', shift: liveShift }, 'tests_queue_updated');

        res.json(liveShift);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper for Legacy Routes
const addMinutesToTimeStr = (timeStr, minutesToAdd) => {
    return moment(timeStr, ["h:mm A"]).add(minutesToAdd, 'minutes').format("hh:mm A");
};

module.exports = router;