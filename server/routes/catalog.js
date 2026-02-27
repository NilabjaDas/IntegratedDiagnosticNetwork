const express = require("express");
const router = express.Router();
const BaseTest = require("../models/BaseTest");
const Test = require("../models/Test");
const Package = require("../models/Package");
const { authenticateUser } = require("../middleware/auth");

// 1. SEARCH Base Master (Autocomplete)
// GET /api/catalog/search-master?q=cbc
router.get("/search-master", authenticateUser, async (req, res) => {
  try {
    const { q } = req.query;
    // Text search on Name or Code
    const results = await BaseTest.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" } })
    .limit(10);
    
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1.5 GET ALL Master Catalog Tests (For Bulk Import Modal)
// GET /api/catalog/tests
router.get("/tests", authenticateUser, async (req, res) => {
  try {
    // Fetch all base tests, sorted alphabetically
    // You might want to add a .limit(500) if your master catalog grows massively
    const tests = await BaseTest.find().select("name code department category").sort({ name: 1 });
    
    // Map the 'code' to 'shortName' or 'alias' so the frontend modal can read it easily
    const formattedTests = tests.map(t => ({
      _id: t._id,
      name: t.name,
      alias: t.code,
      department: t.department,
      category: t.category
    }));

    res.json(formattedTests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. IMPORT Test from Master to Institution
// POST /api/catalog/import-test
router.post("/import-test", authenticateUser, async (req, res) => {
  try {
    const { baseTestId, price, tat } = req.body;
    const instId = req.user.institutionId;

    // Fetch from Global Library
    const base = await BaseTest.findById(baseTestId);
    if (!base) return res.status(404).json({ message: "Base test not found" });

    // Check if already exists in this institution
    const existing = await Test.findOne({ institutionId: instId, testCode: base.code });
    if (existing) return res.status(409).json({ message: "Test already exists in your catalog" });

    // Create local copy
    const newTest = new Test({
      institutionId: instId,
      testCode: base.code,
      name: base.name,
      department: base.department,
      category: base.category,
      price: price, // Institution specific price
      tat: tat, // Institution specific TAT
      parameters: base.parameters, // Copy parameters (they can edit later if needed)
      template: base.template
    });

    await newTest.save();
    res.status(201).json(newTest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. CREATE PACKAGE (Bundle)
// POST /api/catalog/packages
router.post("/packages", authenticateUser, async (req, res) => {
  try {
    const { name, testIds, offerPrice } = req.body; // testIds = Array of Institution Test _ids
    const instId = req.user.institutionId;

    // Validate that all tests belong to this institution
    const tests = await Test.find({ _id: { $in: testIds }, institutionId: instId });
    
    if (tests.length !== testIds.length) {
      return res.status(400).json({ message: "Some tests are invalid or do not belong to your lab." });
    }

    // Calculate Actual Price (Sum of individual tests)
    const actualPrice = tests.reduce((sum, t) => sum + t.price, 0);

    const newPkg = new Package({
      institutionId: instId,
      name,
      tests: testIds,
      actualPrice,
      offerPrice
    });

    await newPkg.save();
    res.status(201).json(newPkg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET My Catalog (Tests + Packages)
router.get("/my-catalog", authenticateUser, async (req, res) => {
  try {
    const instId = req.user.institutionId;
    
    const tests = await Test.find({ institutionId: instId });
    const packages = await Package.find({ institutionId: instId }).populate("tests", "name testCode");
    
    res.json({ tests, packages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;