const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");

const Institution = require("../models/Institutions");
const Patient = require("../models/Patient"); 

// Schemas
const OrderSchema = require("../models/Order");
const TestSchema = require("../models/Test");
const PackageSchema = require("../models/Package");
const UserSchema = require("../models/User");
const getModel = require("../middleware/getModelsHandler");
const { verifyToken } = require("../middleware/verifyToken");

// --- HELPER: Merge Patient Info ---
const mergePatientsWithOrders = async (orders) => {
    const isArray = Array.isArray(orders);
    const orderList = isArray ? orders : [orders];
    const patientIds = [...new Set(orderList.map(o => o.patientId).filter(id => id))];
    const patients = await Patient.find({ _id: { $in: patientIds } });
    const patientMap = {};
    patients.forEach(p => { patientMap[p._id.toString()] = p; });

    const merged = orderList.map(order => {
        const orderObj = order.toObject ? order.toObject() : order;
        orderObj.patientId = patientMap[orderObj.patientId.toString()] || null;
        return orderObj;
    });
    return isArray ? merged : merged[0];
};

// --- HELPER: Calculate Items & Total (Refactored) ---
const calculateOrderItems = async (itemsInput, req) => {
    let orderItems = [];
    let calculatedTotal = 0;

    for (const item of itemsInput) {
        if (item.type === 'Test') {
            const test = await req.TenantTest.findById(item._id);
            if (test) {
                calculatedTotal += (test.price || 0);
                orderItems.push({
                    itemType: "Test",
                    itemId: test._id,
                    name: test.name,
                    price: test.price || 0,
                    status: "Pending",
                    results: test.parameters?.map(p => ({ name: p.name, unit: p.unit, value: "" })) || []
                });
            }
        } else if (item.type === 'Package') {
            const pkg = await req.TenantPackage.findById(item._id).populate('tests');
            if (pkg) {
                calculatedTotal += (pkg.offerPrice || 0);
                if (pkg.tests) {
                    pkg.tests.forEach(t => {
                        if (t._id) {
                            orderItems.push({
                                itemType: "Test",
                                itemId: t._id,
                                name: `${t.name} (Pkg)`,
                                price: 0, // Package contents have 0 individual price
                                parentPackageId: pkg._id,
                                status: "Pending",
                                results: t.parameters?.map(p => ({ name: p.name, unit: p.unit, value: "" })) || []
                            });
                        }
                    });
                }
            }
        }
    }
    return { orderItems, calculatedTotal };
};

// --- MIDDLEWARE ---
const getTenantContext = async (req, res, next) => {
  try {
    const institutionId = req.user.institutionId;
    if (!institutionId) return res.status(400).json({ message: "Institution ID missing." });

    const institution = await Institution.findOne({ institutionId });
    if (!institution) return res.status(404).json({ message: "Institution not found." });

    const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
    req.TenantOrder = getModel(tenantDb, "Order", OrderSchema);
    req.TenantTest = getModel(tenantDb, "Test", TestSchema);
    req.TenantPackage = getModel(tenantDb, "Package", PackageSchema);
    req.TenantUser = getModel(tenantDb, "User", UserSchema);
    next();
  } catch (err) {
    res.status(500).json({ message: "Database Connection Error" });
  }
};

router.use(verifyToken, getTenantContext);


// Helper function to validate discount
const validateDiscount = async (userModel, userId, totalAmount, discountAmount) => {
    if (discountAmount <= 0) return true; // No discount, no problem

    const user = await userModel.findOne({ userId });
    if (!user) throw new Error("User not found for validation");

    // Bypass check for Super/Master Admins if you have that flag, 
    // otherwise strictly follow maxDiscountPercent
    
    const requestedPercent = (discountAmount / totalAmount) * 100;
    const allowedPercent = user.settings?.maxDiscountPercent || 0;

    if (requestedPercent > allowedPercent) {
        throw new Error(`Access Denied: You are only authorized to give up to ${allowedPercent}% discount. (Requested: ${requestedPercent.toFixed(1)}%)`);
    }
    
    return user.fullName; // Return name for logging
};

// 1. CREATE ORDER
router.post("/", async (req, res) => {
  try {
    const { 
        patientId, 
        items, 
        paymentMode, 
        discountAmount = 0, 
        discountReason, // NEW
        initialPayment, 
        notes 
    } = req.body;
    
    const instId = req.user.institutionId;

    // A. Verify Patient
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found." });

    // B. Calculate Items (Using Helper from previous step)
    const { orderItems, calculatedTotal } = await calculateOrderItems(items, req);
    if (orderItems.length === 0) return res.status(400).json({ message: "No valid items." });
    let authorizerName = null;
    if (discountAmount > 0) {
        try {
            authorizerName = await validateDiscount(req.TenantUser, req.user.userId, calculatedTotal, discountAmount);
        } catch (e) {
            return res.status(403).json({ message: e.message });
        }
    }
    // C. Generate ID
    const startOfDay = moment().startOf('day').toDate();
    const count = await req.TenantOrder.countDocuments({ createdAt: { $gte: startOfDay } });
    const displayId = `${moment().format("YYMMDD")}-${String(count + 1).padStart(3, '0')}`;

    // D. Financials
    let financials = {
        totalAmount: calculatedTotal,
        discountAmount,
        discountReason, // Store Reason
        discountAuthorizedBy: authorizerName ? `${authorizerName} (${req.user.userId})` : null,
        netAmount: calculatedTotal - discountAmount,
        paidAmount: 0,
        dueAmount: calculatedTotal - discountAmount,
        status: "Pending"
    };

    // E. Initial Payment
    let transactions = [];
    if (initialPayment && initialPayment.amount > 0) {
        transactions.push({
            paymentMode: initialPayment.mode,
            amount: Number(initialPayment.amount),
            transactionId: initialPayment.transactionId,
            notes: initialPayment.notes,
            recordedBy: req.user.userId,
            date: new Date()
        });
        financials.paidAmount = Number(initialPayment.amount);
        financials.dueAmount = financials.netAmount - financials.paidAmount;
        financials.status = financials.dueAmount <= 0 ? "Paid" : "PartiallyPaid";
    }

    // F. Save
    const newOrder = new req.TenantOrder({
      institutionId: instId,
      orderId: uuidv4(),
      displayId,
      patientId: patient._id, 
      items: orderItems,
      financials,
      transactions,
      notes
    });

    await newOrder.save();
    
    if(!patient.enrolledInstitutions.includes(instId)){
        patient.enrolledInstitutions.push(instId);
        await patient.save();
    }

    res.status(201).json(newOrder);

  } catch (err) {
    console.error("Order Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 2. LIST ORDERS
router.get("/", async (req, res) => {
  try {
    const { search, startDate, endDate } = req.query;
    let query = {};

    if (startDate && endDate) {
        query.createdAt = {
            $gte: moment(startDate).startOf('day').toDate(),
            $lte: moment(endDate).endOf('day').toDate()
        };
    }
    if (search) {
        query.displayId = { $regex: search, $options: 'i' };
    }

    const orders = await req.TenantOrder.find(query).sort({ createdAt: -1 }).limit(50);
    const mergedOrders = await mergePatientsWithOrders(orders);

    res.json(mergedOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. GET SINGLE ORDER
router.get("/:id", async (req, res) => {
  try {
    const order = await req.TenantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const mergedOrder = await mergePatientsWithOrders(order);
    res.json(mergedOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 4. MODIFY ORDER (Add/Remove Items)
// ==========================================
router.put("/:id/items", async (req, res) => {
    try {
        const { items, discountAmount } = req.body; // Expecting NEW full list of items
        const order = await req.TenantOrder.findById(req.params.id);
        
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.cancellation.isCancelled) return res.status(400).json({ message: "Cannot modify cancelled order." });

        // Recalculate everything based on new items list
        const { orderItems, calculatedTotal } = await calculateOrderItems(items, req);

        // Update Items
        order.items = orderItems;

        // Recalculate Financials (Preserve paidAmount)
        order.financials.totalAmount = calculatedTotal;
        const currentDiscount = discountAmount !== undefined ? discountAmount : order.financials.discountAmount;
        if (currentDiscount > 0) {
            try {
                const authName = await validateDiscount(req.TenantUser, req.user.userId, calculatedTotal, currentDiscount);
                order.financials.discountAuthorizedBy = `${authName} (${req.user.userId})`;
            } catch (e) {
                return res.status(403).json({ message: e.message });
            }
        }
        if(discountAmount !== undefined) order.financials.discountAmount = discountAmount;
        
        order.financials.netAmount = order.financials.totalAmount - order.financials.discountAmount;
        
        // Logic: If netAmount drops below paidAmount (Refund scenario), handle as 'Paid' but negative due?
        // Usually, we keep it simple:
        order.financials.dueAmount = order.financials.netAmount - order.financials.paidAmount;
        
        // Status Update
        if (order.financials.dueAmount <= 0) order.financials.status = "Paid";
        else if (order.financials.paidAmount > 0) order.financials.status = "PartiallyPaid";
        else order.financials.status = "Pending";

        await order.save();
        res.json(order);

    } catch(err) {
        console.error("Modify Order Error:", err);
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 5. CANCEL ORDER
// ==========================================
router.put("/:id/cancel", async (req, res) => {
    try {
        const { reason } = req.body;
        const order = await req.TenantOrder.findById(req.params.id);
        
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.cancellation.isCancelled) return res.status(400).json({ message: "Order is already cancelled." });

        // Set Cancellation Details
        order.cancellation = {
            isCancelled: true,
            reason: reason || "No reason provided",
            cancelledBy: req.user.userId,
            date: new Date()
        };

        order.financials.status = "Cancelled";
        order.isReportDeliveryBlocked = true;

        // Mark all items as cancelled
        order.items.forEach(item => item.status = "Cancelled");

        await order.save();
        res.json(order);
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 6. GENERAL UPDATE (Notes, etc.)
// ==========================================
router.put("/:id", async (req, res) => {
    try {
        const { notes } = req.body;
        const updatedOrder = await req.TenantOrder.findByIdAndUpdate(
            req.params.id,
            { $set: { notes: notes } },
            { new: true }
        );
        res.json(updatedOrder);
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;