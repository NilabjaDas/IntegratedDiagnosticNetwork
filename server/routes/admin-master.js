const express = require("express");
const router = express.Router();
const BaseTest = require("../models/BaseTest");

// POST /api/admin/seed-base
// Body: Array of test objects (copy-paste your commonTests array here)
router.post("/seed-base", async (req, res) => {
  try {
    const tests = req.body; // Expecting array
    
    if (!Array.isArray(tests)) {
      return res.status(400).json({ message: "Body must be an array of tests" });
    }

    const operations = tests.map(test => ({
      updateOne: {
        filter: { code: test.testCode }, // Use code as unique identifier
        update: { 
          $set: {
            code: test.testCode,
            name: test.name,
            department: test.department,
            category: test.category,
            parameters: test.parameters,
            template: test.template
          }
        },
        upsert: true // Create if doesn't exist, Update if it does
      }
    }));

    const result = await BaseTest.bulkWrite(operations);
    res.json({ message: "Base Master Updated", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;