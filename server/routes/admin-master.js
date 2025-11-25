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

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// --- MIDDLEWARE: Super Admin Auth Check ---
const requireSuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "super_admin") {
      return res.status(403).json({ message: "Not authorized as Super Admin" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// --- AUTH ROUTES ---

// POST /api/admin-master/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check in Master DB
    // Note: In a real scenario, we might want to bootstrap the first super admin if none exists
    const admin = await SuperAdmin.findOne({ username }).select("+password");
    if (!admin) {
        // DEV ONLY: Bootstrap if empty
        const count = await SuperAdmin.countDocuments();
        if (count === 0 && username === "admin" && password === "admin") {
            const hashed = await bcrypt.hash(password, 10);
            const newAdmin = await SuperAdmin.create({
                username,
                password: hashed,
                fullName: "Master Admin"
            });
             const token = jwt.sign({ id: newAdmin._id, role: "super_admin" }, JWT_SECRET, { expiresIn: "1d" });
             return res.json({ token, user: { username: newAdmin.username, fullName: newAdmin.fullName } });
        }
        return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id, role: "super_admin" }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user: { username: admin.username, fullName: admin.fullName } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});


// --- INSTITUTION MANAGEMENT ---

// GET /api/admin-master/institutions
router.get("/institutions", requireSuperAdmin, async (req, res) => {
  try {
    const list = await Institution.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin-master/institutions
router.post("/institutions", requireSuperAdmin, async (req, res) => {
  try {
    const {
      institutionName,
      subdomain,
      institutionCode,
      dbName,
      adminUsername,
      adminPassword,
      adminName,
      adminEmail,
      adminPhone
    } = req.body;

    // 1. Validation
    if (!subdomain || !dbName || !institutionCode) {
      return res.status(400).json({ message: "Missing required fields (subdomain, dbName, institutionCode)" });
    }

    // 2. Check Uniqueness in Master
    const existing = await Institution.findOne({
      $or: [
        { primaryDomain: subdomain },
        { institutionCode },
        { dbName }
      ]
    });

    if (existing) {
      return res.status(409).json({ message: "Institution with this Subdomain, Code, or DB Name already exists." });
    }

    // 3. Create Institution Record in Master
    const newInst = new Institution({
      institutionName,
      primaryDomain: subdomain,
      institutionCode,
      dbName,
      status: true
    });

    await newInst.save();

    // 4. Initialize the Institution Database
    // We need to switch to that DB and create the initial Admin User
    const masterConn = mongoose.connection; // This assumes we are connected to Master in this route context
    const tenantDb = masterConn.useDb(dbName, { useCache: true });

    // We need to register the User model on this new connection
    const UserSchema = require("../models/User").schema;
    const TenantUser = tenantDb.model("User", UserSchema);

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await TenantUser.create({
      institutionId: newInst.institutionId,
      username: adminUsername,
      password: hashedPassword,
      fullName: adminName,
      email: adminEmail,
      phone: adminPhone,
      role: "admin", // The Local Admin
      isMasterAdmin: true
    });

    res.status(201).json({ message: "Institution created successfully", institution: newInst });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create institution: " + err.message });
  }
});

// PUT /api/admin-master/institutions/:id
router.put("/institutions/:id", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Prevent updating protected fields
        delete updateData.institutionId;
        delete updateData.institutionCode;
        delete updateData.dbName;
        delete updateData._id;

        const updatedInstitution = await Institution.findOneAndUpdate(
            { institutionId: id },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedInstitution) {
            return res.status(404).json({ message: "Institution not found" });
        }

        res.json({ message: "Institution updated successfully", institution: updatedInstitution });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update institution: " + err.message });
    }
});

// DELETE /api/admin-master/institutions/:id
router.delete("/institutions/:id", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const deletedInstitution = await Institution.findOneAndUpdate(
            { institutionId: id },
            { $set: { deleted: true, status: false } }, // Soft delete and deactivate
            { new: true }
        );

        if (!deletedInstitution) {
            return res.status(404).json({ message: "Institution not found" });
        }

        res.json({ message: "Institution soft-deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete institution: " + err.message });
    }
});

// PUT /api/admin-master/institutions/:id/status
router.put("/institutions/:id/status", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (typeof status !== 'boolean') {
            return res.status(400).json({ message: "Invalid 'status' field provided." });
        }

        const updatedInstitution = await Institution.findOneAndUpdate(
            { institutionId: id },
            { $set: { status: status } },
            { new: true }
        );

        if (!updatedInstitution) {
            return res.status(404).json({ message: "Institution not found" });
        }

        res.json({ message: `Institution status updated to ${status ? 'Active' : 'Inactive'}`, institution: updatedInstitution });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update institution status: " + err.message });
    }
});

// POST /api/admin-master/users/:institutionId
router.post("/users/:institutionId", requireSuperAdmin, async (req, res) => {
    try {
        const { institutionId } = req.params;
        const { name, username, email, phone, password } = req.body;

        const institution = await Institution.findOne({ institutionId });
        if (!institution) {
            return res.status(404).json({ message: "Institution not found" });
        }

        const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
        const UserSchema = require("../models/User").schema;
        const TenantUser = tenantDb.model("User", UserSchema);

        const hashedPassword = await bcrypt.hash(password, 10);

        await TenantUser.create({
            institutionId,
            username,
            password: hashedPassword,
            fullName: name,
            email,
            phone,
            role: "admin",
            isMasterAdmin: false
        });

        res.status(201).json({ message: "User created successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to create user: " + err.message });
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
