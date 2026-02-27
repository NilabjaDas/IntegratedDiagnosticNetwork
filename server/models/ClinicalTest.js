const mongoose = require("mongoose");

const clinicalTestSchema = new mongoose.Schema({
    institutionId: { type: String, required: true, index: true },
    name: { type: String, required: true },       // E.g., Complete Blood Count
    alias: { type: String },                      // E.g., CBC
    department: { type: String },                 // E.g., Pathology, Radiology
    category: { type: String },                   // E.g., Hematology, X-Ray
    masterTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseTest' }, // To track imports from your Master Catalog
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = clinicalTestSchema;