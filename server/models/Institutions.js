// models/institution.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const maintenanceSchema = new mongoose.Schema({
  activeStatus: { type: Boolean, default: false },
  startTime: { type: String },
  endTime: { type: String },
  updateInfo: { type: String },
  updateDescription: { type: String },
}, { _id: false });

const outletSchema = new mongoose.Schema({
  outletId: { type: String, default: () => uuidv4() },
  name: { type: String, required: true },
  code: { type: String }, // short code for tokens/labels
  contact: {
    phone: { type: String },
    email: { type: String },
  },
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
  },
  timezone: { type: String }, // outlet-specific timezone
  isActive: { type: Boolean, default: true },
  settings: {
    autoToken: { type: Boolean, default: false }, // add outlet-specific toggles
    tokenPrefix: { type: String },
    openingHours: [{ day: String, open: String, close: String }],
  },
}, { _id: false });

const institutionsSchema = new mongoose.Schema({
  institutionId: { type: String, default: () => uuidv4(), index: true, unique: true },

  // Domains & routing
  primaryDomain: { type: String, required: true, lowercase: true, trim: true, unique: true },
  domains: [{ type: String, lowercase: true, trim: true }], // accepts additional domains/subdomains

  // Multi-tenancy
  dbName: { type: String, required: true, unique: true, lowercase: true, trim: true }, // The database name for this institution
  institutionCode: { type: String, required: true, unique: true, uppercase: true, trim: true }, // Unique code (e.g., CLINIC001)

  // Basic identity
  institutionName: { type: String, required: true },
  brand: { type: String },
  brandName: { type: String },
  loginPageImgUrl: { type: String },
  institutionLogoUrl: { type: String },
  favicon: { type: String },
  status: { type: Boolean, default: true }, // active/inactive

  // Visual theming
  theme: {
    primaryColor: { type: String },
    secondaryColor: { type: String },
    logoBackground: { type: String }
  },

  // Contact & address
  contact: {
    phone: { type: String },
    altPhone: { type: String },
    email: { type: String },
    supportEmail: { type: String },
  },
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
  },

  // Geolocation (optional) - defaults to 0,0 if not provided to avoid 2dsphere index errors
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
  },

  // Business / legal / billing
  billing: {
    gstin: { type: String },
    pan: { type: String },
    invoicePrefix: { type: String },
    taxPercentage: { type: Number, default: 0 },
    defaultCurrency: { type: String, default: "INR" },
  },

  // Multi-outlet support
  outlets: [outletSchema],

  // Integrations & internal settings
  integrations: {
    firebaseBucketName: { type: String },
    uploadUrlDomain: { type: String },
    pacs: {
      enabled: { type: Boolean, default: false },
      orthancUrl: { type: String },
      aeTitle: { type: String }
    },
    hl7: {
      enabled: { type: Boolean, default: false },
      listenerUrl: { type: String }
    }
  },

  // Features toggles
  features: {
    hasRadiology: { type: Boolean, default: false },
    hasPACS: { type: Boolean, default: false },
    hasHomeCollection: { type: Boolean, default: true },
    hasTeleReporting: { type: Boolean, default: false },
  },

  // Platform settings
  settings: {
    timezone: { type: String, default: "Asia/Kolkata" },
    locale: { type: String, default: "en-IN" },
    defaultLanguage: { type: String, default: "en" },
    sampleBarcodePrefix: { type: String },
    queue: {
      incrementalPerOutlet: { type: Boolean, default: true },
      tokenFormat: { type: String, default: "{OUTLET}-{NUMBER}" }
    }
  },

  // Sensitive / secret info (select: false so not returned by default)
  masterPassword: { type: String, select: false }, // store hashed
  paymentGateway: {
    provider: { type: String },
    config: { type: mongoose.Schema.Types.Mixed, select: false } // API keys etc. DO NOT expose these
  },
  smtp: {
    host: { type: String },
    port: { type: Number },
    user: { type: String },
    password: { type: String, select: false }
  },

  // Plan/subscription meta
  plan: {
    name: { type: String, default: "free" },
    tier: { type: String },
    isTrial: { type: Boolean, default: true },
    trialEndsAt: { type: Date },
    expiresAt: { type: Date }
  },

  // Operational fields
  maintenance: { type: maintenanceSchema },
  onboardingStatus: { type: String, enum: ["pending", "in_progress", "complete"], default: "pending" },
  tags: [{ type: String }], // arbitrary labels/market segment
  deleted: { type: Boolean, default: false },

  // Who created/updated
  createdBy: { type: String },
  updatedBy: { type: String },

  // flexible metadata
  metadata: { type: mongoose.Schema.Types.Mixed },

}, {
  timestamps: true,
  collection: "Institutions"
});

// Indexes
institutionsSchema.index({ primaryDomain: 1 }, { unique: true, sparse: true });
institutionsSchema.index({ institutionId: 1 }, { unique: true });
institutionsSchema.index({ "contact.email": 1 });
institutionsSchema.index({ "location": "2dsphere" });

// NOTE: For any secret (masterPassword, payment keys, smtp.password) you should hash/encrypt them.
// Example: institutionsSchema.pre('save', async function(next) { ... hash if modified ... })

module.exports = mongoose.model("Institution", institutionsSchema);
