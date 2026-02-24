// routes/institutions.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt"); // Needed for user creation
const Institution = require("../models/Institutions");
const { authorizeRoles, authenticateUser } = require("../middleware/auth"); 
const { verifyToken } = require("../middleware/verifyToken");
const { compressImage } = require("../handlers/imageCompressor");
const { uploadToFirebase } = require("../handlers/fileUploader");
const multer = require("multer");

// Configure Multer to hold files in memory for processing
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 1. Filter Sensitive Data
function filterInstitutionForClient(doc) {
    if (!doc) return null;
    const inst = doc.toObject ? doc.toObject() : { ...doc }; // Handle Mongoose Docs

    delete inst.masterPassword;
    delete inst.paymentGateway; // Hide API keys
    delete inst.smtp;           // Hide Email creds
    delete inst.dbName;         // Security: Don't show internal DB name
    delete inst.__v;
    delete inst.deleted;
    
    return inst;
}

// 2. Ownership & Permission Check
const checkOwnership = (reqUser, targetId) => {
    // 1. Master Admin allows all
    if (reqUser.isMasterAdmin) return true;
    
    // 2. Regular User/Admin must match the Institution ID
    if (reqUser.institutionId === targetId) return true;

    return false;
};

// GET /api/institutions/my-settings
router.get("/my-settings", authenticateUser, async (req, res) => {
    try {
        const institution = await Institution.findOne({ institutionId: req.user.institutionId })
            // ADDED NEW FIELDS TO SELECT: socialLinks, patientPortalSettings, compliance
            .select("institutionName institutionType loginPageImgUrl institutionLogoUrl institutionSymbolUrl favicon theme contact address billing outlets settings counters socialLinks patientPortalSettings compliance");
        
        if (!institution) return res.status(404).json({ message: "Institution not found." });
        res.json(institution);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/institutions/my-settings
router.put("/my-settings", authenticateUser, upload.fields([
    { name: 'institutionLogoUrl', maxCount: 1 },
    { name: 'loginPageImgUrl', maxCount: 1 },
    { name: 'institutionSymbolUrl', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]), async (req, res) => {
    try {
        const { 
            loginPageImgUrl, institutionLogoUrl, institutionSymbolUrl, favicon,
            theme, contact, address, billing, outlets, settings, counters,
            // NEW FIELDS:
            socialLinks, patientPortalSettings, compliance
        } = req.body;

        const updateData = {};
        const parseSafely = (val) => (typeof val === 'string' ? JSON.parse(val) : val);

        if (theme !== undefined) updateData.theme = parseSafely(theme);
        if (contact !== undefined) updateData.contact = parseSafely(contact);
        if (address !== undefined) updateData.address = parseSafely(address);
        if (billing !== undefined) updateData.billing = parseSafely(billing);
        if (outlets !== undefined) updateData.outlets = parseSafely(outlets);
        if (settings !== undefined) updateData.settings = parseSafely(settings);
        if (counters !== undefined) updateData.counters = parseSafely(counters);
        
        // NEW PARSERS
        if (socialLinks !== undefined) updateData.socialLinks = parseSafely(socialLinks);
        if (patientPortalSettings !== undefined) updateData.patientPortalSettings = parseSafely(patientPortalSettings);
        if (compliance !== undefined) updateData.compliance = parseSafely(compliance);

        // Map existing string URLs
        if (loginPageImgUrl !== undefined && !loginPageImgUrl.startsWith('blob:')) updateData.loginPageImgUrl = loginPageImgUrl;
        if (institutionLogoUrl !== undefined && !institutionLogoUrl.startsWith('blob:')) updateData.institutionLogoUrl = institutionLogoUrl;
        if (institutionSymbolUrl !== undefined && !institutionSymbolUrl.startsWith('blob:')) updateData.institutionSymbolUrl = institutionSymbolUrl;
        if (favicon !== undefined && !favicon.startsWith('blob:')) updateData.favicon = favicon;

        // Image Processing (Keep your existing file upload block here)
        if (req.files) {
            const processAndUploadFile = async (fieldName) => {
                if (req.files[fieldName] && req.files[fieldName][0]) {
                    const file = req.files[fieldName][0];
                    let buffer = file.buffer;
                    let mimetype = file.mimetype;
                    let extension = ''; 
                    if (mimetype.startsWith('image/') && mimetype !== 'image/svg+xml' && mimetype !== 'image/gif') {
                        const compressed = await compressImage(file.buffer);
                        buffer = compressed.buffer;
                        mimetype = compressed.mimetype;
                        extension = compressed.extension;
                    }
                    const downloadUrl = await uploadToFirebase(buffer, file.originalname, mimetype, extension, "institutions/branding");
                    updateData[fieldName] = downloadUrl;
                }
            };
            await processAndUploadFile('institutionLogoUrl');
            await processAndUploadFile('loginPageImgUrl');
            await processAndUploadFile('institutionSymbolUrl');
            await processAndUploadFile('favicon');
        }

        const updatedInstitution = await Institution.findOneAndUpdate(
            { institutionId: req.user.institutionId },
            { $set: updateData },
            { new: true, runValidators: true }
        ).select("institutionName institutionType loginPageImgUrl institutionLogoUrl institutionSymbolUrl favicon theme contact address billing outlets settings counters socialLinks patientPortalSettings compliance");

        if (!updatedInstitution) return res.status(404).json({ message: "Institution not found." });
        res.json(updatedInstitution);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/status", async (req, res) => {
    try {
        // req.institution is attached by the global middleware based on domain
        const institution = req.institution;

        if (!institution) {
            return res.status(404).json({ message: "Institution not found" });
        }

        // Return only status and basic identity
        res.json({
            institutionId: institution.institutionId,
            institutionName: institution.institutionName,
            status: institution.status, // true (Active) or false (Inactive)
            maintenance: institution.maintenance // Return maintenance info if you want to show a maintenance page
        });

    } catch (err) {
        console.error("Status Check Error:", err);
        res.status(500).json({ message: "Server error checking status" });
    }
});

router.get("/details", async (req, res) => {
    try {
        // req.institution is automatically attached by institutionMiddleware
        // based on the 'branddomain' header or 'domain' query param.
        const institution = req.institution;

        if (!institution) {
            return res.status(404).json({ message: "Institution not found for this domain." });
        }

        // Construct a safe, public-facing object
        // We DO NOT return dbName, secrets, or internal configs here.
        const publicData = {
            institutionId: institution.institutionId,
            institutionName: institution.institutionName,
            institutionCode: institution.institutionCode,
            
            // Branding & Visuals
            brandName: institution.brandName,
            brand: institution.brand,
            loginPageImgUrl: institution.loginPageImgUrl,
            institutionLogoUrl: institution.institutionLogoUrl,
            institutionSymbolUrl : institution.institutionSymbolUrl,
            favicon: institution.favicon,
            theme: institution.theme, // primaryColor, etc.

            // Public Contact Info
            contact: institution.contact,
            address: institution.address,
            
            // UI Toggles (So frontend knows what to hide/show)
            features: institution.features, 
            
            // Localization
            settings: {
                locale: institution.settings?.locale,
                timezone: institution.settings?.timezone,
                defaultLanguage: institution.settings?.defaultLanguage,
                queue: institution.settings?.queue // If needed for public token display
            },

            printTemplates: institution.printTemplates
        };

        res.json(publicData);

    } catch (err) {
        console.error("Public Details API Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.use(verifyToken);

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Check Access (Ownership)
        if (!checkOwnership(req.user, id)) {
            return res.status(403).json({ 
                message: "Forbidden: You can only view your own institution." 
            });
        }

        const institution = await Institution.findOne({ institutionId: id });

        if (!institution || institution.deleted) {
            return res.status(404).json({ message: "Institution not found" });
        }

        // 2. Return Filtered Data
        res.json({ 
            institution: filterInstitutionForClient(institution) 
        });

    } catch (err) {
        console.error("GET Institution Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});


router.put("/:id", authorizeRoles("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // 1. Check Access (Ownership)
        // Even if they are an 'admin', they must own this specific institution
        if (!checkOwnership(req.user, id)) {
            return res.status(403).json({ 
                message: "Forbidden: You cannot update another institution." 
            });
        }

        // 2. Prevent updating Immutable/Sensitive fields
        delete updateData.institutionId;   // ID cannot change
        delete updateData.institutionCode; // Code cannot change
        delete updateData.dbName;          // DB Mapping cannot change
        delete updateData._id;             // Mongo ID cannot change
        delete updateData.status;          // Status usually requires special permission (separate route)
        
        // Optional: If regular admins shouldn't change Subscription plans, delete that here too
        // if (!req.user.isMasterAdmin) delete updateData.subscriptionPlan;

        // 3. Perform Update
        const updatedInstitution = await Institution.findOneAndUpdate(
            { institutionId: id },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedInstitution) {
            return res.status(404).json({ message: "Institution not found" });
        }

        // 4. Return Filtered Data
        res.json({ 
            message: "Institution updated successfully", 
            institution: filterInstitutionForClient(updatedInstitution) 
        });

    } catch (err) {
        console.error("UPDATE Institution Error:", err);
        res.status(500).json({ message: "Failed to update: " + err.message });
    }
});


router.post("/users/:institutionId", authorizeRoles("admin"), async (req, res) => {
    try {
        const { institutionId } = req.params;
        const { name, username, email, phone, password } = req.body;

        // 1. Ownership Check
        if (!checkOwnership(req.user, institutionId)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const institution = await Institution.findOne({ institutionId });
        if (!institution) return res.status(404).json({ message: "Institution not found" });

        // 2. Switch to Tenant DB
        const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
        
        // 3. Check if User Model exists on this connection, implies Schema is loaded
        let TenantUser;
        try {
            TenantUser = tenantDb.model("User");
        } catch (e) {
            // If model not registered on this connection yet, register it
            const UserSchema = require("../models/User").schema; 
            TenantUser = tenantDb.model("User", UserSchema);
        }

        // 4. Check existing user
        const existing = await TenantUser.findOne({ $or: [{ email }, { username }] });
        if (existing) {
            return res.status(400).json({ message: "User with this email or username already exists" });
        }

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







module.exports = router;