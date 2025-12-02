const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const BaseTemplate = require("../models/BaseTemplate");
const Institution = require("../models/Institutions");
const TemplateSchema = require("../models/Template"); // The tenant schema
const getModel = require("../middleware/getModelsHandler");
const { verifyToken } = require("../middleware/verifyToken");

// --- Middleware: Get Tenant Context ---
const getTenantContext = async (req, res, next) => {
  try {
    const institutionId = req.user.institutionId;
    if (!institutionId) return res.status(400).json({ message: "Institution ID missing." });

    const institution = await Institution.findOne({ institutionId });
    if (!institution) return res.status(404).json({ message: "Institution not found." });

    // Switch to Tenant DB
    const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
    
    // Register the Tenant Model
    req.TenantTemplate = getModel(tenantDb, "Template", TemplateSchema);
    req.institutionId = institutionId; // Store for easy access

    next();
  } catch (err) {
    console.error("Tenant Context Error:", err);
    res.status(500).json({ message: "Database Connection Error" });
  }
};

router.use(verifyToken, getTenantContext);

/**
 * HELPER: Handle Default Toggling
 * If a template is being saved as 'isDefault: true', ensure no others of the same type are default.
 */
const handleDefaultConflict = async (TenantModel, institutionId, category, body, excludeId = null) => {
  if (!body.isDefault) return; 

  const query = { institutionId, category, isDefault: true };

  // If updating, exclude self
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  // Refine scope: Only unset default for the specific sub-type 
  if (category === "PRINT" && body.printDetails?.type) {
    query["printDetails.type"] = body.printDetails.type;
  } 
  
  if (category === "COMMUNICATION" && body.commDetails?.triggerEvent) {
    query["commDetails.triggerEvent"] = body.commDetails.triggerEvent;
  }

  // Update all conflicting templates to isDefault: false
  await TenantModel.updateMany(query, { $set: { isDefault: false } });
};


// --- 1. SPECIFIC & STATIC ROUTES ---

// @route   GET /master-catalog
// @desc    Search the Global BaseTemplate Library
router.get("/master-catalog", async (req, res) => {
  try {
    const { search, type, category } = req.query;

    let query = { isActive: true };

    // Search Logic
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } }
      ];
    }

    // Filter Logic
    if (type) query.type = type; // e.g., BILL, LAB_REPORT
    if (category) query.category = category; // General, Minimalist, etc.

    const masterTemplates = await BaseTemplate.find(query)
      .select("name description category type pageSize previewImage")
      .sort({ createdAt: -1 });
    console.log(masterTemplates)
    res.json(masterTemplates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /import
// @desc    Import a BaseTemplate from Master Catalog to Tenant DB
// @access  Private (Tenant Admin)
router.post("/import", async (req, res) => {
    try {
        const { baseTemplateId, variableValues, isDefault } = req.body;
        // variableValues example: { "HELPLINE": "555-0123", "FOOTER_MSG": "Get well soon" }

        if (!baseTemplateId) {
            return res.status(400).json({ message: "Base Template ID is required." });
        }

        // 1. Fetch Master Template
        const baseTemplate = await BaseTemplate.findById(baseTemplateId);
        if (!baseTemplate) {
            return res.status(404).json({ message: "Base Template not found in Master Catalog." });
        }

        // 2. Process Content: Inject Static Variables
        // Deep copy to avoid mutating the original mongoose document
        let processedContent = JSON.parse(JSON.stringify(baseTemplate.content)); 

        const replacePlaceholders = (str) => {
            if (!str || typeof str !== 'string') return str;
            let newStr = str;
            if (variableValues) {
                Object.keys(variableValues).forEach(key => {
                    // Regex to replace all occurrences of {{KEY}}
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    newStr = newStr.replace(regex, variableValues[key]);
                });
            }
            return newStr;
        };

        // A. Inject into HTML areas
        processedContent.headerHtml = replacePlaceholders(processedContent.headerHtml);
        processedContent.footerHtml = replacePlaceholders(processedContent.footerHtml);

       
        // 3. Prepare New Tenant Template Object
        // We map the Flat BaseTemplate -> Nested Tenant Schema
        const newTemplateData = {
            institutionId: req.institutionId,
            name: `${baseTemplate.name} (Imported)`,
            category: "PRINT", // BaseTemplates are visual/print layouts
            isDefault: isDefault || false,
            
            // Map specific print fields into printDetails
            printDetails: {
                type: baseTemplate.type, // e.g., BILL
                pageSize: baseTemplate.pageSize,
                orientation: baseTemplate.orientation,
                margins: baseTemplate.margins,
                content: processedContent // The injected content
            }
        };

        // 4. Handle Default Logic (Helper function from previous step)
        // If imported as default, unset others of this type
        await handleDefaultConflict(
            req.TenantTemplate, 
            req.institutionId, 
            "PRINT", 
            newTemplateData
        );

        // 5. Save to Tenant Collection
        const newLocalTemplate = new req.TenantTemplate(newTemplateData);
        await newLocalTemplate.save();

        res.status(201).json({
            message: "Template imported successfully.",
            data: newLocalTemplate
        });

    } catch (err) {
        console.error("Import Template Error:", err);
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
});
// --- 2. GENERAL ROOT ROUTES ---

// @route   GET /
// @desc    Get all Tenant Templates (Installed)
router.get("/", async (req, res) => {
  try {
    const { category, type } = req.query;
    
    let query = { institutionId: req.institutionId };

    if (category) query.category = category; // PRINT or COMMUNICATION
    
    // Deep filter for Print Type (Bill vs Report)
    if (category === "PRINT" && type) {
      query["printDetails.type"] = type;
    }

    const templates = await req.TenantTemplate.find(query).sort({ isDefault: -1, createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// @route   POST /
// @desc    Import a BaseTemplate into Tenant DB
router.post("/", async (req, res) => {
  try {
    const { baseTemplateId, isDefault } = req.body;

    // 1. Fetch Master
    const master = await BaseTemplate.findById(baseTemplateId);
    if (!master) return res.status(404).json({ message: "Master Template not found." });

    // 2. Prepare Tenant Object (Mapping Base -> Tenant)
    // Note: BaseTemplate defines 'type' at root, Tenant defines it inside 'printDetails'
    const newTemplateData = {
      institutionId: req.institutionId,
      name: master.name,
      category: "PRINT", // BaseTemplates are primarily visual/print
      isDefault: isDefault || false,
      printDetails: {
        type: master.type,
        pageSize: master.pageSize,
        orientation: master.orientation,
        margins: master.margins,
        content: master.content, 
        // We copy content completely. Unlike Tests, we usually don't want 
        // a "live link" for layouts because users heavily customize positions.
      }
    };

    // 3. Handle Default Conflicts
    await handleDefaultConflict(req.TenantTemplate, req.institutionId, "PRINT", newTemplateData);

    // 4. Save
    const newTemplate = new req.TenantTemplate(newTemplateData);
    await newTemplate.save();

    res.status(201).json(newTemplate);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// @route   POST /custom
// @desc    Create a purely custom template (Blank Canvas)
router.post("/custom", async (req, res) => {
  try {
    const { name, category, printDetails, commDetails, isDefault } = req.body;

    if (!name || !category) {
      return res.status(400).json({ message: "Name and Category are required." });
    }

    // 1. Validate Category Requirements
    if (category === "PRINT" && !printDetails) return res.status(400).json({ message: "Print Details required." });
    if (category === "COMMUNICATION" && !commDetails) return res.status(400).json({ message: "Communication Details required." });

    // 2. Handle Default Conflicts
    await handleDefaultConflict(req.TenantTemplate, req.institutionId, category, req.body);

    // 3. Create
    const newTemplate = new req.TenantTemplate({
      institutionId: req.institutionId,
      name,
      category,
      isDefault: isDefault || false,
      printDetails: category === "PRINT" ? printDetails : undefined,
      commDetails: category === "COMMUNICATION" ? commDetails : undefined
    });

    await newTemplate.save();
    res.status(201).json(newTemplate);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// --- 3. PARAMETERIZED ROUTES ---

// @route   GET /:id
// @desc    Get Single Template Details
router.get("/:id", async (req, res) => {
  try {
    const template = await req.TenantTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found." });
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// @route   PUT /:id
// @desc    Update Template (Drag & Drop Saves happen here)
router.put("/:id", async (req, res) => {
  try {
    const { category, isDefault, printDetails, commDetails } = req.body;
    // 1. Check Existence
    const existing = await req.TenantTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Template not found." });

    // 2. Handle Default Conflict
    if (isDefault === true) {
       const checkCategory = category || existing.category;
       const checkBody = {
         isDefault: true,
         printDetails: printDetails || existing.printDetails,
         commDetails: commDetails || existing.commDetails
       };
       await handleDefaultConflict(req.TenantTemplate, req.institutionId, checkCategory, checkBody, req.params.id);
    }

    // 3. Update
    const updatedTemplate = await req.TenantTemplate.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.json(updatedTemplate);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// @route   DELETE /:id
// @desc    Delete Template
router.post("/delete", async (req, res) => {
  try {
    const template = await req.TenantTemplate.findById(req.body.id);
    if (!template) return res.status(404).json({ message: "Template not found." });

    await template.deleteOne();
    
    res.json({ message: "Template deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// @route   GET /config/variables
// @desc    Get available variables based on Template Type
// @usage   GET /api/templates/config/variables?type=BILL
router.get("/config/variables", (req, res) => {
    const { type } = req.query; // "BILL", "LAB_REPORT", "PRESCRIPTION"

    // --- 1. SHARED VARIABLES (Common to all) ---
    const commonVariables = [
        { group: "Institution", label: "Institution Name", value: "{{institution.name}}" },
        { group: "Institution", label: "Address", value: "{{institution.address.line1}}, {{institution.address.city}}" },
        { group: "Institution", label: "Phone", value: "{{institution.contact.phone}}" },
        { group: "Institution", label: "Email", value: "{{institution.contact.email}}" }, // Public contact email is fine
        
        { group: "Patient", label: "Full Name", value: "{{patient.name}}" }, // Backend combines First+Last
        { group: "Patient", label: "First Name", value: "{{patient.firstName}}" }, 
        { group: "Patient", label: "Last Name", value: "{{patient.lastName}}" },
        { group: "Patient", label: "Age / Gender", value: "{{patient.age}} / {{patient.gender}}" },
        { group: "Patient", label: "UHID", value: "{{patient.displayId}}" },
        { group: "Patient", label: "Mobile", value: "{{patient.phone}}" },
        { group: "Patient", label: "Email", value: "{{patient.email}}" },
        { group: "Patient", label: "Address", value: "{{patient.address}}" },

        // --- NEW: PAGE NUMBER VARIABLE ---
        // We use triple braces {{{ }}} so the HTML span tags inside aren't escaped
        { group: "Document", label: "Page Number (1 of N)", value: "{{{page_info}}}" },
    ];

    let specificVariables = [];
    let tableKeys = [];

    // --- 2. BILLING CONFIGURATION ---
    if (type === "BILL") {
        specificVariables = [
            { group: "Order", label: "Order ID", value: "{{order.displayId}}" },
            { group: "Order", label: "Order Date", value: "{{order.date}}" },
            { group: "Order", label: "Order Time", value: "{{order.time}}" },
            { group: "Financials", label: "Total Amount", value: "{{financials.totalAmount}}" },
            { group: "Financials", label: "Due Amount", value: "{{financials.dueAmount}}" },
        ];

        tableKeys = [
            { label: "Serial Number (1, 2...)", value: "index" },
            { label: "Item Name", value: "name" },
            { label: "Item Type (Test/Pkg)", value: "type" },
            { label: "Quantity", value: "qty" },
            { label: "Unit Price", value: "price" },
            { label: "Total", value: "total" }
        ];
    } 
    
    // --- 3. LAB REPORT CONFIGURATION (Dummy Data) ---
    else if (type === "LAB_REPORT") {
        specificVariables = [
            { group: "Report", label: "Sample ID", value: "{{sample.barcode}}" },
            { group: "Report", label: "Collection Date", value: "{{sample.collectionDate}}" },
            { group: "Report", label: "Reported Date", value: "{{report.date}}" },
            { group: "Doctor", label: "Referred By", value: "{{doctor.name}}" },
            { group: "Tech", label: "Technician Name", value: "{{technician.name}}" },
            { group: "Tech", label: "Pathologist Name", value: "{{pathologist.name}}" },
        ];

        tableKeys = [
            { label: "Test Parameter Name", value: "paramName" },
            { label: "Result Value", value: "resultValue" },
            { label: "Unit (mg/dL)", value: "unit" },
            { label: "Reference Range", value: "refRange" },
            { label: "Method", value: "method" },
            { label: "Flag (High/Low)", value: "flag" }
        ];
    } 
    
    // --- 4. PRESCRIPTION CONFIGURATION (Dummy Data) ---
    else if (type === "PRESCRIPTION") {
        specificVariables = [
            { group: "Doctor", label: "Doctor Name", value: "{{doctor.name}}" },
            { group: "Doctor", label: "Specialization", value: "{{doctor.specialization}}" },
            { group: "Doctor", label: "Reg. Number", value: "{{doctor.regNumber}}" },
            { group: "Vitals", label: "BP", value: "{{vitals.bp}}" },
            { group: "Vitals", label: "Weight", value: "{{vitals.weight}}" },
            { group: "Vitals", label: "Temperature", value: "{{vitals.temp}}" },
            { group: "Diagnosis", label: "Diagnosis", value: "{{diagnosis}}" },
        ];

        tableKeys = [
            { label: "Medicine Name", value: "medicine" },
            { label: "Dosage (e.g. 500mg)", value: "dosage" },
            { label: "Frequency (1-0-1)", value: "frequency" },
            { label: "Duration (5 Days)", value: "duration" },
            { label: "Instruction (After Food)", value: "instruction" }
        ];
    }

    res.json({ 
        variables: [...commonVariables, ...specificVariables], 
        tableKeys 
    });
});

module.exports = router;