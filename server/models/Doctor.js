const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// 1. Breaks (Can happen inside a shift)
const breakSchema = new mongoose.Schema({
    label: { type: String, default: "Break" }, // "Tea", "Ward Round"
    startTime: { type: String, required: true }, // "13:00"
    endTime: { type: String, required: true }    // "13:30"
}, { _id: false });

// 2. Shifts (A doctor might have Morning OPD and Evening OPD)
const shiftSchema = new mongoose.Schema({
    shiftName: { type: String, required: true }, // "Morning OPD"
    startTime: { type: String, required: true }, // "10:00"
    endTime: { type: String, required: true },   // "14:00"
    maxTokens: { type: Number, required: true }, // e.g., 20 patients
    repeatWeeks: { 
        type: [Number], 
        default: [1, 2, 3, 4, 5] 
    },
    breaks: [breakSchema] // Breaks strictly within this shift
}, { _id: false });

// 3. Weekly Schedule (0 = Sunday, 1 = Monday...)
const dayScheduleSchema = new mongoose.Schema({
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, 
    isAvailable: { type: Boolean, default: true },
    shifts: [shiftSchema] 
}, { _id: false });

// 4. Planned Leaves (Vacations / Conferences)
const leaveSchema = new mongoose.Schema({
    startDate: { type: String, required: true }, // "YYYY-MM-DD"
    endDate: { type: String, required: true },   // "YYYY-MM-DD"
    shiftNames: [{ type: String }], // <-- NEW: Empty array means Full Day. 
    reason: { type: String },
    leaveDaysCount: { type: Number, default: 0 } // Tracks actual working days consumed (can be a decimal like 0.5)
});
const leaveAuditSchema = new mongoose.Schema({
    action: { type: String, required: true }, // e.g., "GRANTED", "REVOKED", "PARTIALLY_REVOKED"
    timestamp: { type: Date, default: Date.now },
    byUserName: { type: String }, // Who did it
    details: { type: String }
}, { _id: false });
// 5. Daily Overrides (For Real-World Delays & Sick Days)
const overrideSchema = new mongoose.Schema({
    date: { type: String, required: true }, // "YYYY-MM-DD"
    shiftNames: [{ type: String }], 
    delayMinutes: { type: Number, default: 0 }, 
    isCancelled: { type: Boolean, default: false }, 
    note: { type: String } 
}, { _id: false });

const doctorSchema = new mongoose.Schema({
    institutionId: { type: String, required: true, index: true },
    doctorId: { type: String, default: () => uuidv4(), unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional dashboard login

    // --- Profile ---
    personalInfo: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        gender: { type: String, enum: ["Male", "Female", "Other"] },
        phone: { type: String },
        publicContact : {type: String},
        email: { type: String }
    },
    professionalInfo: {
        specialization: { type: String, required: true },
        qualifications: [{ type: String }],
        registrationNumber: { type: String, required: true }, 
        experienceYears: { type: Number }
    },

    // --- Financials ---
    fees: {
        newConsultation: { type: Number, required: true, default: 500 },
        followUpConsultation: { type: Number, required: true, default: 0 }
    },

    // --- Serial & Queue Rules ---
    consultationRules: {
        avgTimePerPatientMinutes: { type: Number, default: 15 }, // Critical for Live ETA Math!
        followUpValidityDays: { type: Number, default: 7 }, 
        allowOverbooking: { type: Boolean, default: false } 
    },

    billingPreferences: {
        paymentCollectionPoint: { 
            type: String, 
            enum: ['STRICT_PREPAID', 'AUTO_PAY_ON_CONSULT', 'MANUAL_DESK_COLLECTION'], 
            default: 'MANUAL_DESK_COLLECTION' 
        },
        assistantCapabilities: {
            allowedToCollect: { type: Boolean, default: true },
            allowedModes: [{ type: String, enum: ['Cash', 'UPI', 'Link'], default: ['Cash', 'UPI'] }],
            maxDiscountPercent: { type: Number, default: 0 }
        },
        doctorCapabilities: {
            allowedToCollect: { type: Boolean, default: true },
            allowedModes: [{ type: String, enum: ['Cash', 'UPI'], default: ['Cash'] }],
            canWaiveFee: { type: Boolean, default: true }
        }
    },

    leaveSettings: {
        leaveLimitPerYear: { type: Number, default: 20 }
    },

    metrics: {
        leavesTaken: { type: Number, default: 0 },
        cancellationsCount: { type: Number, default: 0 }, // Shift cancellations
        lateCount: { type: Number, default: 0 }
    },

    specialShifts: [{
        date: { type: String, required: true }, // "YYYY-MM-DD"
        shiftName: { type: String, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        maxTokens: { type: Number, required: true },
        notes: { type: String }
    }],

    // --- Infrastructure ---
    assignedCounterId: { type: String }, // E.g., Physical "Cabin 1"
    prescriptionTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' }, 

    // --- Availability & Time Management ---
    schedule: [dayScheduleSchema], 
    leaves: [leaveSchema],
    leaveAuditLogs: [leaveAuditSchema],
    dailyOverrides: [overrideSchema],

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

doctorSchema.index({ institutionId: 1, 'personalInfo.firstName': 1 });

module.exports = mongoose.model("Doctor", doctorSchema);