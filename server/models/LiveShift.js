const mongoose = require("mongoose");

const liveShiftSchema = new mongoose.Schema(
    {
        institutionId: { type: String, required: true, index: true },
        date: { type: String, required: true, index: true }, // YYYY-MM-DD
        doctorId: { type: String, required: true, index: true },
        shiftName: { type: String, required: true }, // e.g., "Morning", "Evening"
        
        // Status of the shift
        status: { 
            type: String, 
            enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], 
            default: 'PENDING' 
        },
        
        // Timing Metrics
        plannedStartTime: { type: String }, // e.g., "08:00"
        plannedEndTime: { type: String },   // e.g., "14:00"
        actualStartTime: { type: Date, default: null },
        actualEndTime: { type: Date, default: null },
        
        // Volume Metrics
        maxTokens: { type: Number, default: 0 },
        totalTokensBooked: { type: Number, default: 0 },
        tokensCompleted: { type: Number, default: 0 },
        
        // Tracking
        currentActiveTokenId: { type: mongoose.Schema.Types.ObjectId, ref: 'QueueToken', default: null },
        
        // Audit
        startedBy: { type: String, default: null }, // user ID of who pressed 'Start'
        cancelledBy: { type: String, default: null },
        cancelReason: { type: String, default: "" }
    },
    { timestamps: true }
);

// Compound index for fast lookups of today's shifts for a doctor
liveShiftSchema.index({ institutionId: 1, date: 1, doctorId: 1, shiftName: 1 }, { unique: true });

module.exports = liveShiftSchema;