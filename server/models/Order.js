const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const resultSchema = new mongoose.Schema({
  parameterId: { type: String }, // Link to the parameter definition inside Test
  name: { type: String, required: true }, // e.g. "Hemoglobin"
  value: { type: String }, // The actual reading
  unit: { type: String },  // e.g. "g/dL"
  isAbnormal: { type: Boolean, default: false }, // Flagged if outside bioRefRange
  notes: { type: String } // Technician remarks
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  // Type distinguishing
  itemType: { type: String, enum: ["Test", "Package", "Consultation"], required: true },
  
  // Link to the Catalog Item
  itemId: { type: String, required: true }, 
  name: { type: String, required: true }, 
  
  // Financials
  price: { type: Number, required: true }, // Billed amount for this line item
  financials: {
    doctorShare: { type: Number, default: 0 },
    institutionShare: { type: Number, default: 0 }
  },

  // --- PACKAGE HANDLING ---
  // If this item is a Test inside a Package, this ID points to the Package Item's _id
  parentPackageId: { type: String, default: null },

  // --- EXECUTION STATUS ---
  // Tracks lifecycle of this specific test/consultation
  status: { 
    type: String, 
    enum: ["Pending", "SampleCollected", "Processing", "Completed", "Cancelled", "Reported"], 
    default: "Pending" 
  },

  // --- OUTCOMES ---
  // For Tests:
  results: [resultSchema],
  
  // For Consultations:
  consultationNotes: { type: String }, 
  prescription: {
      url: { type: String }, 
      text: { type: String },
      medicines: [{
          name: String,
          dosage: String,
          frequency: String, 
          duration: String, 
          instruction: String 
      }]
  }
});

const orderSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  orderId: { type: String, default: () => uuidv4(), unique: true, index: true },
  displayId: { type: String }, // Short ID for humans (e.g. "ORD-1001")
  
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  
  // Appointment Details (Optional for direct lab walk-ins)
  appointment: {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    date: { type: Date },
    tokenNumber: { type: Number },
    estimatedTime: { type: String },
    status: { type: String, default: "Scheduled" } 
  },
  
  // The "Exploded" List of Items
  // Contains Packages (for billing) AND their individual Tests (for execution)
  items: [orderItemSchema], 
  
  // Order Level Finances
  totalAmount: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  
  paymentStatus: { type: String, enum: ["Pending", "Paid", "PartiallyPaid"], default: "Pending" },
  paymentMode: { type: String }, // e.g. "Cash", "UPI", "Card"
  
}, { timestamps: true });

// Index for fetching a patient's history quickly
orderSchema.index({ institutionId: 1, patientId: 1 });

module.exports = orderSchema;