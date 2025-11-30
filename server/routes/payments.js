const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Institution = require("../models/Institutions");
// Order Schema import is needed to compile the Tenant Model
const OrderSchema = require("../models/Order");
const getModel = require("../middleware/getModelsHandler");
const { verifyToken } = require("../middleware/verifyToken");
const {
  createOrder,
  createPaymentLink,
  verifyPaymentSignature,
  fetchPayment,
  fetchPaymentsForOrder,
  fetchPaymentLink,
} = require("../handlers/razorpayHandler");

// Helper to get Tenant Context
const getTenantContext = async (req, res, next) => {
  try {
    const institutionId = req.user.institutionId;
    if (!institutionId)
      return res.status(400).json({ message: "Institution ID missing." });

    const institution = await Institution.findOne({ institutionId });
    if (!institution)
      return res.status(404).json({ message: "Institution not found." });

    const tenantDb = mongoose.connection.useDb(institution.dbName, {
      useCache: true,
    });
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
  const inst = await Institution.findOne({ institutionId }).select(
    "+paymentGateway.razorpayKeyId +paymentGateway.razorpayKeySecret"
  );

  if (!inst || !inst.paymentGateway || !inst.paymentGateway.razorpayKeyId) {
    throw new Error("Payment Gateway not configured for this institution.");
  }
  return {
    keyId: inst.paymentGateway.razorpayKeyId,
    keySecret: inst.paymentGateway.razorpayKeySecret,
  };
};

// 1. GENERATE RAZORPAY ORDER
router.post("/create-razorpay-order", async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    // Fetch Dynamic Keys
    const keys = await getInstitutionKeys(req.institutionId);
    const dbOrder = await req.TenantOrder.findById(orderId);
    if (!dbOrder) return res.status(404).json({ message: "Order not found" });
    const razorpayOrder = await createOrder(
      amount,
      orderId,
      keys,
      req.institutionId
    );
    // Create Razorpay Order
    dbOrder.paymentGatewaySessions.push({
      type: "RazorpayOrder",
      id: razorpayOrder.id,
      amount: amount,
      status: "created",
    });
    await dbOrder.save();
    res.json({
      id: razorpayOrder.id, // Order ID from Razorpay
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount,
      keyId: keys.keyId, // Send Key ID to frontend for Checkout
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
      amount,
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

    if (!isValid)
      return res.status(400).json({ message: "Invalid Payment Signature" });

    // Update Order
    const order = await req.TenantOrder.findById(dbOrderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.transactions.push({
      paymentMode: "Razorpay",
      amount: amount,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      paymentMethod: "Online/UPI",
      date: new Date(),
      recordedBy: req.user.userId,
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
router.post("/record-manual", async (req, res) => {
  try {
    const { dbOrderId, mode, amount, transactionId, notes } = req.body;
    if(!["Cash", "Card"].includes(mode)) return res.status(400).json({ message: "Invalid Mode for Manual Entry" });

    const order = await req.TenantOrder.findById(dbOrderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.transactions.push({
      paymentMode: mode,
      amount: Number(amount),
      transactionId: transactionId || null,
      notes,
      date: new Date(),
      recordedBy: req.user.userId,
    });

    order.financials.paidAmount += Number(amount);
    await order.save();

    res.json({ success: true, message: "Payment Recorded", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. SEND PAYMENT LINK (New)
router.post("/send-payment-link", async (req, res) => {
  try {
    const { amount, dbOrderId } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    // 1. Fetch Order & Patient Details
    const order = await req.TenantOrder.findById(dbOrderId).populate(
      "patientId"
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    const patient = order.patientId; // This works if patient is in same DB, but remember our hybrid model?
    // Note: In our Hybrid model, 'patientId' in Order is just an ID string.
    // We need to fetch patient details from the request body or fetch from Master DB here if needed.
    // For simplicity, let's assume the frontend passes the necessary patient details
    // OR we use the 'mergePatientsWithOrders' logic if we want to be strict.

    // Let's assume we pass customer details from frontend for speed
    const customerDetails = {
      name: req.body.customerName || "Patient",
      mobile: req.body.customerMobile || "",
      email: req.body.customerEmail || "",
    };

    // 2. Fetch Keys
    const keys = await getInstitutionKeys(req.institutionId);

    // 3. Create Link
    const paymentLink = await createPaymentLink(amount, order, customerDetails, keys, req.institutionId);

  // SAVE SESSION
        order.paymentGatewaySessions.push({
            type: "RazorpayLink",
            id: paymentLink.id,
            amount: amount,
            status: "created"
        });
        await order.save();

    res.json({
      success: true,
      message: "Payment link sent successfully via SMS/Email",
      linkId: paymentLink.id,
      shortUrl: paymentLink.short_url,
    });
  } catch (err) {
    console.error("Link Gen Error:", err);
    res.status(500).json({ message: err.message || "Failed to send link" });
  }
});

// 5. SMART VERIFICATION
router.post("/check-status", async (req, res) => {
    try {
        const { dbOrderId } = req.body;
        const order = await req.TenantOrder.findById(dbOrderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const keys = await getInstitutionKeys(req.institutionId);
        let newPaymentsFound = 0;
        const activeSessions = order.paymentGatewaySessions || [];

        for (const session of activeSessions) {
            
            // CHECK RAZORPAY ORDERS
            if (session.type === "RazorpayOrder") {
                try {
                    const payments = await fetchPaymentsForOrder(session.id, keys);
                    if (payments && payments.items) {
                        for (const payment of payments.items) {
                            if (payment.status === 'captured') {
                                const alreadyRecorded = order.transactions.some(t => t.razorpayPaymentId === payment.id);
                                if (!alreadyRecorded) {
                                    const amountPaid = payment.amount / 100;
                                    
                                    // RECORD AS RAZORPAY
                                    order.transactions.push({
                                        paymentMode: "Razorpay", // Strict Enum
                                        amount: amountPaid,
                                        razorpayOrderId: payment.order_id,
                                        razorpayPaymentId: payment.id,
                                        razorpaySignature: "auto_verified_api",
                                        paymentMethod: payment.method, // Capture actual method (upi, card, netbanking)
                                        date: new Date(payment.created_at * 1000),
                                        recordedBy: req.user.userId,
                                        notes: `Auto-Verified. Method: ${payment.method}`
                                    });
                                    
                                    order.financials.paidAmount += amountPaid;
                                    newPaymentsFound++;
                                    session.status = "paid";
                                }
                            }
                        }
                    }
                } catch (e) { console.error(e.message); }
            }

            // CHECK PAYMENT LINKS
            if (session.type === "RazorpayLink") {
                try {
                    const linkDetails = await fetchPaymentLink(session.id, keys);
                    if (linkDetails.status === 'paid' && linkDetails.order_id) {
                        const payments = await fetchPaymentsForOrder(linkDetails.order_id, keys);
                        if (payments && payments.items) {
                            for (const payment of payments.items) {
                                if (payment.status === 'captured') {
                                    const alreadyRecorded = order.transactions.some(t => t.razorpayPaymentId === payment.id);
                                    if (!alreadyRecorded) {
                                        const amountPaid = payment.amount / 100;
                                        
                                        // RECORD AS RAZORPAY
                                        order.transactions.push({
                                            paymentMode: "Razorpay", // Strict Enum
                                            amount: amountPaid,
                                            razorpayOrderId: payment.order_id,
                                            razorpayPaymentId: payment.id,
                                            razorpaySignature: "auto_verified_link",
                                            paymentMethod: "Payment Link",
                                            date: new Date(),
                                            recordedBy: req.user.userId,
                                            notes: `Link Paid via ${payment.method}`
                                        });
                                        
                                        order.financials.paidAmount += amountPaid;
                                        newPaymentsFound++;
                                    }
                                }
                            }
                        }
                        session.status = "paid";
                    }
                } catch (e) { console.error(e.message); }
            }
        }

        if (newPaymentsFound > 0) {
            await order.save();
            return res.json({ success: true, message: `Updated ${newPaymentsFound} payment(s).`, order });
        } else {
            return res.json({ success: false, message: "No new payments found." });
        }

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
