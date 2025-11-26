const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const getModel = require("../middleware/getModelsHandler");
const BaseTest = require("../models/BaseTest");
const Institution = require("../models/Institutions");
const SuperAdmin = require("../models/SuperAdmin");
const User = require("../models/User"); // We use User schema to create the initial admin in the new DB
const { requireSuperAdmin } = require("../middleware/auth");
const { encryptResponse } = require("../middleware/encryptResponse");


/**
 * @route   POST /api/admin-master/create-admin
 * @desc    Create a new Super Admin
 * @access  Super Admin Only
 */
router.post("/create-admin", requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, fullName, email } = req.body;

    // 1. Basic Validation
    if (!username || !password || !fullName) {
      return res.status(400).json({ message: "Username, Password, and Full Name are required." });
    }

    // 2. Check for existing username
    const existingAdmin = await SuperAdmin.findOne({ username });
    if (existingAdmin) {
      return res.status(409).json({ message: "Username already taken." });
    }

    // 3. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create the new Admin
    const newAdmin = new SuperAdmin({
      username,
      password: hashedPassword,
      fullName,
      email,
      isActive: true
    });

    await newAdmin.save();

    res.status(201).json({ 
      message: "New Super Admin created successfully", 
      data: {
        username: newAdmin.username,
        fullName: newAdmin.fullName,
        userId: newAdmin.userId
      }
    });

  } catch (err) {
    console.error("Create Admin Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// --- INSTITUTION MANAGEMENT ---
// Helper: Sanitize string for DB Name (e.g., "My Clinic!" -> "MY-CLINIC")
const generateDbName = (name) => {
    return name.toUpperCase()
        .replace(/[^A-Z0-9]/g, '-') 
        .replace(/-+/g, '-')       
        .replace(/^-|-$/g, '');    
};

// Helper: Generate Random Code
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
router.get("/institutions", requireSuperAdmin, encryptResponse, async (req, res) => {
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
        // 1. Authorization
        if (!req.user.isMasterAdmin) {
            return res.status(403).json({ message: "Forbidden: Only Master Admin can create institutions." });
        }

        const data = req.body;
        
        // 2. Validate Institution Basics
        if (!data.institutionName) {
            return res.status(400).json({ message: "institutionName is required." });
        }

        // 3. Validate Admin User Data (Required to create the DB)
        const adminData = data.admin || {}; 
        if (!adminData.username || !adminData.password || !adminData.fullName) {
             return res.status(400).json({ 
                 message: "Admin details (username, password, fullName) are required to initialize the database." 
             });
        }

        // 4. Auto-Generate & Sanitize Unique Fields
        if (data.dbName) {
            data.dbName = generateDbName(data.dbName);
        } else {
            data.dbName = generateDbName(data.institutionName);
            if (data.dbName.length < 3 || data.dbName === 'CLINIC') {
                 data.dbName += `_${Math.floor(Math.random() * 1000)}`;
            }
        }

        if (!data.institutionCode) {
            data.institutionCode = generateInstitutionCode(data.institutionName);
        }

        if (!data.primaryDomain) {
            const baseDomain = process.env.BASE_DOMAIN || "scholastech.com"; 
            data.primaryDomain = `${data.dbName}.${baseDomain}`.toLowerCase();
        }

        // 5. Subscription Logic
        if (data.subscription) {
            if (!data.subscription.endDate) {
                const startDate = data.subscription.startDate ? new Date(data.subscription.startDate) : new Date();
                const endDate = new Date(startDate);
                
                if(data.subscription.type === 'trial' && data.subscription.trialDuration) {
                    endDate.setDate(endDate.getDate() + parseInt(data.subscription.trialDuration));
                } else if (data.subscription.frequency === 'yearly') {
                    endDate.setFullYear(endDate.getFullYear() + 1);
                } else {
                    endDate.setMonth(endDate.getMonth() + 1);
                }
                data.subscription.endDate = endDate;
            }
        }

        // 6. Conflict Check
        const existing = await Institution.findOne({
            $or: [
                { dbName: data.dbName },
                { primaryDomain: data.primaryDomain },
                { institutionCode: data.institutionCode }
            ]
        });

        if (existing) {
            return res.status(409).json({ 
                message: "Conflict: Domain, DB Name, or Code already exists.",
            });
        }

        // 7. Create Institution Document (Master DB)
        const newInstitution = new Institution({
            ...data,
            createdBy: req.user.userId || req.user.username,
            onboardingStatus: "pending"
        });

        const savedInstitution = await newInstitution.save();

        // 8. Initialize Tenant Database & Create Admin User
        //    (This physically creates the DB in MongoDB)
        
        // Switch context to the new tenant DB
        const tenantDb = mongoose.connection.useDb(savedInstitution.dbName, { useCache: true });
        
        // Compile the User model on this specific connection
        const TenantUser = getModel(tenantDb, "User", User);

        // Hash password for the new admin
        const salt = await bcrypt.genSalt(10);
        const hashedAdminPassword = await bcrypt.hash(adminData.password, salt);

        const newAdminUser = new TenantUser({
            institutionId: savedInstitution.institutionId,
            username: adminData.username,
            password: hashedAdminPassword,
            fullName: adminData.fullName,
            email: adminData.email || "",
            phone: adminData.phone || "",
            role: "admin", // Default to admin for the tenant
            isActive: true
        });

        await newAdminUser.save();

        // 9. Return Success
        res.status(201).json({
            message: "Institution and Database created successfully.",
            institution: savedInstitution,
            dbInfo: {
                name: savedInstitution.dbName,
                status: "Initialized",
                adminUser: newAdminUser.username
            }
        });

    } catch (err) {
        console.error("Create Institution Error:", err);
        if (err.code === 11000) {
            return res.status(409).json({ message: "Duplicate key error." });
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
