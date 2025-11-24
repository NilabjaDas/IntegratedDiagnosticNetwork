const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const packageSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  packageId: { type: String, default: () => uuidv4() },
  
  name: { type: String, required: true }, // e.g., "Senior Citizen Wellness"
  code: { type: String },
  
  // Which tests are inside?
  tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }], 
  
  actualPrice: { type: Number }, // Sum of individual test prices (calculated)
  offerPrice: { type: Number, required: true }, // The discounted price
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Package", packageSchema);