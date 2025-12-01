const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const printTemplateSchema = new mongoose.Schema({
  templateId: { type: String, default: () => uuidv4() },
  name: { type: String, required: true }, // e.g. "Standard A4 Bill"
  type: { type: String, enum: ["BILL", "LAB_REPORT", "PRESCRIPTION"], required: true },
  isDefault: { type: Boolean, default: false },
  
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
    accentColor: { type: String, default: "#000000" },
    fontFamily: { type: String, default: "Roboto" },
    showLogo: { type: Boolean, default: true },
    showInstitutionDetails: { type: Boolean, default: true },
    showQrCode: { type: Boolean, default: true }, // Payment QR on Bill
    billColumns: {
        showTax: { type: Boolean, default: true },
        showDiscount: { type: Boolean, default: true }
    },
    headerHtml: { type: String, default: "" }, // Custom HTML for header
    footerHtml: { type: String, default: "" }, // Custom HTML for footer
   
    customElements: [{
        id: String,
        type: { type: String, enum: ["TEXT", "IMAGE", "VARIABLE", "LINE", "BOX"], default: "TEXT" },
        content: String, // Text content or Image URL
        x: Number, // Position in px or %
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
  variables: {type: [Object]},

}, { _id: false });


const commTemplateSchema = new mongoose.Schema({
    templateId: { type: String, default: () => uuidv4() },
    name: { type: String, required: true },
    triggerEvent: { type: String, required: true }, // e.g., "ORDER_CREATED", "REPORT_READY"
    channels: {
        sms: {
            enabled: { type: Boolean, default: false },
            templateId: String, // DLT Template ID (India specific)
            content: String     // "Dear {PatientName}, your order #{OrderId} is confirmed."
        },
        email: {
            enabled: { type: Boolean, default: false },
            subject: String,
            bodyHtml: String
        },
        whatsapp: {
            enabled: { type: Boolean, default: false },
            templateId: String
        }
    }
}, { _id: false });


const maintenanceSchema = new mongoose.Schema({
  activeStatus: { type: Boolean, default: false },
  startTime: { type: String, default: "" },
  endTime: { type: String, default: "" },
  updateInfo: { type: String, default: "Scheduled Maintenance" },
  updateDescription: { type: String, default: "We are improving our services." },
}, { _id: false });

const outletSchema = new mongoose.Schema({
  outletId: { type: String, default: () => uuidv4() },
  name: { type: String, required: true },
  code: { type: String, uppercase: true }, 
  isActive: { type: Boolean, default: true },
  timezone: { type: String, default: "Asia/Kolkata" },
  contact: { phone: String, email: String },
  address: {
    line1: String, line2: String, city: String, state: String, country: String, pincode: String,
  },
  settings: {
    autoToken: { type: Boolean, default: false },
    tokenPrefix: { type: String, default: "TKN" },
    openingHours: { type: [Object], default: [] },
  },
}, { _id: false });

const institutionsSchema = new mongoose.Schema({
  institutionId: { type: String, default: () => uuidv4(), index: true, unique: true },

  // --- Identity ---
  institutionName: { type: String, required: true, trim: true },
  
  // NEW FIELD: Institution Type
  institutionType: { 
    type: String, 
    enum: ["soloDoc", "multiDoc", "pathologyWithDoc"], 
    default: "pathologyWithDoc",
    required: true 
  },
  // 1. Document Templates (PDFs)
  printTemplates: [printTemplateSchema],

  // 2. Notification Templates
  communicationTemplates: [commTemplateSchema],
  domains: [{ type: String, lowercase: true, trim: true, required: true }],
  dbName: { type: String, required: true, unique: true, trim: true }, 
  institutionCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

  // --- Branding ---
  brandCode: { type: String, default: "" },
  brandName: { type: String, default: "" },
  loginPageImgUrl: { type: String, default: "" },
  institutionLogoUrl: { type: String, default: "" },
  institutionSymbolUrl: { type: String, default: "" },
  favicon: { type: String, default: "" },
  status: { type: Boolean, default: true },

  // --- Theme ---
  theme: {
    primaryColor: { type: String, default: "#007bff" },
    secondaryColor: { type: String, default: "#6c757d" },
    logoBackground: { type: String, default: "#ffffff" }
  },

  // --- Subscription ---
  subscription: {
    type: { type: String, enum: ["trial", "basic", "pro", "free"], default: "trial" },
    status: { type: String, enum: ["active", "deactive"], default: "active" },
    trialDuration: { type: Number, default: 14 },
    usageCounter: { type: Number, default: 0 },
    value: { type: String, default: "0" },
    frequency: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date }
  },

  // --- Contact & Billing ---
  contact: {
    phone: { type: String, default: "" },
    altPhone: { type: String, default: "" },
    email: { type: String, default: "" },
    supportEmail: { type: String, default: "" },
  },
  address: {
    line1: { type: String, default: "" },
    line2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "India" },
    pincode: { type: String, default: "" },
    gmapLink:{ type: String, default: "" },
  },
  billing: {
    gstin: { type: String, default: "" },
    pan: { type: String, default: "" },
    invoicePrefix: { type: String, default: "INV" },
    taxPercentage: { type: Number, default: 18 },
    defaultCurrency: { type: String, default: "INR" },
  },

  outlets: [outletSchema],

  features: {
    hasRadiology: { type: Boolean, default: false },
    hasPACS: { type: Boolean, default: false },
    hasHomeCollection: { type: Boolean, default: true },
    hasTeleReporting: { type: Boolean, default: false },
  },

  settings: {
    timezone: { type: String, default: "Asia/Kolkata" },
    locale: { type: String, default: "en-IN" },
    defaultLanguage: { type: String, default: "en" },
    sampleBarcodePrefix: { type: String, default: "LAB" },
    discountOverrideCode: { type: String, select: false }, // The 6-digit PIN (e.g., "123456")
    queue: {
      incrementalPerOutlet: { type: Boolean, default: true },
      tokenFormat: { type: String, default: "{OUTLET}-{NUMBER}" }
    }
  },

  integrations: {
    firebaseBucketName: { type: String, default: "" },
    uploadUrlDomain: { type: String, default: "" },
    pacs: {
      enabled: { type: Boolean, default: false },
      orthancUrl: { type: String, default: "" },
      aeTitle: { type: String, default: "" }
    },
    hl7: {
      enabled: { type: Boolean, default: false },
      listenerUrl: { type: String, default: "" }
    }
  },

  // --- PAYMENT GATEWAY ---
  paymentGateway: {
    provider: { type: String, default: "razorpay" }, 
    
    razorpayKeyId: { type: String, select: false, trim: true },
    razorpayKeySecret: { type: String, select: false, trim: true },
    
    // NEW: Store the Webhook Secret (Tenant sets this in Razorpay Dashboard)
    razorpayWebhookSecret: { type: String, select: false, trim: true },
    
    config: { type: mongoose.Schema.Types.Mixed, select: false, default: {} }
  },

  smtp: {
    host: { type: String, default: "" },
    port: { type: Number, default: 587 },
    user: { type: String, default: "" },
    password: { type: String, select: false }
  },

  maintenance: { type: maintenanceSchema, default: () => ({}) },
  onboardingStatus: { type: String, enum: ["pending", "in_progress", "complete"], default: "pending" },
  tags: [{ type: String }],
  deleted: { type: Boolean, default: false },

  createdBy: String,
  updatedBy: String,
  metadata: mongoose.Schema.Types.Mixed,

}, { timestamps: true, collection: "Institutions" });

// Indexes
institutionsSchema.index({ domains: 1 }, { unique: true, sparse: true });
institutionsSchema.index({ institutionId: 1 }, { unique: true });
institutionsSchema.index({ "contact.email": 1 });

module.exports = mongoose.model("Institution", institutionsSchema);