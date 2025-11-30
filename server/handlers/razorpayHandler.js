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

// Create Standard Order (For Instant Checkout)
const createOrder = async (amount, receiptId, keys, institutionId) => {
  const { keyId, keySecret } = keys;
  const instance = createRazorpayInstance(keyId, keySecret);

  const options = {
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt: receiptId ? receiptId.toString() : undefined,
    payment_capture: 1,
    // CRITICAL: Pass Context for Webhook
    notes: {
      institutionId: institutionId.toString(),
      internalOrderId: receiptId ? receiptId.toString() : "",
    },
  };
  return await instance.orders.create(options);
};

// --- NEW: Create Payment Link (For SMS/Email) ---
const createPaymentLink = async (amount, orderInfo, customer, keys, institutionId) => {
  const { keyId, keySecret } = keys;
  const instance = createRazorpayInstance(keyId, keySecret);

  // Razorpay Payment Link Options
  const options = {
    amount: Math.round(amount * 100),
    currency: "INR",
    accept_partial: false,
    description: `Payment for Order #${orderInfo.displayId}`,
    customer: {
      name: customer.name,
      contact: customer.mobile,
      email: customer.email,
    },
    notify: {
      sms: true,
      email: true,
    },
    callback_url: "https://your-domain.com/payment-success",
    callback_method: "get",
    reminder_enable: true,
    notes: {
      institutionId: institutionId.toString(),
      internalOrderId: orderInfo._id.toString(),
    },
    callback_url: "https://your-domain.com/payment-success", // Optional: Redirect after payment
    callback_method: "get",
  };

  return await instance.paymentLink.create(options);
};

// Verify Signature
const verifyPaymentSignature = (orderId, paymentId, signature, keySecret) => {
  if (!keySecret)
    throw new Error("Razorpay Secret is required for verification");

  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(orderId + "|" + paymentId)
    .digest("hex");

  return generatedSignature === signature;
};

const verifyWebhookSignature = (body, signature, webhookSecret) => {
  if (!webhookSecret) return false; // If no secret set, we can't verify

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(JSON.stringify(body))
    .digest("hex");

  return expectedSignature === signature;
};

// --- NEW: Fetch Payment Details ---
const fetchPayment = async (paymentId, keys) => {
  const { keyId, keySecret } = keys;
  const instance = createRazorpayInstance(keyId, keySecret);
  return await instance.payments.fetch(paymentId);
};

const fetchPaymentsForOrder = async (razorpayOrderId, keys) => {
  const { keyId, keySecret } = keys;
  const instance = createRazorpayInstance(keyId, keySecret);

  // This returns a list of payments attempted for this order
  return await instance.orders.fetchPayments(razorpayOrderId);
};

const fetchPaymentLink = async (linkId, keys) => {
  const { keyId, keySecret } = keys;
  const instance = createRazorpayInstance(keyId, keySecret);

  // Returns link details including status ('paid', 'expired', etc.)
  // Note: Payment Links API does not directly list payments in the fetch response in all versions.
  // Usually, if paid, we search payments by the order_id associated with this link via reference.
  return await instance.paymentLink.fetch(linkId);
};

module.exports = {
  createOrder,
  createPaymentLink,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
  fetchPaymentsForOrder,
  fetchPaymentLink,
};
