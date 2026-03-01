const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Institution = require("../models/Institutions");
// Order Schema import is needed to compile the Tenant Model
const OrderSchema = require("../models/Order");

// --- NEW IMPORTS FOR TOKEN SYNC ---
const QueueTokenSchema = require("../models/QueueToken");
const { sendToBrand } = require("../sseManager");
// ----------------------------------

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
    // --- NEW: INJECT QUEUE TOKEN MODEL ---
    req.TenantQueueToken = getModel(tenantDb, "QueueToken", QueueTokenSchema);
    
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

// --- NEW: HELPER TO SYNC QUEUE TOKENS & UI ---
const syncTokensPaymentStatus = async (req, order) => {
    try {
        const tokens = await req.TenantQueueToken.find({ orderId: order._id });
        for (const token of tokens) {
            token.paymentStatus = order.financials.status; // 'Paid', 'PartiallyPaid', 'Pending'
            await token.save();
            
            // Broadcast the update to the Live EMR Workspaces instantly!
            sendToBrand(req.user.brand, { type: 'TOKEN_UPDATED', token: token }, 'tests_queue_updated');
        }
    } catch (error) {
        console.error("Token Sync Error:", error);
    }
};
// ---------------------------------------------

// 1. GENERATE RAZORPAY ORDER
router.post("/create-razorpay-order", async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    const keys = await getInstitutionKeys(req.institutionId);
    const dbOrder = await req.TenantOrder.findById(orderId);
    if (!dbOrder) return res.status(404).json({ message: "Order not found" });
    const razorpayOrder = await createOrder(
      amount,
      orderId,
      keys,
      req.institutionId
    );
    dbOrder.paymentGatewaySessions.push({
      type: "RazorpayOrder",
      id: razorpayOrder.id,
      amount: amount,
      status: "created",
    });
    await dbOrder.save();
    res.json({
      id: razorpayOrder.id, 
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount,
      keyId: keys.keyId, 
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

    const keys = await getInstitutionKeys(req.institutionId);

    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      keys.keySecret
    );

    if (!isValid)
      return res.status(400).json({ message: "Invalid Payment Signature" });

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
    
    // Recalculate status properly
    order.financials.dueAmount = order.financials.netAmount - order.financials.paidAmount;
    order.financials.status = order.financials.dueAmount <= 0 ? "Paid" : "PartiallyPaid";
    
    await order.save();
    
    // --- FIRE SYNC HELPER ---
    await syncTokensPaymentStatus(req, order);

    res.json({ success: true, message: "Payment Verified", order });
  } catch (err) {
    console.error("Verification Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// 3. RECORD MANUAL PAYMENT (Cash / Card)
router.post("/record-manual", async (req, res) => {
  try {
    const dbOrderId = req.body.dbOrderId || req.body.orderId;
    const { mode, amount, transactionId, notes } = req.body;
    
    if(!["Cash", "Card", "UPI", "Waiver"].includes(mode)) {
        return res.status(400).json({ message: "Invalid Mode for Manual Entry" });
    }

    const order = await req.TenantOrder.findById(dbOrderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (mode === "Waiver") {
        order.financials.discountAmount += Number(amount);
        order.financials.netAmount -= Number(amount);
        order.financials.dueAmount = 0;
        order.financials.discountAuthorizedBy = "Doctor (EMR Waiver)";
        order.financials.discountReason = notes;
        order.financials.status = "Paid";
    } else {
        order.transactions.push({
          paymentMode: mode,
          amount: Number(amount),
          transactionId: transactionId || null,
          notes,
          date: new Date(),
          recordedBy: req.user.userId,
        });

        order.financials.paidAmount += Number(amount);
        order.financials.dueAmount = order.financials.netAmount - order.financials.paidAmount;
        order.financials.status = order.financials.dueAmount <= 0 ? "Paid" : "PartiallyPaid";
    }

    await order.save();
    
    // --- FIRE SYNC HELPER ---
    await syncTokensPaymentStatus(req, order);

    res.json({ success: true, message: "Payment/Waiver Recorded", order });
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

    const order = await req.TenantOrder.findById(dbOrderId).populate("patientId");
    if (!order) return res.status(404).json({ message: "Order not found" });

    const customerDetails = {
      name: req.body.customerName || "Patient",
      mobile: req.body.customerMobile || "",
      email: req.body.customerEmail || "",
    };

    const keys = await getInstitutionKeys(req.institutionId);
    const paymentLink = await createPaymentLink(amount, order, customerDetails, keys, req.institutionId);

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
            
            if (session.type === "RazorpayOrder") {
                try {
                    const payments = await fetchPaymentsForOrder(session.id, keys);
                    if (payments && payments.items) {
                        for (const payment of payments.items) {
                            if (payment.status === 'captured') {
                                const alreadyRecorded = order.transactions.some(t => t.razorpayPaymentId === payment.id);
                                if (!alreadyRecorded) {
                                    const amountPaid = payment.amount / 100;
                                    
                                    order.transactions.push({
                                        paymentMode: "Razorpay", 
                                        amount: amountPaid,
                                        razorpayOrderId: payment.order_id,
                                        razorpayPaymentId: payment.id,
                                        razorpaySignature: "auto_verified_api",
                                        paymentMethod: payment.method, 
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
                                        
                                        order.transactions.push({
                                            paymentMode: "Razorpay", 
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
            // Recalculate Financial Status
            order.financials.dueAmount = order.financials.netAmount - order.financials.paidAmount;
            order.financials.status = order.financials.dueAmount <= 0 ? "Paid" : "PartiallyPaid";
            await order.save();
            
            // --- FIRE SYNC HELPER ---
            await syncTokensPaymentStatus(req, order);
            
            return res.json({ success: true, message: `Updated ${newPaymentsFound} payment(s).`, order });
        } else {
            return res.json({ success: false, message: "No new payments found." });
        }

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;