const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Institution = require("../models/Institutions");
const OrderSchema = require("../models/Order");
const getModel = require("../middleware/getModelsHandler");
const { verifyWebhookSignature } = require("../handlers/razorpayHandler");

// Handle Razorpay Webhooks
router.post("/razorpay", async (req, res) => {
    try {
        // 1. Extract Data
        // Razorpay sends the event data in the body
        const payload = req.body; 
        const signature = req.headers["x-razorpay-signature"];

        // 2. Identify Event
        // We typically care about 'payment.captured' or 'order.paid'
        const event = payload.event;
        const entity = payload.payload.payment.entity;
        
        if (event !== "payment.captured") {
            // Ignore other events for now, send 200 so Razorpay stops retrying
            return res.status(200).json({ status: "ignored" });
        }

        // 3. Extract Context (The "Breadcrumbs" we left)
        const notes = entity.notes || {};
        const institutionId = notes.institutionId;
        const dbOrderId = notes.internalOrderId;

        if (!institutionId || !dbOrderId) {
            console.error("Webhook Error: Missing context in notes", notes);
            return res.status(400).json({ status: "error", message: "Missing context" });
        }

        // 4. Load Institution & Verify Signature
        // We MUST verify signature to ensure this request is actually from Razorpay
        const institution = await Institution.findOne({ institutionId })
            .select("+paymentGateway.razorpayWebhookSecret");

        if (!institution) return res.status(404).json({ message: "Institution not found" });

        const webhookSecret = institution.paymentGateway?.razorpayWebhookSecret;
        
        if (!webhookSecret) {
            console.error(`Webhook Secret not set for Inst: ${institutionId}`);
            // Return 200 to stop retry loop, but log error
            return res.status(200).json({ status: "config_error" });
        }

        const isValid = verifyWebhookSignature(req.body, signature, webhookSecret);
        if (!isValid) {
            console.error("Webhook Signature Mismatch!");
            return res.status(401).json({ message: "Invalid Signature" });
        }

        // 5. Connect to Tenant DB
        const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
        const TenantOrder = getModel(tenantDb, "Order", OrderSchema);

        // 6. Update Order
        // Check if transaction already exists to avoid duplicates (Idempotency)
        const order = await TenantOrder.findById(dbOrderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const alreadyRecorded = order.transactions.some(
            t => t.razorpayPaymentId === entity.id
        );

        if (!alreadyRecorded) {
            const amountPaid = entity.amount / 100; // Convert Paisa to Rupee

            order.transactions.push({
                paymentMode: "UPI", // Or entity.method (card/upi/netbanking)
                amount: amountPaid,
                razorpayOrderId: entity.order_id,
                razorpayPaymentId: entity.id,
                razorpaySignature: "webhook_verified", // Marker
                date: new Date(),
                recordedBy: "SYSTEM_WEBHOOK", // System user
                notes: `Captured via Webhook. Method: ${entity.method}`
            });

            // Update Financials
            order.financials.paidAmount += amountPaid;
            
            // Pre-save hook will handle status update (Paid/PartiallyPaid)
            await order.save();
            console.log(`[Webhook] Payment recorded for Order ${order.displayId}`);
        } else {
            console.log(`[Webhook] Duplicate event for Order ${order.displayId}`);
        }

        res.json({ status: "ok" });

    } catch (err) {
        console.error("Webhook Handler Error:", err);
        // Send 500 so Razorpay retries later (standard behavior)
        res.status(500).json({ message: "Internal Error" });
    }
});

module.exports = router;