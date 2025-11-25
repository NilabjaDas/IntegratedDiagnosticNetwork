// models/Institutions.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

// Sub-schemas (kept defined outside to keep main schema clean)
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

  // --- Identity & Routing (Unique/Required) ---
  institutionName: { type: String, required: true, trim: true },
  
  // We don't set static defaults for these because they must be unique.
  // We will generate them in the controller if missing.
  primaryDomain: { type: String, required: true, lowercase: true, trim: true, unique: true },
  dbName: { type: String, required: true, unique: true, lowercase: true, trim: true }, 
  institutionCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

  domains: [{ type: String, lowercase: true, trim: true }],

  // --- Branding ---
  brand: { type: String, default: "" },
  brandName: { type: String, default: "" },
  loginPageImgUrl: { type: String, default: "" },
  institutionLogoUrl: { type: String, default: "" },
  favicon: { type: String, default: "" },
  status: { type: Boolean, default: true },

  // --- Theme Defaults ---
  theme: {
    primaryColor: { type: String, default: "#007bff" },
    secondaryColor: { type: String, default: "#6c757d" },
    logoBackground: { type: String, default: "#ffffff" }
  },

  // --- Subscription (Requested Updates) ---
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
    value: { type: String, default: "0" }, // Stored as string to avoid floating point math issues
    frequency: { 
        type: String, 
        enum: ["monthly", "yearly"], 
        default: "monthly" 
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date } // Can calculate based on frequency in controller
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

  // --- Billing Defaults ---
  billing: {
    gstin: { type: String, default: "" },
    pan: { type: String, default: "" },
    invoicePrefix: { type: String, default: "INV" },
    taxPercentage: { type: Number, default: 18 },
    defaultCurrency: { type: String, default: "INR" },
  },

  outlets: [outletSchema],

  // --- Feature Toggles Defaults ---
  features: {
    hasRadiology: { type: Boolean, default: false },
    hasPACS: { type: Boolean, default: false },
    hasHomeCollection: { type: Boolean, default: true },
    hasTeleReporting: { type: Boolean, default: false },
  },

  // --- Platform Settings Defaults ---
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
  masterPassword: { type: String, select: false }, 
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

// Hash Master Password before saving if it's modified
institutionsSchema.pre('save', async function(next) {
    if (!this.isModified('masterPassword') || !this.masterPassword) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.masterPassword = await bcrypt.hash(this.masterPassword, salt);
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model("Institution", institutionsSchema);