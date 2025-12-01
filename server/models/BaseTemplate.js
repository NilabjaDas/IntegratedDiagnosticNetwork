const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const baseTemplateSchema = new mongoose.Schema({
  // Unique Identifier
  templateId: { type: String, default: () => uuidv4(), unique: true, index: true },

  // Basic Info
  name: { type: String, required: true, trim: true },
  description: { type: String },
  category: { type: String, required: true }, // e.g., "General", "Cardiology", "Pediatrics"

  // Type: Matches Institution.printTemplateSchema.type
  type: { type: String, enum: ["BILL", "LAB_REPORT", "PRESCRIPTION"], required: true },

  // Visual Preview
  previewImage: { type: String }, // URL to an image

  // Physical Layout
  pageSize: {
      type: String,
      enum: ["A3", "A4", "A5", "Letter", "Legal", "Tabloid", "B4", "B5", "Thermal80mm"],
      default: "A4"
  },
  orientation: { type: String, enum: ["portrait", "landscape"], default: "portrait" },

  // Margins (in mm)
  margins: {
    top: { type: Number, default: 10 },
    bottom: { type: Number, default: 10 },
    left: { type: Number, default: 10 },
    right: { type: Number, default: 10 }
  },

  // Content Structure
  // This mirrors the printTemplateSchema structure to ensure easy import
  content: {
    headerHtml: { type: String, default: "" },
    footerHtml: { type: String, default: "" },

    // Toggles (Default state when imported)
    showLogo: { type: Boolean, default: true },
    showInstitutionDetails: { type: Boolean, default: true },
    showQrCode: { type: Boolean, default: true },

    // Branding Defaults
    accentColor: { type: String, default: "#000000" },
    fontFamily: { type: String, default: "Roboto" },

    // Bill Specifics
    billColumns: {
        showTax: { type: Boolean, default: true },
        showDiscount: { type: Boolean, default: true }
    },

    // Flexible Elements (for Visual Editor compatibility)
    customElements: [{
        id: String,
        type: { type: String, enum: ["TEXT", "IMAGE", "VARIABLE"], default: "TEXT" },
        content: String,
        x: Number,
        y: Number,
        width: Number,
        height: Number,
        style: {
            fontSize: Number,
            fontWeight: String,
            color: String,
            textAlign: String
        }
    }],
  },

  // Library Specific: Variable Definitions
  // These are variables that the USER must fill in when importing (e.g., "Helpline Number")
  // NOT dynamic data variables like {{PatientName}} which are filled at runtime.
  variables: [{
    key: { type: String, required: true }, // The placeholder in HTML, e.g. "HELPLINE_PHONE"
    label: { type: String, required: true }, // User friendly label: "Helpline Number"
    inputType: { type: String, enum: ["text", "number", "color", "image"], default: "text" },
    defaultValue: { type: String }
  }],

  isActive: { type: Boolean, default: true },
  createdBy: { type: String }, // Super Admin Username

}, { timestamps: true });

// Text Index for Search
baseTemplateSchema.index({ name: "text", description: "text", category: "text" });

module.exports = mongoose.model("BaseTemplate", baseTemplateSchema);
