const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Sub-schema for individual payments (The Ledger)
const transactionSchema = new mongoose.Schema({
  paymentMode: { type: String, enum: ["Cash", "UPI", "Card"], required: true },
  amount: { type: Number, required: true }, // Amount paid in this transaction
  
  // For Manual/Card/Cash
  transactionId: { type: String }, // Manual entry or Ref No.
  notes: { type: String }, // e.g. "Paid by Father", "Advance"
  
  // For Razorpay (UPI/Online)
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  
  recordedBy: { type: String }, // User ID of staff who took payment
  date: { type: Date, default: Date.now }
});

const orderItemSchema = new mongoose.Schema({
  itemType: { type: String, enum: ["Test", "Package", "Consultation"], required: true },
  itemId: { type: String, required: true }, 
  name: { type: String, required: true }, 
  price: { type: Number, required: true }, 
  status: { type: String, default: "Pending" },
  results: [mongoose.Schema.Types.Mixed] 
});

const orderSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  orderId: { type: String, default: () => uuidv4(), unique: true, index: true },
  displayId: { type: String }, 
  
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  
  appointment: {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    date: { type: Date },
    status: { type: String, default: "Scheduled" } 
  },
  
  items: [orderItemSchema], 
  
  // --- UPDATED FINANCIALS (LEDGER) ---
  financials: {
    totalAmount: { type: Number, required: true }, // Bill Total
    discountAmount: { type: Number, default: 0 },
    netAmount: { type: Number, required: true }, // Final Payable (Total - Discount)
    
    paidAmount: { type: Number, default: 0 }, // Sum of all transactions
    dueAmount: { type: Number, default: 0 },  // Net - Paid
    
    status: { 
      type: String, 
      enum: ["Pending", "PartiallyPaid", "Paid", "Overdue"], 
      default: "Pending" 
    }
  },

  // History of all payments made for this order
  transactions: [transactionSchema],
  
  // Flag for Report Delivery
  isReportDeliveryBlocked: { type: Boolean, default: true } // True if dues exist

}, { timestamps: true });

// Auto-calculate dues and status before saving
orderSchema.pre('save', function(next) {
  if (this.financials) {
    this.financials.dueAmount = this.financials.netAmount - this.financials.paidAmount;
    
    if (this.financials.paidAmount >= this.financials.netAmount) {
      this.financials.status = "Paid";
      this.isReportDeliveryBlocked = false;
    } else if (this.financials.paidAmount > 0) {
      this.financials.status = "PartiallyPaid";
      this.isReportDeliveryBlocked = true; // Block reports if partial (optional business logic)
    } else {
      this.financials.status = "Pending";
      this.isReportDeliveryBlocked = true;
    }
  }
  next();
});

module.exports = orderSchema;