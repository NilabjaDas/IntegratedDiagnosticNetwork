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


const getTenantUserModel = async (institutionId) => {
    const institution = await Institution.findOne({ institutionId });
    if (!institution) return null;

    // Connect to the specific tenant database
    const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
    
    // Handle both Schema export and Model export patterns safely
    const UserSchema = User.schema || User; 
    
    // Return the compiled model for this specific DB
    return getModel(tenantDb, "User", UserSchema);
};


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
router.get("/institutions", requireSuperAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || "";
        const status = req.query.status;

        const skip = (page - 1) * limit;
        let query = { deleted: false };

        if (search) {
            query.$or = [
                { institutionName: { $regex: search, $options: "i" } },
                { institutionCode: { $regex: search, $options: "i" } },
                // Search inside the domains array
                { domains: { $regex: search, $options: "i" } }
            ];
        }

        if (status !== undefined) {
            query.status = status === 'true';
        }

        const institutions = await Institution.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

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
 * @desc    Create a new Institution with Auto-Generated Admin
 */
router.post("/institutions", requireSuperAdmin, async (req, res) => {
    try {
        if (!req.user.isMasterAdmin) {
            return res.status(403).json({ message: "Forbidden: Only Master Admin can create institutions." });
        }

        const data = req.body;
        
        if (!data.institutionName) {
            return res.status(400).json({ message: "institutionName is required." });
        }

        // --- HARDCODED ADMIN CREDENTIALS ---
        const adminData = {
            username: "superadmin",
            password: "TechFloater@2025",
            fullName: "Super Admin",
            email: data.contact?.email || "admin@placeholder.com",
            phone: data.contact?.phone || "",
            role: "admin",
            isActive: true
        };

        // 1. Auto-Generate & Sanitize DB Name
        if (data.dbName) {
            data.dbName = generateDbName(data.dbName);
        } else {
            data.dbName = generateDbName(data.institutionName);
            if (data.dbName.length < 3 || data.dbName === 'CLINIC') {
                 data.dbName += `_${Math.floor(Math.random() * 1000)}`;
            }
        }

        // 2. Generate Code
        if (!data.institutionCode) {
            data.institutionCode = generateInstitutionCode(data.institutionName);
        }

        // 3. Domain Logic
        if (!data.domains || !Array.isArray(data.domains)) {
            data.domains = [];
        }

        if (data.domains.length === 0) {
            const baseDomain = process.env.BASE_DOMAIN || "scholastech.com"; 
            const defaultDomain = `${data.dbName}.${baseDomain}`.toLowerCase();
            data.domains.push(defaultDomain);
        } else {
            data.domains = data.domains.map(d => d.toLowerCase());
        }

        // 4. Subscription Logic
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

        // 5. Conflict Check
        const existing = await Institution.findOne({
            $or: [
                { dbName: data.dbName },
                { domains: { $in: data.domains } },
                { institutionCode: data.institutionCode }
            ]
        });

        if (existing) {
            return res.status(409).json({ 
                message: "Conflict: One of the Domains, DB Name, or Code already exists.",
            });
        }

        // 6. Create Institution Document
        const newInstitution = new Institution({
            ...data,
            createdBy: req.user.userId || req.user.username,
            onboardingStatus: "pending"
        });

        const savedInstitution = await newInstitution.save();

        // 7. Initialize Tenant DB & Admin User
        const tenantDb = mongoose.connection.useDb(savedInstitution.dbName, { useCache: true });
        
        const UserSchema = User.schema || User; 
        const TenantUser = getModel(tenantDb, "User", UserSchema);

        const salt = await bcrypt.genSalt(10);
        const hashedAdminPassword = await bcrypt.hash(adminData.password, salt);

        const newAdminUser = new TenantUser({
            institutionId: savedInstitution.institutionId,
            userId: uuidv4(),
            username: adminData.username,
            password: hashedAdminPassword,
            fullName: adminData.fullName,
            email: adminData.email,
            phone: adminData.phone,
            role: adminData.role,
            isActive: true
        });

        await newAdminUser.save();

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
 * @route   GET /api/institutions/:id/users
 * @desc    Get all users (admins, staff, etc.) for a specific institution
 */
router.get("/institutions/:id/users", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const TenantUser = await getTenantUserModel(id);
        
        if (!TenantUser) {
            return res.status(404).json({ message: "Institution not found." });
        }

        const users = await TenantUser.find({}).select("-password").sort({ createdAt: -1 });
        res.json({ data: users });
    } catch (err) {
        console.error("Get Tenant Users Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
/**
 * @route   POST /api/institutions/:id/users
 * @desc    Create a new user (e.g. another admin) for a specific institution
 */
router.post("/institutions/:id/users", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, fullName, role, email, phone, designation, isActive } = req.body;

        if (!username || !password || !fullName) {
            return res.status(400).json({ message: "Username, password, and full name are required." });
        }

        const TenantUser = await getTenantUserModel(id);
        if (!TenantUser) {
            return res.status(404).json({ message: "Institution not found." });
        }

        // Check if username exists in tenant DB
        const existingUser = await TenantUser.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: "Username already exists in this institution." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new TenantUser({
            institutionId: id, 
            userId: uuidv4(),
            username,
            password: hashedPassword,
            fullName,
            role: role || "admin", // Default to admin for manual creation
            email,
            phone,
            designation,
            isActive: isActive !== undefined ? isActive : true
        });

        await newUser.save();

        const responseObj = newUser.toObject();
        delete responseObj.password;

        res.status(201).json({ message: "User created successfully", data: responseObj });

    } catch (err) {
        console.error("Create Tenant User Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @route   PUT /api/institutions/:id/users/:userId
 * @desc    Update a user for a specific institution
 */
router.put("/institutions/:id/users/:userId", requireSuperAdmin, async (req, res) => {
    try {
        const { id, userId } = req.params;
        const updates = req.body;

        const TenantUser = await getTenantUserModel(id);
        if (!TenantUser) {
            return res.status(404).json({ message: "Institution not found." });
        }

        // Handle password update specially
        if (updates.password && updates.password.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        } else {
            // Remove empty password field to prevent overwriting with empty string
            delete updates.password;
        }

        // Prevent updating immutable fields
        delete updates.userId;
        delete updates._id;
        delete updates.institutionId;

        const updatedUser = await TenantUser.findOneAndUpdate(
            { userId: userId },
            { $set: updates },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json({ message: "User updated successfully", data: updatedUser });

    } catch (err) {
        console.error("Update Tenant User Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @route   DELETE /api/institutions/:id/users/:userId
 * @desc    Delete a user for a specific institution
 */
router.delete("/institutions/:id/users/:userId", requireSuperAdmin, async (req, res) => {
    try {
        const { id, userId } = req.params;

        const TenantUser = await getTenantUserModel(id);
        if (!TenantUser) {
            return res.status(404).json({ message: "Institution not found." });
        }

        const deletedUser = await TenantUser.findOneAndDelete({ userId: userId });

        if (!deletedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json({ message: "User deleted successfully" });

    } catch (err) {
        console.error("Delete Tenant User Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
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

router.put("/institutions/:id/activate", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Find and update
        const updatedInstitution = await Institution.findOneAndUpdate(
            { institutionId: id },
            { 
                $set: { 
                    status: true, 
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
            status: "Active"
        });

    } catch (err) {
        console.error("Deactivate Institution Error:", err);
        res.status(500).json({ message: "Internal Server Error: " + err.message });
    }
});



/**
 * @route   PUT /api/institutions/:id
 * @desc    Update an Institution (Generic)
 * @access  Super Admin Only
 */
router.put("/institutions/:id", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // 1. Prevent updating immutable fields
        // Changing these would break tenant connections or data integrity
        delete updates.institutionId;
        delete updates.dbName; 
        delete updates.institutionCode; // Usually constant, but can be allowed if careful
        delete updates._id;
        delete updates.createdAt;
        delete updates.createdBy;

        // 2. Add audit trail
        updates.updatedBy = req.user.username || "SuperAdmin";

        // 3. Handle Domain Formatting (if domains are being updated)
        if (updates.domains) {
            if (!Array.isArray(updates.domains)) {
                return res.status(400).json({ message: "Domains must be an array of strings." });
            }
            // Ensure lowercase for uniqueness checks
            updates.domains = updates.domains.map(d => d.toLowerCase().trim());
        }

        // 4. Find and Update
        // runValidators: true ensures schema validation (e.g. enums, types) runs on update
        const updatedInstitution = await Institution.findOneAndUpdate(
            { institutionId: id },
            { $set: updates },
            { new: true, runValidators: true, context: 'query' } 
        );

        // 5. Handle Not Found
        if (!updatedInstitution) {
            return res.status(404).json({ message: "Institution not found." });
        }

        res.json({
            message: "Institution updated successfully.",
            data: updatedInstitution
        });

    } catch (err) {
        console.error("Update Institution Error:", err);

        // Handle Duplicate Key Errors (e.g., Domain already taken by another institution)
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            return res.status(409).json({ 
                message: `Conflict: The ${field} provided is already in use by another institution.` 
            });
        }

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


router.get("/base-tests",requireSuperAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || "";
        const department = req.query.department;

        const skip = (page - 1) * limit;
        let query = {};

        if (search) {
            query.$text = { $search: search };
        }

        if (department) {
            query.department = department;
        }

        const tests = await BaseTest.find(query)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit);

        const total = await BaseTest.countDocuments(query);

        res.json({
            data: tests,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error("Get Base Tests Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/catalog/base-tests
 * @desc    Create a Single Base Test
 * @access  Super Admin Only
 */
router.post("/base-tests", requireSuperAdmin, async (req, res) => {
    try {
        const { code, name, department, category, specimenType, method, parameters, description, prerequisites } = req.body;

        if (!code || !name || !department) {
            return res.status(400).json({ message: "Code, Name, and Department are required." });
        }

        const existing = await BaseTest.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(409).json({ message: `Test with code ${code} already exists.` });
        }

        const newTest = new BaseTest({
            code: code.toUpperCase(),
            name,
            department,
            category,
            specimenType,
            method,
            parameters,     // Array of objects
            description,
            prerequisites,
            isActive: true
        });

        await newTest.save();
        res.status(201).json({ message: "Base Test created successfully", data: newTest });

    } catch (err) {
        console.error("Create Base Test Error:", err);
        res.status(500).json({ message: "Internal Server Error: " + err.message });
    }
});

/**
 * @route   PUT /api/catalog/base-tests/:id
 * @desc    Update a Base Test
 * @access  Super Admin Only
 */
router.put("/base-tests/:id", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Prevent changing immutable fields if necessary, typically code should be stable
        // updates.code = updates.code?.toUpperCase(); 

        const updatedTest = await BaseTest.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedTest) {
            return res.status(404).json({ message: "Test not found." });
        }

        res.json({ message: "Base Test updated successfully", data: updatedTest });

    } catch (err) {
        console.error("Update Base Test Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @route   DELETE /api/catalog/base-tests/:id
 * @desc    Delete (Soft or Hard) a Base Test
 * @access  Super Admin Only
 */
router.delete("/base-tests/:id", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Hard Delete
        const deletedTest = await BaseTest.findByIdAndDelete(id);

        if (!deletedTest) {
            return res.status(404).json({ message: "Test not found." });
        }

        res.json({ message: "Base Test deleted successfully." });

    } catch (err) {
        console.error("Delete Base Test Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/catalog/seed-base
 * @desc    Bulk Upsert Base Tests (For seeding/migration)
 * @access  Super Admin Only
 */
router.post("/seed-base", requireSuperAdmin, async (req, res) => {
    try {
        const tests = req.body;
        if (!Array.isArray(tests)) return res.status(400).json({ message: "Body must be an array" });

        const operations = tests.map(test => ({
            updateOne: {
                filter: { code: test.code?.toUpperCase() }, // Match by Code
                update: { 
                    $set: {
                        code: test.code?.toUpperCase(),
                        name: test.name,
                        department: test.department,
                        category: test.category,
                        specimenType: test.specimenType,
                        method: test.method,
                        parameters: test.parameters,
                        description: test.description,
                        prerequisites: test.prerequisites,
                        isDescriptive: test.isDescriptive,
                        template: test.template
                    }
                },
                upsert: true
            }
        }));

        const result = await BaseTest.bulkWrite(operations);
        res.json({ message: "Base Master Catalog Updated", result });

    } catch (err) {
        console.error("Seed Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
