const express = require("express");
const router = express.Router();
const Institution = require("../models/Institutions");
const { getConnection } = require("../handlers/dbConnection");

// ==========================================
// 1. SEARCH INSTITUTIONS
// ==========================================
router.get("/institutions", async (req, res) => {
  try {
    const { city, search } = req.query;
    const query = { status: true };

    if (city) {
        query["address.city"] = new RegExp(city, "i");
    }
    if (search) {
        query.institutionName = new RegExp(search, "i");
    }

    const institutions = await Institution.find(query)
        .select("institutionName institutionId primaryDomain institutionLogoUrl address")
        .limit(20);

    res.json(institutions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. GET INSTITUTION CATALOG
// ==========================================
router.get("/institutions/:institutionId/catalog", async (req, res) => {
    try {
        const { institutionId } = req.params;
        const inst = await Institution.findOne({ institutionId });
        if (!inst) return res.status(404).json({ message: "Institution not found" });

        // Connect to Tenant DB
        const masterConn = getConnection();
        const tenantDb = masterConn.useDb(inst.dbName, { useCache: true });

        // We need a Test Model schema.
        // Assuming there is a local 'Test' model in the tenant DB.
        // For now, let's look at BaseTest or mock it if local Test schema isn't defined yet.
        // The plan didn't explicitly create a local Test model file, but hinted at it.
        // I'll assume we can list BaseTests or check if there's a local collection.
        // Let's just return a placeholder or Empty list if collection doesn't exist.

        // Use generic collection access for flexibility if schema is missing in this context
        const tests = await tenantDb.collection("tests").find({ isActive: true }).toArray();

        // If empty, maybe they haven't imported tests.
        // Let's return some mock data if empty for the demo,
        // OR return empty array.
        res.json(tests);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. BOOK APPOINTMENT (CREATE ORDER)
// ==========================================
router.post("/book", async (req, res) => {
    // Requires Patient Token
    // We haven't added Auth Middleware to this route file yet,
    // but in index.js we can protect it.

    // Logic:
    // 1. Get Institution
    // 2. Switch DB
    // 3. Create Order
    res.json({ message: "Booking logic placeholder" });
});

module.exports = router;
