const Razorpay = require("razorpay");
const crypto = require("crypto");

// Factory function to create instance using Dynamic Keys
const createRazorpayInstance = (keyId, keySecret) => {
    if (!keyId || !keySecret) {
        throw new Error("Razorpay keys are missing for this institution.");
    }
    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });
};

// Create Order
const createOrder = async (amount, receiptId, keys) => {
    const { keyId, keySecret } = keys;
    const instance = createRazorpayInstance(keyId, keySecret);
    
    const options = {
        amount: Math.round(amount * 100), // Ensure integer (paisa)
        currency: "INR",
        receipt: receiptId ? receiptId.toString() : undefined,
        payment_capture: 1 
    };
    return await instance.orders.create(options);
};

// Verify Signature
const verifyPaymentSignature = (orderId, paymentId, signature, keySecret) => {
    if (!keySecret) throw new Error("Razorpay Secret is required for verification");

    const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(orderId + "|" + paymentId)
        .digest("hex");

    return generatedSignature === signature;
};

module.exports = { createOrder, verifyPaymentSignature };