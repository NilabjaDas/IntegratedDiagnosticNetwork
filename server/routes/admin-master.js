const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const BaseTest = require("../models/BaseTest");
const Institution = require("../models/Institutions");
const SuperAdmin = require("../models/SuperAdmin");
const User = require("../models/User"); // We use User schema to create the initial admin in the new DB
const { requireSuperAdmin } = require("../middleware/auth");

const JWT_SEC = process.env.JWT_SEC;



// --- AUTH ROUTES ---

// POST /api/admin-master/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check in Master DB
    // Note: In a real scenario, we might want to bootstrap the first super admin if none exists
    const admin = await SuperAdmin.findOne({ username }).select("+password");
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id, role: "super_admin" }, JWT_SEC, { expiresIn: "1d" });
    res.json({ token, user: { username: admin.username, fullName: admin.fullName } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});


// --- INSTITUTION MANAGEMENT ---
// Helper: Sanitize string for DB Name (e.g., "My Clinic!" -> "MY-CLINIC")
const generateDbName = (name) => {
    return name.toUpperCase()
        .replace(/[^A-Z0-9]/g, '-') // replace non-alphanumeric with hyphen
        .replace(/-+/g, '-')        // remove duplicate hyphens
        .replace(/^-|-$/g, '');     // trim leading/trailing hyphens
};

// Helper: Generate Random Code (e.g., "CLINIC-X92Z")
const generateInstitutionCode = (name) => {
    const prefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${random}`;
};

/**
 * @route   GET /api/institutions
 * @desc    Get All Institutions (with Pagination & Search)
 * @access  Super Admin Only
 */
router.get("/institutions", requireSuperAdmin, async (req, res) => {
    try {
        // 1. Pagination & Query Params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || "";
        const status = req.query.status; // Optional: filter by 'active' (true) or 'inactive' (false)

        const skip = (page - 1) * limit;

        // 2. Build Query Object
        let query = { deleted: false }; // Don't show soft-deleted ones

        // Add Search (Name, Code, or Domain)
        if (search) {
            query.$or = [
                { institutionName: { $regex: search, $options: "i" } }, // Case-insensitive regex
                { institutionCode: { $regex: search, $options: "i" } },
                { primaryDomain: { $regex: search, $options: "i" } }
            ];
        }

        // Add Status Filter if provided
        if (status !== undefined) {
            query.status = status === 'true';
        }

        // 3. Execute Query
        // The sensitive fields (masterPassword, etc.) are {select: false} in schema, 
        // so they are automatically excluded here.
        const institutions = await Institution.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(limit);

        // 4. Get Total Count (for frontend pagination UI)
        const total = await Institution.countDocuments(query);

        res.json({
            message: "Institutions fetched successfully",
            data: institutions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error("Get All Institutions Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/institutions
 * @desc    Create a new Institution (Master Admin Only)
 */
router.post("/institutions", requireSuperAdmin, async (req, res) => {
    try {
        // 1. Strict Authorization Check
        if (!req.user.isMasterAdmin) {
            return res.status(403).json({ message: "Forbidden: Only Master Admin can create institutions." });
        }

        const data = req.body;

        // 2. Validate Essential Field
        if (!data.institutionName) {
            return res.status(400).json({ message: "institutionName is required." });
        }

        // 3. Auto-Generate Unique Fields if missing
        
        // A. DB Name (Required, Unique)
        if (!data.dbName) {
            data.dbName = generateDbName(data.institutionName);
            // Append random string if name is very common to ensure uniqueness
            if (data.dbName.length < 3 || data.dbName === 'clinic') {
                 data.dbName += `_${Math.floor(Math.random() * 1000)}`;
            }
        }

        // B. Institution Code (Required, Unique)
        if (!data.institutionCode) {
            data.institutionCode = generateInstitutionCode(data.institutionName);
        }

        // C. Primary Domain (Required, Unique)
        // If not provided, we create a subdomain based on the dbName
        if (!data.primaryDomain) {
            // Check if you have a base domain env var, otherwise use placeholder
            const baseDomain = process.env.BASE_DOMAIN || "scholastech.com"; 
            data.primaryDomain = `${data.dbName}.${baseDomain}`;
        }

        // 4. Subscription Date Logic
        // If subscription is provided, calculate end date if not present
        if (data.subscription) {
            if (!data.subscription.endDate) {
                const startDate = data.subscription.startDate ? new Date(data.subscription.startDate) : new Date();
                const endDate = new Date(startDate);
                
                if (data.subscription.frequency === 'yearly') {
                    endDate.setFullYear(endDate.getFullYear() + 1);
                } else {
                    // Default monthly
                    endDate.setMonth(endDate.getMonth() + 1);
                }
                data.subscription.endDate = endDate;
            }
        }

        // 5. Conflict Check (Pre-flight)
        // Check if DB name or Domain already exists to give a clear error
        const existing = await Institution.findOne({
            $or: [
                { dbName: data.dbName },
                { primaryDomain: data.primaryDomain },
                { institutionCode: data.institutionCode }
            ]
        });

        if (existing) {
            return res.status(409).json({ 
                message: "Conflict detected: An institution with this Domain, DB Name, or Code already exists.",
                details: {
                    inputDb: data.dbName,
                    inputDomain: data.primaryDomain,
                    inputCode: data.institutionCode
                }
            });
        }

        // 6. Create Institution Document
        // Note: The pre('save') hook in the model will handle password hashing if masterPassword is sent
        const newInstitution = new Institution({
            ...data,
            createdBy: req.user.userId || req.user.username, // Audit
            onboardingStatus: "pending"
        });

        const savedInstitution = await newInstitution.save();

        // 7. Multi-tenancy: "Create" the Separate Database
        // In MongoDB, a database is created lazily when data is inserted.
        // We initialize the tenant DB connection and perhaps seed a default collection to 'realize' the DB.
        
        const tenantDb = mongoose.connection.useDb(savedInstitution.dbName, { useCache: true });
        
        // OPTIONAL: Seed initial data into the new DB (e.g., Default Settings, Counter)
        // const SettingsModel = tenantDb.model('Setting', require('../models/SettingSchema'));
        // await SettingsModel.create({ systemDefault: true });

        // 8. Return Success (Filter sensitive info)
        const responseObj = savedInstitution.toObject();
        delete responseObj.masterPassword;
        delete responseObj.paymentGateway;
        delete responseObj.smtp;

        res.status(201).json({
            message: "Institution created successfully.",
            institution: responseObj,
            dbInfo: {
                name: savedInstitution.dbName,
                status: "Initialized"
            }
        });

    } catch (err) {
        console.error("Create Institution Error:", err);
        // Handle Duplicate Key Errors (E11000) explicitly if race condition occurs
        if (err.code === 11000) {
            return res.status(409).json({ message: "Duplicate key error. Domain, Code, or DB Name already exists." });
        }
        res.status(500).json({ message: "Internal Server Error: " + err.message });
    }
});

/**
 * @route   PUT /api/institutions/:id/deactivate
 * @desc    Deactivate an institution (Sets status to false)
 * @access  Super Admin Only
 */
router.put("/institutions/:id/deactivate", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Find and update
        const updatedInstitution = await Institution.findOneAndUpdate(
            { institutionId: id },
            { 
                $set: { 
                    status: false, 
                    updatedBy: req.user.username || "SuperAdmin"
                } 
            },
            { new: true } // Return the updated document
        );

        // 2. Handle Not Found
        if (!updatedInstitution) {
            return res.status(404).json({ message: "Institution not found." });
        }

        res.json({ 
            message: "Institution successfully deactivated.", 
            institutionName: updatedInstitution.institutionName,
            status: "Inactive"
        });

    } catch (err) {
        console.error("Deactivate Institution Error:", err);
        res.status(500).json({ message: "Internal Server Error: " + err.message });
    }
});

/**
 * @route   DELETE /api/institutions/:id
 * @desc    PERMANENTLY DELETE Institution and DROP its Database
 * @access  Super Admin Only
 */
router.delete("/institutions/:id", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Find the institution first to get the DB Name
        const institution = await Institution.findOne({ institutionId: id });

        if (!institution) {
            return res.status(404).json({ message: "Institution not found." });
        }

        const targetDbName = institution.dbName;

        // SAFETY CHECK: Prevent dropping the Master DB by accident
        // Assuming your master DB is named 'admin', 'master', or defined in env
        const masterDbName = mongoose.connection.name; 
        if (targetDbName === masterDbName || targetDbName === 'admin') {
            return res.status(400).json({ message: "Security Risk: Cannot delete the Master Database via this API." });
        }

        // 2. Drop the Tenant Database
        try {
            // Switch to the tenant DB context
            const tenantDb = mongoose.connection.useDb(targetDbName);
            
            // Drop it
            await tenantDb.dropDatabase();
            console.log(`[System] Dropped database: ${targetDbName}`);
        } catch (dbErr) {
            console.error(`[Warning] Failed to drop database ${targetDbName}:`, dbErr);
            // We continue execution to delete the metadata, but warn the admin in the response
        }

        // 3. Delete the Institution Metadata from Master DB
        await Institution.deleteOne({ institutionId: id });

        res.json({ 
            message: "Institution and associated database deleted permanently.", 
            deletedId: id,
            droppedDatabase: targetDbName
        });

    } catch (err) {
        console.error("Delete Institution Error:", err);
        res.status(500).json({ message: "Internal Server Error: " + err.message });
    }
});

// --- BASE TEST MANAGEMENT ---

// GET /api/admin-master/base-tests
router.get("/base-tests", requireSuperAdmin, async (req, res) => {
    const tests = await BaseTest.find().sort({ name: 1 });
    res.json(tests);
});

// POST /api/admin-master/seed-base (Legacy/Bulk)
router.post("/seed-base", requireSuperAdmin, async (req, res) => {
  try {
    const tests = req.body;
    if (!Array.isArray(tests)) return res.status(400).json({ message: "Body must be an array" });

    const operations = tests.map(test => ({
      updateOne: {
        filter: { code: test.testCode || test.code },
        update: { 
          $set: {
            code: test.testCode || test.code,
            name: test.name,
            department: test.department,
            category: test.category,
            parameters: test.parameters,
            template: test.template
          }
        },
        upsert: true
      }
    }));

    const result = await BaseTest.bulkWrite(operations);
    res.json({ message: "Base Master Updated", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
