const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Sub-schemas
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

  // --- Identity & Routing ---
  institutionName: { type: String, required: true, trim: true },
  primaryDomain: { type: String, required: true, lowercase: true, trim: true, unique: true },
  dbName: { type: String, required: true, unique: true, trim: true }, 
  institutionCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  domains: [{ type: String, lowercase: true, trim: true }],

  // --- Branding ---
  brand: { type: String, default: "" },
  brandName: { type: String, default: "" },
  loginPageImgUrl: { type: String, default: "" },
  institutionLogoUrl: { type: String, default: "" },
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
    type: { 
        type: String, 
        enum: ["trial", "basic", "pro", "free"], 
        default: "trial" 
    },
    status: { 
        type: String, 
        enum: ["active", "deactive"], 
        default: "active" 
    },
    trialDuration: { type: Number, default: 14 }, // Duration in days
    usageCounter: { type: Number, default: 0 },   // Counter of service usage in days
    value: { type: String, default: "0" },
    frequency: { 
        type: String, 
        enum: ["monthly", "yearly"], 
        default: "monthly" 
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date }
  },

  // --- Contact & Address ---
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
  },

  // --- Location ---
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [0, 0] },
  },

  // --- Billing ---
  billing: {
    gstin: { type: String, default: "" },
    pan: { type: String, default: "" },
    invoicePrefix: { type: String, default: "INV" },
    taxPercentage: { type: Number, default: 18 },
    defaultCurrency: { type: String, default: "INR" },
  },

  outlets: [outletSchema],

  // --- Feature Toggles ---
  features: {
    hasRadiology: { type: Boolean, default: false },
    hasPACS: { type: Boolean, default: false },
    hasHomeCollection: { type: Boolean, default: true },
    hasTeleReporting: { type: Boolean, default: false },
  },

  // --- Settings ---
  settings: {
    timezone: { type: String, default: "Asia/Kolkata" },
    locale: { type: String, default: "en-IN" },
    defaultLanguage: { type: String, default: "en" },
    sampleBarcodePrefix: { type: String, default: "LAB" },
    queue: {
      incrementalPerOutlet: { type: Boolean, default: true },
      tokenFormat: { type: String, default: "{OUTLET}-{NUMBER}" }
    }
  },

  // --- Integrations ---
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

  // --- Sensitive Data ---
  paymentGateway: {
    provider: { type: String, default: "" },
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

}, {
  timestamps: true,
  collection: "Institutions"
});

// Indexes
institutionsSchema.index({ primaryDomain: 1 }, { unique: true, sparse: true });
institutionsSchema.index({ institutionId: 1 }, { unique: true });
institutionsSchema.index({ "contact.email": 1 });
institutionsSchema.index({ "location": "2dsphere" });

module.exports = mongoose.model("Institution", institutionsSchema);