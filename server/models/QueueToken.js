const mongoose = require("mongoose");

const queueTokenSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true }, 
  department: { type: String, required: true, index: true }, 
  departmentOrderId: { type: String },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
  shiftName: { type: String, default: null }, // e.g., "Morning OPD"
  tokenNumber: { type: String, required: true }, // e.g., "PAT-001"
  sequence: { type: Number, required: true },    // 1
  priority: { type: Number, default: 0 }, // 1 = Priority (Front of queue), 0 = Normal
  isRescheduled: { type: Boolean, default: false },
  originalDate: { type: String }, // To track when they originally booked
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' }, // Null if walk-in
  
  // Snapshot for Display Boards
  patientDetails: {
      name: String,
      age: Number,
      gender: String
  },
  
  tests: [{
      testId: String,
      name: String
  }],
  assignedCounterId: { type: String },
  assignedCounterName: { type: String },
  assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // The Lifecycle of a Token
  status: { 
      type: String, 
      enum: ['WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'HOLD', 'SKIPPED'], 
      default: 'WAITING' 
  },
    prescriptionHtml: { type: String, default: "" },
  // --- NEW: SMART ETA FIELDS ---
  estimatedStartTime: { type: Date }, // The raw Date object for future live recalculations
  estimatedTimeFormatted: { type: String }, // "10:45 AM" - Pre-formatted for fast UI rendering
  isOverbooked: { type: Boolean, default: false }, // To flag tokens injected beyond the shift limit
  
  // For Analytics and Display Boards
  calledAt: { type: Date },
  completedAt: { type: Date }

}, { timestamps: true });

module.exports = queueTokenSchema;