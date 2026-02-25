const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const maintenanceSchema = new mongoose.Schema({
  activeStatus: { type: Boolean, default: false },
  startTime: { type: String, default: "" },
  endTime: { type: String, default: "" },
  updateInfo: { type: String, default: "Scheduled Maintenance" },
  updateDescription: { type: String, default: "We are improving our services." },
}, { _id: false });


const counterSchema = new mongoose.Schema({
  counterId: { type: String, default: () => uuidv4() },
  name: { type: String, required: true }, 
  roomName: { type: String, required: true }, // e.g., "Desk 1", "Room A"
  department: { type: String, required: true }, // e.g., "Pathology"
  type: { type: String, enum: ["Collection", "Consultation", "Scanning", "Billing", "Other"], default: "Collection" },
  status: { 
    type: String, 
    enum: ["Online", "Paused", "Offline"], 
    default: "Offline" 
  },
  // Future Provision: To lock this counter to a specific logged-in user
  currentStaffId: { type: String, default: null } ,
  scheduling: {
    slotDurationMinutes: { type: Number, default: 15 }, // E.g., MRI takes 30 mins
    bufferTimeMinutes: { type: Number, default: 0 },    // E.g., 5 mins to clean the bed
    maxPatientsPerSlot: { type: Number, default: 1 }    // E.g., Collection desk can handle 2 at a time
  }

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
    clinical: {
        emergencyLeavePolicy: {
            type: String,
            enum: ['MANUAL_REBOOK', 'AUTO_FRONT_OF_QUEUE', 'AUTO_INTERLEAVED'],
            default: 'MANUAL_REBOOK' // Default to manual so front desk retains control
        },
        queuePolicies: {
        shiftCancelPolicy: { type: String, enum: ['AUTO_NEXT_AVAILABLE', 'CANCEL_ALL', 'MANUAL_ALLOCATION'], default: 'MANUAL_ALLOCATION' },
        dayCancelPolicy: { type: String, enum: ['AUTO_NEXT_AVAILABLE', 'CANCEL_ALL', 'MANUAL_ALLOCATION'], default: 'MANUAL_ALLOCATION' },
        spilloverPolicy: { type: String, enum: ['AUTO_NEXT_AVAILABLE', 'CANCEL_ALL', 'MANUAL_ALLOCATION'], default: 'MANUAL_ALLOCATION' }
    }
    },
  },
}, { _id: false });

const institutionsSchema = new mongoose.Schema({
  institutionId: { type: String, default: () => uuidv4(), index: true, unique: true },

  // --- Identity ---
  institutionName: { type: String, required: true, trim: true },
  
  institutionType: { 
    type: String, 
    enum: ["soloDoc", "multiDoc", "pathology", "pathologyWithDoc"], 
    default: "pathologyWithDoc",
    required: true 
  },

  // REMOVED: printTemplates and communicationTemplates arrays
  // (These are now in the 'Template' collection)

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
  counters: { type: [counterSchema], default: [] },
  features: {
    hasRadiology: { type: Boolean, default: false },
    hasPACS: { type: Boolean, default: false },
    hasHomeCollection: { type: Boolean, default: true },
    hasTeleReporting: { type: Boolean, default: false },
  },

  settings: {
    formatting: {
      dateFormat: { type: String, default: "DD/MM/YYYY" }, // vs MM/DD/YYYY
      timeFormat: { type: String, enum: ["12h", "24h"], default: "12h" },
      currencySymbol: { type: String, default: "₹" }, // e.g., ₹, $, €
    },
   
    timezone: { type: String, default: "Asia/Kolkata" },
    locale: { type: String, default: "en-IN" },
    defaultLanguage: { type: String, default: "en" },
    // Formatting & Identifiers
    orderFormat: { type: String, default: "ORD-{YYMMDD}-{SEQ}" },
    departmentOrderFormats: [{
        _id: false,
        department: { type: String, required: true },
        format: { type: String, required: true } // e.g., "PAT-{YYMMDD}-{SEQ}"
    }],
    sampleBarcodePrefix: { type: String, default: "LAB" },
    barcodeFormat: { type: String, default: "{PREFIX}-{YYMMDD}-{SEQ}" },
    discountOverrideCode: { type: String, select: false },
    queue: {
      incrementalPerOutlet: { type: Boolean, default: true },
      tokenFormat: { type: String, default: "{OUTLET}-{NUMBER}" },
      departments: { 
        type: [String], 
        default: ["Pathology", "Radiology", "Cardiology", "Consultation", "Billing"] 
      },
    },
    workflow: {
      bookingMode: { 
        type: String, 
        enum: ["unified_cart", "department_isolated"], 
        default: "unified_cart" 
      }
    }
  },

  socialLinks: {
    website: { type: String, default: "" },
    facebook: { type: String, default: "" },
    instagram: { type: String, default: "" },
    twitter: { type: String, default: "" },
    linkedin: { type: String, default: "" }
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
    },
    sms: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, enum: ["twilio", "msg91", "gupshup", "sns"], default: "msg91" },
      apiKey: { type: String, select: false },
      senderId: { type: String, select: false }, // e.g., "MYCLNC"
      dltEntityId: { type: String, select: false } // Required for TRAI compliance in India
    },
    whatsapp: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, default: "meta", enum: ["meta", "3rd_party"] },
      
      // 1. The ID of the specific phone number sending the message
      // Found in Meta App Dashboard -> WhatsApp -> API Setup
      phoneNumberId: { type: String, trim: true },

      // 2. The WhatsApp Business Account ID (WABA ID)
      // Required if you want to sync templates programmatically later
      wabaId: { type: String, trim: true },

      // 3. The Permanent Access Token (System User Token)
      // CRITICAL: Set select: false so it never leaks to the frontend
      accessToken: { type: String, select: false, trim: true },
      
      // 4. (Optional) Verify token if you set up webhooks for them
      webhookVerifyToken: { type: String, select: false }
    },
  },

  // --- PAYMENT GATEWAY ---
  paymentGateway: {
    provider: { type: String, default: "razorpay" }, 
    razorpayKeyId: { type: String, select: false, trim: true },
    razorpayKeySecret: { type: String, select: false, trim: true },
    razorpayWebhookSecret: { type: String, select: false, trim: true },
    config: { type: mongoose.Schema.Types.Mixed, select: false, default: {} }
  },

  smtp: {
    host: { type: String, default: "" },
    port: { type: Number, default: 587 },
    user: { type: String, default: "" },
    password: { type: String, select: false }
  },
  
  patientPortalSettings: {
    allowOnlineBooking: { type: Boolean, default: true },
    allowRescheduling: { type: Boolean, default: true },
    allowCancellations: { type: Boolean, default: false },
    // Do appointments need manual staff approval before being confirmed?
    autoApproveBookings: { type: Boolean, default: false }, 
    // Sometimes B2B labs don't want patients seeing direct pricing
    showTestPrices: { type: Boolean, default: true },
    // Can patients download their own reports without a doctor's physical sign-off?
    allowReportDownload: { type: Boolean, default: true }
  },

  compliance: {
    // How long to retain patient records before archiving/deleting (Legal requirement in many countries)
    patientRecordRetentionYears: { type: Number, default: 7 }, 
    // Auto-delete system audit logs after X days to save DB space
    auditLogRetentionDays: { type: Number, default: 90 },
    // Strict compliance toggles that might enforce extra security steps on the frontend
    hipaaCompliant: { type: Boolean, default: false }, 
    gdprCompliant: { type: Boolean, default: false },
    abdmCompliant: { type: Boolean, default: false } // For India (Ayushman Bharat)
  },



  maintenance: { type: maintenanceSchema, default: () => ({}) },
  onboardingStatus: { type: String, enum: ["pending", "in_progress", "complete"], default: "pending" },
  tags: [{ type: String }],
  deleted: { type: Boolean, default: false },

  createdBy: String,
  updatedBy: String,
  metadata: mongoose.Schema.Types.Mixed,

}, { timestamps: true, collection: "Institutions" });

// Virtual Population: Allows `await Institution.find().populate('templates')`
institutionsSchema.virtual('templates', {
  ref: 'Template',
  localField: '_id',
  foreignField: 'institutionId'
});

institutionsSchema.index({ domains: 1 }, { unique: true, sparse: true });
institutionsSchema.index({ institutionId: 1 }, { unique: true });
institutionsSchema.index({ "contact.email": 1 });

module.exports = mongoose.model("Institution", institutionsSchema);