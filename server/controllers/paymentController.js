// routes/payments.js
const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Order"); // Your Order Model
const { authenticateUser } = require("../middleware/auth");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Create Razorpay Order (Initiate Payment)
router.post("/create-order", authenticateUser, async (req, res) => {
  try {
    const { orderId, amount } = req.body; // amount in INR (e.g., 500)
    
    // Validate if the internal order exists
    const internalOrder = await Order.findOne({ 
      orderId: orderId, 
      institutionId: req.user.institutionId 
    });

    if (!internalOrder) {
      return res.status(404).json({ message: "Internal Order not found" });
    }

    const options = {
      amount: amount * 100, // Razorpay accepts amount in paise (smallest unit)
      currency: "INR",
      receipt: orderId, // Link it to your internal ID
      notes: {
        institutionId: req.user.institutionId,
        patientId: String(internalOrder.patientId)
      }
    };

    const response = await razorpay.orders.create(options);

    res.json({
      id: response.id, // The Razorpay Order ID (starts with order_)
      currency: response.currency,
      amount: response.amount,
      keyId: process.env.RAZORPAY_KEY_ID // Send public key to frontend
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment initiation failed", error: err.message });
  }
});

// 2. Verify Payment Signature (After Frontend Success)
router.post("/verify", authenticateUser, async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      internalOrderId // Your system's order ID
    } = req.body;

    // Generate expected signature using HMAC SHA256
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Payment Success: Update Database
      const order = await Order.findOne({ 
        orderId: internalOrderId, 
        institutionId: req.user.institutionId 
      });
      
      if(order) {
        order.paymentStatus = "Paid";
        order.paidAmount = order.netAmount; // Assuming full payment
        // Store transaction details in metadata if needed
        order.metadata = { ...order.metadata, transactionId: razorpay_payment_id };
        await order.save();
      }

      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      res.status(400).json({ success: false, message: "Invalid Signature" });
    }

  } catch (err) {
    res.status(500).json({ message: "Verification failed", error: err.message });
  }
});

module.exports = router;