const mongoose = require("mongoose");

const clinicalMedicineSchema = new mongoose.Schema({
    institutionId: { type: String, required: true, index: true },
    name: { type: String, required: true },       // E.g., Calpol 500mg
    shortName: { type: String },                  // E.g., Paracetamol
    brand: { type: String },                      // E.g., GSK
    type: { type: String },                       // E.g., Tablet, Syrup, Injection, Ointment, Drops
    strength: { type: String },                   // E.g., 500mg, 10ml
    treatmentFor: [{ type: String }],             // E.g., ['Fever', 'Pain']
    defaultDosage: { type: String },              // E.g., 1-0-1 (Morning, None, Night)
    defaultInstructions: { type: String },        // E.g., After Food
    targetDemographic: { type: String, default: 'All Ages' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = clinicalMedicineSchema;