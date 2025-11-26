const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const breakSchema = new mongoose.Schema({
  name: { type: String }, // e.g., "Lunch", "Tea"
  startTime: { type: String, required: true }, // "13:00" (24hr format)
  endTime: { type: String, required: true }    // "14:00"
}, { _id: false });

const scheduleSchema = new mongoose.Schema({
  day: { 
    type: String, 
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] 
  },
  isAvailable: { type: Boolean, default: true },
  startTime: { type: String }, // "09:00"
  endTime: { type: String },   // "17:00"
  breaks: [breakSchema]        // Specific breaks for this day
}, { _id: false });

const doctorSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  doctorId: { type: String, default: () => uuidv4(), unique: true },
  userId: { type: String }, // Link to User login if they have dashboard access

  // === PUBLIC PROFILE ===
  name: { type: String, required: true },
  specialization: { type: String, required: true }, // e.g., "Cardiologist"
  qualifications: { type: String }, // e.g., "MBBS, MD"
  registrationNumber: { type: String }, // Medical Council ID
  bio: { type: String }, 
  
  contact: {
    email: { type: String },
    phone: { type: String, required: true }, // Public booking number
  },

  // === PRIVATE OPERATIONAL DATA (The "Admin" section) ===
  consultationFee: { type: Number, required: true }, // e.g., 1000
  avgTimePerPatient: { type: Number, default: 15 }, // in minutes
  
  // Weekly Schedule & Breaks
  weeklySchedule: [scheduleSchema], 
  
  // Leave Management (Date Ranges)
  leaves: [{
    startDate: Date,
    endDate: Date,
    reason: String
  }],

  // === FINANCIAL MODEL (Type 2 Support) ===
  employmentType: { 
    type: String, 
    enum: ["Salaried", "RevenueShare", "PrivatePractice"], 
    required: true 
  },
  
  // If Salaried
  baseSalary: { type: Number }, // e.g., 100000 (Monthly)
  
  // If Revenue Share
  shareConfig: {
    doctorPercentage: { type: Number }, // e.g., 70
    institutionPercentage: { type: Number }, // e.g., 30
  },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = doctorSchema;