const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Institution = require("../models/Institutions");
// Order Schema import is needed to compile the Tenant Model
const OrderSchema = require("../models/Order"); 
const getModel = require("../middleware/getModelsHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { createOrder, verifyPaymentSignature } = require("../handlers/razorpayHandler");

// Helper to get Tenant Context
const getTenantContext = async (req, res, next) => {
  try {
    const institutionId = req.user.institutionId;
    if (!institutionId) return res.status(400).json({ message: "Institution ID missing." });

    const institution = await Institution.findOne({ institutionId });
    if (!institution) return res.status(404).json({ message: "Institution not found." });

    const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
    req.TenantOrder = getModel(tenantDb, "Order", OrderSchema);
    req.institutionId = institutionId; // Pass ID for explicit lookup later
    
    next();
  } catch (err) {
    res.status(500).json({ message: "Database Connection Error" });
  }
};

router.use(verifyToken, getTenantContext);

// --- HELPER TO FETCH KEYS ---
const getInstitutionKeys = async (institutionId) => {
    const inst = await Institution.findOne({ institutionId })
        .select('+paymentGateway.razorpayKeyId +paymentGateway.razorpayKeySecret');
    
    if (!inst || !inst.paymentGateway || !inst.paymentGateway.razorpayKeyId) {
        throw new Error("Payment Gateway not configured for this institution.");
    }
    return {
        keyId: inst.paymentGateway.razorpayKeyId,
        keySecret: inst.paymentGateway.razorpayKeySecret
    };
};

// 1. GENERATE RAZORPAY ORDER
router.post("/create-razorpay-order", async (req, res) => {
    try {
        const { amount, orderId } = req.body; 

        if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

        // Fetch Dynamic Keys
        const keys = await getInstitutionKeys(req.institutionId);

        // Create Razorpay Order
        const razorpayOrder = await createOrder(amount, orderId, keys);

        res.json({
            id: razorpayOrder.id, // Order ID from Razorpay
            currency: razorpayOrder.currency,
            amount: razorpayOrder.amount,
            keyId: keys.keyId // Send Key ID to frontend for Checkout
        });

    } catch (err) {
        console.error("Razorpay Error:", err.message);
        res.status(500).json({ message: err.message || "Payment Gateway Error" });
    }
});

// 2. VERIFY & RECORD UPI PAYMENT
router.post("/verify-upi", async (req, res) => {
    try {
        const { 
            dbOrderId, 
            razorpayOrderId, 
            razorpayPaymentId, 
            razorpaySignature,
            amount 
        } = req.body;

        // Fetch Dynamic Keys (Need Secret for Verification)
        const keys = await getInstitutionKeys(req.institutionId);

        // Verify Signature
        const isValid = verifyPaymentSignature(
            razorpayOrderId, 
            razorpayPaymentId, 
            razorpaySignature,
            keys.keySecret
        );

        if (!isValid) return res.status(400).json({ message: "Invalid Payment Signature" });

        // Update Order
        const order = await req.TenantOrder.findById(dbOrderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        order.transactions.push({
            paymentMode: "UPI",
            amount: amount,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            date: new Date(),
            recordedBy: req.user.userId
        });

        order.financials.paidAmount += amount;
        await order.save();

        res.json({ success: true, message: "Payment Verified", order });

    } catch (err) {
        console.error("Verification Error:", err.message);
        res.status(500).json({ message: err.message });
    }
});

// 3. RECORD MANUAL PAYMENT (Cash / Card)
// (Unchanged logic, just ensure router is exported correctly)
router.post("/record-manual", async (req, res) => {
    try {
        const { dbOrderId, mode, amount, transactionId, notes } = req.body;
        if(!["Cash", "Card"].includes(mode)) return res.status(400).json({ message: "Invalid Mode" });

        const order = await req.TenantOrder.findById(dbOrderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        order.transactions.push({
            paymentMode: mode,
            amount: Number(amount),
            transactionId: transactionId || null,
            notes,
            date: new Date(),
            recordedBy: req.user.userId
        });

        order.financials.paidAmount += Number(amount);
        await order.save();

        res.json({ success: true, message: "Payment Recorded", order });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;