const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");


const tableColumnSchema = new mongoose.Schema({
    id: { type: String, required: true }, // e.g., "col_name", "col_price"
    label: { type: String, required: true }, // Display Name: "Test Description"
    dataKey: { type: String, required: true }, // The key in the data object: "item.name"
    width: { type: String, default: "auto" }, // "10%", "50px", "auto"
    align: { type: String, enum: ["left", "center", "right"], default: "left" },
    visible: { type: Boolean, default: true }
});


// --- 1. Sub-Schema: Print Configuration ---
const printConfigSchema = new mongoose.Schema({
  type: { type: String, enum: ["BILL", "LAB_REPORT", "PRESCRIPTION"], required: true },
  
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

  // Content Configuration
  content: {
    billColumns: {
        showTax: { type: Boolean, default: true },
        showDiscount: { type: Boolean, default: true }
    },
    headerHtml: { type: String, default: "" },
    footerHtml: { type: String, default: "" },
   tableStructure: {
            showHead: { type: Boolean, default: true }, // Show header row?
            density: { type: String, enum: ["compact", "normal", "spacious"], default: "normal" },
            striped: { type: Boolean, default: false }, // Zebra rows
            
            // The Columns the user wants to show, in order
            columns: { 
                type: [tableColumnSchema], 
                default: [
                    { id: "1", label: "#", dataKey: "index", width: "5%", align: "center" },
                    { id: "2", label: "Description", dataKey: "name", width: "55%", align: "left" },
                    { id: "3", label: "Qty", dataKey: "qty", width: "10%", align: "center" },
                    { id: "4", label: "Price", dataKey: "price", width: "15%", align: "right" },
                    { id: "5", label: "Amount", dataKey: "total", width: "15%", align: "right" }
                ]
            },

            // Financial Summary (Bottom Right block)
            summarySettings: {
                showTax: { type: Boolean, default: true },
                showDiscount: { type: Boolean, default: true },
                showDues: { type: Boolean, default: true },
                wordsAmount: { type: Boolean, default: true } // "Five Hundred Only"
            }
        },
  },
  variables: { type: [Object] },
}, { _id: false });


// --- 2. Sub-Schema: Communication Configuration ---
const commConfigSchema = new mongoose.Schema({
    triggerEvent: { type: String, required: true }, // e.g., "ORDER_CREATED", "REPORT_READY"
    channels: {
        sms: {
            enabled: { type: Boolean, default: false },
            templateId: String, // DLT Template ID
            content: String
        },
        email: {
            enabled: { type: Boolean, default: false },
            subject: String,
            bodyHtml: String
        },
        whatsapp: {
            enabled: { type: Boolean, default: false },
            templateName: { type: String },
           headerType: { 
                type: String, 
                enum: ["NONE", "IMAGE", "DOCUMENT"], 
                default: "NONE" 
            },
            bodyVariables: { type: [String], default: [] }
        }
    }
}, { _id: false });


// --- 3. Main Template Schema ---
const TemplateSchema = new mongoose.Schema({
  // Link to Institution
  institutionId: { 
    type: String, 
    ref: "Institution", 
    required: true, 
    index: true 
  },

  templateId: { type: String, default: () => uuidv4(), index: true },
  name: { type: String, required: true }, // e.g. "Standard A4 Bill"
  isDefault: { type: Boolean, default: false },

  // Discriminator Field: Defines if this is a Print or Comm template
  category: { 
    type: String, 
    enum: ["PRINT", "COMMUNICATION"], 
    required: true 
  },

  // Conditional Fields based on category
  printDetails: {
    type: printConfigSchema,
    required: function() { return this.category === "PRINT"; }
  },

  commDetails: {
    type: commConfigSchema,
    required: function() { return this.category === "COMMUNICATION"; }
  },

  createdBy: String,
  updatedBy: String

}, { timestamps: true, collection: "templates" });

// Compound Index: ensure unique default templates per type per institution
TemplateSchema.index({ institutionId: 1, category: 1 });

module.exports = TemplateSchema;