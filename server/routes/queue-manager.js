const express = require("express");
const router = express.Router();
const moment = require("moment");
const mongoose = require("mongoose");

const Institution = require("../models/Institutions");
const Order = require("../models/Order");
const QueueState = require("../models/QueueState");
const Doctor = require("../models/Doctor");
const QueueTokenSchema = require("../models/QueueToken");

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
        const { date, department, doctorId } = req.query;
        let query = { institutionId: req.user.institutionId };

        if (date) query.date = date;
        if (department) query.department = department;
        if (doctorId) query.doctorId = doctorId; 

        const tokens = await req.TenantQueueToken.find(query).sort({ sequence: 1 });
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
            status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS', 'HOLD'] } 
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

        const token = await req.TenantQueueToken.findOneAndUpdate(
            { 
                institutionId: req.user.institutionId, 
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

        sendToBrand(req.user.institutionId, { 
            type: 'TV_ANNOUNCEMENT', 
            token: token.tokenNumber, 
            counterName: counterName 
        }, 'tv_display');

        sendToBrand(req.user.institutionId, { type: 'QUEUE_UPDATE', token: token }, `queue_${token.department}`);

        res.json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DIRECT STATUS CONTROL (Start, Complete, Hold, Recall)
router.put("/token/:tokenId/action", async (req, res) => {
    try {
        const { action } = req.body; 
        const token = await req.TenantQueueToken.findById(req.params.tokenId);
        if (!token) return res.status(404).json({ message: "Token not found" });

        switch(action) {
            case "START": 
                token.status = "IN_PROGRESS"; 
                break;
            case "COMPLETE":
                token.status = "COMPLETED";
                token.completedAt = new Date();
                break;
            case "HOLD": 
                token.status = "HOLD"; 
                break;
            case "RECALL":
                token.status = "CALLED";
                token.calledAt = new Date();
                sendToBrand(req.user.institutionId, { 
                    type: 'TV_ANNOUNCEMENT', 
                    token: token.tokenNumber, 
                    counterName: token.assignedCounterName 
                }, 'tv_display');
                break;
        }

        await token.save();
        sendToBrand(req.user.institutionId, { type: 'QUEUE_UPDATE', token: token }, `queue_${token.department}`);

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
        const brandCode = req.user.brandCode || "default";

        const token = await req.TenantQueueToken.findOneAndUpdate(
            { _id: req.params.id, institutionId: req.user.institutionId },
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

        // Trigger SSE to remove the patient from "In Progress" TV screens
        sendToBrand(brandCode, { type: 'TOKEN_UPDATED', token }, 'tests_queue_updated');

        res.status(200).json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Helper for Legacy Routes
const addMinutesToTimeStr = (timeStr, minutesToAdd) => {
    return moment(timeStr, ["h:mm A"]).add(minutesToAdd, 'minutes').format("hh:mm A");
};

module.exports = router;