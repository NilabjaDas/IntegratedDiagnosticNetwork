const express = require("express");
const router = express.Router();
const moment = require("moment");
const Order = require("../models/Order");
const QueueState = require("../models/QueueState");
const Doctor = require("../models/Doctor");
const { authenticateUser } = require("../middleware/auth");
const getModel = require("../middleware/getModelsHandler");
const QueueTokenSchema = require("../models/QueueToken");
const { sendToBrand } = require("../sseManager");
const Institution = require("../models/Institutions");
const mongoose = require("mongoose");

// 1. Add Tenant Context Middleware
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

router.use("/department", authenticateUser, getTenantContext);
router.use("/token", authenticateUser, getTenantContext);


// 2. Fetch Live Queue for a specific Department
router.get("/department/:deptName", async (req, res) => {
    try {
        const todayStr = moment().format("YYYY-MM-DD");
        const queue = await req.TenantQueueToken.find({
            institutionId: req.user.institutionId,
            date: todayStr,
            department: req.params.deptName,
            status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS', 'HOLD'] } // Ignore completed
        }).sort({ sequence: 1 });
        
        res.json(queue);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Control Token Status (Call, Start, Complete, Hold)
router.put("/token/:tokenId/action", async (req, res) => {
    try {
        const { action } = req.body; 
        const token = await req.TenantQueueToken.findById(req.params.tokenId);
        if (!token) return res.status(404).json({ message: "Token not found" });

        switch(action) {
            case "CALL":
                token.status = "CALLED";
                token.calledAt = new Date();
                // Broadcast to Waiting Room TVs!
                sendToBrand(req.user.institutionId, { type: 'TV_ANNOUNCEMENT', token: token.tokenNumber, counter: req.user.username }, 'tv_display');
                break;
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
        }

        await token.save();
        
        // Broadcast to the specific department's technicians to update their screens
        sendToBrand(req.user.institutionId, { type: 'QUEUE_UPDATE', token: token }, `queue_${token.department}`);

        res.json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to add minutes to "10:30 AM"
const addMinutesToTimeStr = (timeStr, minutesToAdd) => {
  return moment(timeStr, ["h:mm A"]).add(minutesToAdd, 'minutes').format("hh:mm A");
};

// 1. UPDATE VISIT STATUS (Receptionist Action)
// POST /api/queue/update-status
router.post("/update-status", authenticateUser, async (req, res) => {
  try {
    const { orderId, status } = req.body; 
    // status: "Checked-In" | "In-Progress" | "Completed" | "Skipped"
    
    const instId = req.user.institutionId;

    const order = await Order.findOne({ _id: orderId, institutionId: instId });
    if (!order) return res.status(404).json({ message: "Appointment not found" });

    // Update the Order Status
    order.appointment.status = status;
    await order.save();

    // === LIVE DELAY CALCULATION LOGIC ===
    if (status === "Completed") {
        const doctorId = order.appointment.doctorId;
        const todayStr = moment().format("YYYY-MM-DD");

        // 1. Get/Create Queue State for today
        let queueState = await QueueState.findOne({ 
            institutionId: instId, doctorId, date: todayStr 
        });

        if (!queueState) {
            queueState = new QueueState({ institutionId: instId, doctorId, date: todayStr });
        }

        // 2. Update Current Token
        queueState.currentTokenProcessing = order.appointment.tokenNumber;

        // 3. Calculate Delay
        // We compare NOW vs. When this patient was SUPPOSED to finish.
        // But simpler: Compare NOW vs. When the NEXT patient was supposed to start.
        
        const doc = await Doctor.findById(doctorId);
        const scheduledTimeStr = order.appointment.estimatedTime; // "10:15 AM"
        
        // Expected Finish = Start + AvgTime
        const expectedFinish = moment(scheduledTimeStr, ["h:mm A"])
                               .add(doc.avgTimePerPatient, 'minutes');
        const actualFinish = moment(); // Now

        const diffMinutes = actualFinish.diff(expectedFinish, 'minutes');

        // Only register delay if it's significant (> 5 mins late)
        // And we don't reduce delay (doctors rarely catch up, usually only get later)
        if (diffMinutes > 5) {
            // This is the *incremental* delay caused by THIS patient
            // We add it to the cumulative delay
            // Note: This logic can be tuned. Simplest is:
            // New Cumulative Delay = Actual Now - Original Schedule of Next Patient
             
            // Let's just Add the difference to the global delay tracker
            queueState.cumulativeDelay += diffMinutes;
            
            // 4. TRIGGER: Shift all FUTURE appointments for today
            await shiftFutureAppointments(instId, doctorId, todayStr, order.appointment.tokenNumber, diffMinutes);
        }

        await queueState.save();
    }

    res.json({ message: "Status updated", status: status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// === INTERNAL HELPER FUNCTION ===
async function shiftFutureAppointments(instId, doctorId, dateStr, currentToken, delayMinutes) {
    console.log(`⚠️ Shifting Queue for Dr ${doctorId}: +${delayMinutes} mins`);
    
    // Find all orders for this doctor, today, with Token > CurrentToken
    const startOfDay = moment(dateStr).startOf('day').toDate();
    const endOfDay = moment(dateStr).endOf('day').toDate();

    const futureOrders = await Order.find({
        institutionId: instId,
        "appointment.doctorId": doctorId,
        "appointment.date": { $gte: startOfDay, $lte: endOfDay },
        "appointment.tokenNumber": { $gt: currentToken },
        "appointment.status": "Scheduled" // Only shift pending ones
    });

    // Bulk Update for performance
    const bulkOps = futureOrders.map(order => {
        const newTime = addMinutesToTimeStr(order.appointment.estimatedTime, delayMinutes);
        return {
            updateOne: {
                filter: { _id: order._id },
                update: { $set: { "appointment.estimatedTime": newTime } }
            }
        };
    });

    if (bulkOps.length > 0) {
        await Order.bulkWrite(bulkOps);
        
        // OPTIONAL: Send "Sorry we are late" SMS here to `futureOrders`
        // notifyPatientsOfDelay(futureOrders, delayMinutes);
    }
}

// 2. GET LIVE STATUS (For Waiting Room Screen)
// GET /api/queue/status/:doctorId
router.get("/status/:doctorId", async (req, res) => {
    const { doctorId } = req.params;
    const todayStr = moment().format("YYYY-MM-DD");
    
    const state = await QueueState.findOne({ doctorId, date: todayStr });
    
    res.json({
        tokenRunning: state ? state.currentTokenProcessing : 0,
        currentDelay: state ? state.cumulativeDelay : 0,
        status: (state && state.cumulativeDelay > 15) ? "Delayed" : "On Time"
    });
});

// GET /api/queue/counters
// Fetches the physical layout so the frontend dropdown knows what desks exist
router.get("/counters", authenticateUser, async (req, res) => {
    try {
        const institution = await Institution.findOne({ institutionId: req.user.institutionId });
        res.json({
            departments: institution.settings.queue.departments,
            counters: institution.counters
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/queue/counters/:counterId/status
// Allows staff to Pause (e.g. Bathroom break) or Close their desk
router.put("/counters/:counterId/status", authenticateUser, async (req, res) => {
    try {
        const { status } = req.body; // "Online", "Paused", "Offline"
        
        await Institution.updateOne(
            { institutionId: req.user.institutionId, "counters.counterId": req.params.counterId },
            { $set: { "counters.$.status": status, "counters.$.currentStaffId": req.user._id } }
        );
        
        res.json({ message: "Counter status updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/queue/department/:dept
// Future Provision: We check req.user to see if they are assigned to this dept
router.get("/department/:dept", authenticateUser, async (req, res) => {
    try {
        const todayStr = moment().format("YYYY-MM-DD");
        const dept = req.params.dept;

        // Future RBAC check here: 
        // if (req.user.role !== 'Admin' && !req.user.departments.includes(dept)) return 403;

        const queue = await req.TenantQueueToken.find({
            institutionId: req.user.institutionId,
            date: todayStr,
            department: dept,
            status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS', 'HOLD'] } 
        }).sort({ sequence: 1 }); 

        res.json(queue);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/queue/department/:dept/call-next
// ATOMIC ROUTE: Finds the oldest WAITING patient and assigns them to the requesting counter
router.post("/department/:dept/call-next", authenticateUser, async (req, res) => {
    try {
        const { counterId, counterName } = req.body;
        const todayStr = moment().format("YYYY-MM-DD");

        // Use findOneAndUpdate to prevent race conditions!
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
                    assignedStaffId: req.user._id // Tracks exactly who called them
                } 
            },
            { new: true, sort: { sequence: 1 } } // Grabs the oldest one first
        );

        if (!token) return res.status(404).json({ message: "No patients waiting in queue." });

        // SSE: Broadcast to TVs "Token PAT-001 -> Desk 3"
        sendToBrand(req.user.institutionId, { 
            type: 'TV_ANNOUNCEMENT', 
            token: token.tokenNumber, 
            counterName: counterName 
        }, 'tv_display');

        // SSE: Update Staff Screens
        sendToBrand(req.user.institutionId, { type: 'QUEUE_UPDATE', token: token }, `queue_${token.department}`);

        res.json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/queue/token/:tokenId/action
// Actions: "START", "COMPLETE", "HOLD" (CALL is now handled by call-next)
router.put("/token/:tokenId/action", authenticateUser, async (req, res) => {
    try {
        const { action } = req.body; 
        const token = await req.TenantQueueToken.findById(req.params.tokenId);
        if (!token) return res.status(404).json({ message: "Token not found" });

        switch(action) {
            case "START": token.status = "IN_PROGRESS"; break;
            case "COMPLETE":
                token.status = "COMPLETED";
                token.completedAt = new Date();
                break;
            case "HOLD": token.status = "HOLD"; break;
            case "RECALL":
                token.status = "CALLED";
                token.calledAt = new Date();
                // Flash the TV again
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


module.exports = router;