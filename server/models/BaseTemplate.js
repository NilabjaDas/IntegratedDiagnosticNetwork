const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const baseTemplateSchema = new mongoose.Schema({
  templateId: { type: String, default: () => uuidv4(), unique: true },
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, default: "General" },
  type: { type: String, enum: ["BILL", "LAB_REPORT", "PRESCRIPTION"], required: true },
  isActive: { type: Boolean, default: true },

  // Physical Layout
  pageSize: { type: String, enum: ["A3", "A4", "A5", "Letter", "Legal", "Tabloid", "B4", "B5", "Thermal80mm"], default: "A4" },
  orientation: { type: String, enum: ["portrait", "landscape"], default: "portrait" },

  // Margins
  margins: {
    top: { type: Number, default: 10 },
    bottom: { type: Number, default: 10 },
    left: { type: Number, default: 10 },
    right: { type: Number, default: 10 }
  },

  // Content Configuration
  content: {
    accentColor: { type: String, default: "#000000" },
    fontFamily: { type: String, default: "Roboto" },
    
    // Toggles
    showLogo: { type: Boolean, default: true },
    showInstitutionDetails: { type: Boolean, default: true },
    showQrCode: { type: Boolean, default: true },
    
    // Bill Specifics
    billColumns: {
        showTax: { type: Boolean, default: true },
        showDiscount: { type: Boolean, default: true }
    },

    // HTML Content
    headerHtml: { type: String, default: "" },
    footerHtml: { type: String, default: "" },
  },

  // Variables for interpolation
  variables: [{
      key: String,
      label: String,
      defaultValue: String
  }],

  previewImage: { type: String }, // URL to a screenshot
  createdBy: { type: String },
  
}, { timestamps: true });

// Index for search
baseTemplateSchema.index({ name: "text", category: "text" });

module.exports = mongoose.model("BaseTemplate", baseTemplateSchema);