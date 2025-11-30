const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Transaction Schema (Ledger)
const transactionSchema = new mongoose.Schema({
  paymentMode: { type: String, enum: ["Cash", "Card", "Razorpay"], required: true },
  amount: { type: Number, required: true },
  transactionId: { type: String }, 
  notes: { type: String }, 
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  paymentMethod: { type: String }, 
  recordedBy: { type: String },
  date: { type: Date, default: Date.now }
});

const orderItemSchema = new mongoose.Schema({
  itemType: { type: String, enum: ["Test", "Package", "Consultation"], required: true },
  itemId: { type: String, required: true }, 
  name: { type: String, required: true }, 
  price: { type: Number, required: true }, 
  status: { type: String, enum: ["Pending", "Completed", "Cancelled"], default: "Pending" },
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
  
  // --- FINANCIALS (Updated with Discount Reason) ---
  financials: {
    totalAmount: { type: Number, required: true }, // Sum of Items
    
    discountAmount: { type: Number, default: 0 },
    discountReason: { type: String }, // e.g. "Senior Citizen", "Staff"
    discountAuthorizedBy: { type: String }, // Stores User ID/Name
    netAmount: { type: Number, required: true }, // Total - Discount
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    
    status: { type: String, enum: ["Pending", "PartiallyPaid", "Paid", "Overdue", "Cancelled"], default: "Pending" }
  },

  transactions: [transactionSchema],
  
  paymentGatewaySessions: [{
      type: { type: String, enum: ["RazorpayOrder", "RazorpayLink"] },
      id: { type: String, required: true }, 
      amount: Number,
      status: { type: String, default: "created" },
      createdAt: { type: Date, default: Date.now }
  }],
  
  notes: { type: String },
  
  cancellation: {
      isCancelled: { type: Boolean, default: false },
      reason: { type: String },
      cancelledBy: { type: String }, 
      date: { type: Date }
  },

  isReportDeliveryBlocked: { type: Boolean, default: true }

}, { timestamps: true });

// Auto-calculate Dues & Status
orderSchema.pre('save', function(next) {
  if (this.financials && !this.cancellation.isCancelled) {
    // Ensure Net Amount consistency
    this.financials.netAmount = this.financials.totalAmount - (this.financials.discountAmount || 0);
    
    // Calculate Due
    this.financials.dueAmount = this.financials.netAmount - this.financials.paidAmount;
    
    // Determine Status
    if (this.financials.dueAmount <= 0) {
      this.financials.status = "Paid";
      this.isReportDeliveryBlocked = false;
    } else if (this.financials.paidAmount > 0) {
      this.financials.status = "PartiallyPaid";
      this.isReportDeliveryBlocked = true; 
    } else {
      this.financials.status = "Pending";
      this.isReportDeliveryBlocked = true;
    }
  } else if (this.cancellation.isCancelled) {
      this.financials.status = "Cancelled";
  }
  next();
});

module.exports = orderSchema;