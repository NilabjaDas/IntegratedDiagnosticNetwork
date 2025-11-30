const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const BaseTest = require("../models/BaseTest");
const Institution = require("../models/Institutions");
const Test = require("../models/Test"); 
const Package = require("../models/Package");
const getModel = require("../middleware/getModelsHandler");
const { verifyToken } = require("../middleware/verifyToken");

// Middleware to Get Tenant Models
const getTenantContext = async (req, res, next) => {
  try {
    const institutionId = req.user.institutionId;
    if (!institutionId) return res.status(400).json({ message: "Institution ID missing." });

    const institution = await Institution.findOne({ institutionId });
    if (!institution) return res.status(404).json({ message: "Institution not found." });

    const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
    req.TenantTest = getModel(tenantDb, "Test", Test.schema || Test);
    req.TenantPackage = getModel(tenantDb, "Package", Package.schema || Package);
    req.institutionData = institution;

    next();
  } catch (err) {
    console.error("Tenant Context Error:", err);
    res.status(500).json({ message: "Database Connection Error" });
  }
};

router.use(verifyToken, getTenantContext);

// --- 1. SPECIFIC & STATIC ROUTES (MUST COME FIRST) ---

// Search Master Catalog
router.get("/master-catalog", async (req, res) => {
  try {
    const { search, department, category, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 1. Base Scoping (Global + Private)
    const scopeQuery = {
      $or: [{ institutionId: null }, { institutionId: req.user.institutionId }],
      isActive: true 
    };

    // 2. Build Search Logic
    let searchQuery = {};
    if (search && search.trim().length > 0) {
        const regex = { $regex: search, $options: "i" };
        searchQuery = {
            $or: [
                { name: regex },
                { code: regex },
                { alias: regex },
                { category: regex }
            ]
        };
    }

    // 3. Filters
    let filterQuery = {};
    if (department) filterQuery.department = department;
    if (category) filterQuery.category = category;

    // 4. Combine
    const finalQuery = {
        $and: [
            scopeQuery,
            searchQuery,
            filterQuery
        ]
    };

    // 5. Query with Pagination
    const total = await BaseTest.countDocuments(finalQuery);
    
    const masterTests = await BaseTest.find(finalQuery)
      .select("code name department category method specimenType")
      .sort({ name: 1 }) // Alphabetical sort for "All" view
      .skip(skip)
      .limit(limitNum);

    res.json({
        data: masterTests,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all packages
router.get("/packages", async (req, res) => {
  try {
    const { category, targetGender } = req.query;
    let filter = { isActive: true };
    if (category) filter.category = category;
    if (targetGender && targetGender !== 'Both') filter.targetGender = { $in: [targetGender, 'Both'] };

    const packages = await req.TenantPackage.find(filter).populate("tests", "name code department");
    res.json(packages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new Package
router.post("/packages", async (req, res) => {
  try {
    const { name, code, offerPrice, actualPrice, testIds, description, category, targetGender, ageGroup, precautions, tat, image } = req.body;

    if (!name || !offerPrice || !testIds || testIds.length === 0) {
        return res.status(400).json({ message: "Name, Offer Price, and at least one Test are required." });
    }

    const newPackage = new req.TenantPackage({
      institutionId: req.user.institutionId,
      name,
      code: code ? code.toUpperCase() : `PKG-${Date.now()}`,
      tests: testIds,
      offerPrice,
      actualPrice: actualPrice || 0,
      description,
      category,
      image,
      targetGender,
      ageGroup,
      precautions,
      tat,
      isActive: true
    });

    await newPackage.save();
    res.status(201).json(newPackage);
  } catch (err) {
    console.error("Create Package Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Update Package
router.put("/packages/:id", async (req, res) => {
  try {
    const updates = req.body;
    if (updates.code) updates.code = updates.code.toUpperCase();
    if (updates.testIds) {
        updates.tests = updates.testIds;
        delete updates.testIds;
    }

    const updatedPackage = await req.TenantPackage.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedPackage) return res.status(404).json({ message: "Package not found." });
    res.json(updatedPackage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete Package (Soft Delete)
router.delete("/packages/:id", async (req, res) => {
  try {
    await req.TenantPackage.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: "Package deactivated." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a purely custom test
router.post("/custom", async (req, res) => {
  try {
    const { name, testCode, department, category, price, tat, alias, specimenType, sampleQuantity, method, parameters, template } = req.body;

    if (!name || !testCode || !department || price === undefined) {
        return res.status(400).json({ message: "Name, Test Code, Department, and Price are required." });
    }

    const existing = await req.TenantTest.findOne({ testCode: testCode });
    if (existing) return res.status(409).json({ message: `Test Code '${testCode}' is already in use.` });

    const newTest = new req.TenantTest({
      institutionId: req.user.institutionId,
      baseTestId: null,
      name,
      testCode: testCode.toUpperCase(),
      alias,
      department,
      category,
      price: price || 0,
      tat,
      specimenType,
      sampleQuantity,
      method,
      parameters: Array.isArray(parameters) ? parameters : [],
      template: template || "",
      isActive: true
    });

    await newTest.save();
    res.status(201).json(newTest);

  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Duplicate Test Code or Name." });
    res.status(500).json({ message: err.message });
  }
});

// --- 2. GENERAL ROOT ROUTES ---

// Get all tests
router.get("/", async (req, res) => {
  try {
    const tests = await req.TenantTest.find({ isActive: true }).sort({ name: 1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a test (Link BaseTest)
router.post("/", async (req, res) => {
  try {
    const { baseTestId, price, tat, alias, customCode } = req.body;
    const baseTest = await BaseTest.findById(baseTestId);
    if (!baseTest) return res.status(404).json({ message: "Master Test not found." });

    const existing = await req.TenantTest.findOne({ baseTestId });
    if (existing) return res.status(409).json({ message: "This test is already added to your list." });

    const newTest = new req.TenantTest({
      institutionId: req.user.institutionId,
      baseTestId: baseTest._id,
      name: baseTest.name,
      testCode: customCode || baseTest.code,
      alias: alias || baseTest.alias,
      department: baseTest.department,
      price: price || 0,
      tat: tat || "",
      isActive: true
    });

    await newTest.save();
    res.status(201).json(newTest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- 3. PARAMETERIZED ROUTES (MUST BE LAST) ---

// Get Single Test Details (Merged)
router.get("/:id", async (req, res) => {
  try {
    const localTest = await req.TenantTest.findById(req.params.id);
    if (!localTest) return res.status(404).json({ message: "Test not found." });

    let responseData = localTest.toObject();

    if (localTest.baseTestId) {
      const masterTest = await BaseTest.findById(localTest.baseTestId);
      if (masterTest) {
        if (!responseData.parameters || responseData.parameters.length === 0) responseData.parameters = masterTest.parameters;
        if (!responseData.method) responseData.method = masterTest.method;
        if (!responseData.specimenType) responseData.specimenType = masterTest.specimenType;
        if (!responseData.sampleQuantity) responseData.sampleQuantity = masterTest.sampleQuantity;
        if (!responseData.template) responseData.template = masterTest.template;
        if (!responseData.description) responseData.description = masterTest.description;
      }
    }
    res.json(responseData);
  } catch (err) {
    console.error("Get Test Details Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Update Test (Decouples if Core changed)
router.put("/:id", async (req, res) => {
  try {
    const testId = req.params.id;
    const updates = req.body;

    // 1. Fetch the existing local test
    const existingTest = await req.TenantTest.findById(testId);
    if (!existingTest) return res.status(404).json({ message: "Test not found." });

    // 2. Fetch Master Test (if linked) to check for defaults
    let masterTest = null;
    if (existingTest.baseTestId) {
        masterTest = await BaseTest.findById(existingTest.baseTestId);
    }

    // 3. Define Core Fields
    const coreFields = [
        "name", "department", "category", 
        "specimenType", "sampleQuantity", "method", 
        "template"
    ];

    let shouldDecouple = false;

    // 4. Compare Simple Core Fields
    for (const field of coreFields) {
        const incomingVal = updates[field];
        const localVal = existingTest[field];
        const masterVal = masterTest ? masterTest[field] : undefined;

        // Skip if incoming value is not provided
        if (incomingVal === undefined) continue;

        // If incoming differs from Local...
        if (incomingVal !== localVal) {
            // ...AND it also differs from Master (or Master doesn't exist)
            // Then it is a true customization.
            if (!masterTest || incomingVal !== masterVal) {
                shouldDecouple = true;
                
                break; 
            }
        }
    }

    // 5. Compare Parameters (Complex Logic)
    if (!shouldDecouple && updates.parameters) {
        const cleanIncoming = updates.parameters.map(p => {
            const { _id, ...rest } = p; 
            return rest; 
        });

        let currentEffectiveParams = existingTest.parameters;
        if (existingTest.parameters.length === 0 && masterTest) {
            currentEffectiveParams = masterTest.parameters;
        }

        const cleanCurrent = currentEffectiveParams.map(p => {
            const obj = p.toObject ? p.toObject() : p;
            const { _id, ...rest } = obj;
            return rest;
        });

        if (JSON.stringify(cleanIncoming) !== JSON.stringify(cleanCurrent)) {
            shouldDecouple = true;
            
        }
    }

    // 6. Apply Decoupling if needed
    if (shouldDecouple) {
        updates.baseTestId = null;
        updates.baseTestCode = null;
    }

    // 7. Update
    const updatedTest = await req.TenantTest.findByIdAndUpdate(
        testId,
        { $set: updates },
        { new: true, runValidators: true }
    );

    const wasDecoupled = shouldDecouple && existingTest.baseTestId && !updatedTest.baseTestId;
    
    res.json({ ...updatedTest.toObject(), _wasDecoupled: wasDecoupled });

  } catch (err) {
    console.error("Update Test Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Delete Test
router.delete("/:id", async (req, res) => {
  try {
    const deletedTest = await req.TenantTest.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
    );
    if (!deletedTest) return res.status(404).json({ message: "Test not found." });
    res.json({ message: "Test deactivated successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;