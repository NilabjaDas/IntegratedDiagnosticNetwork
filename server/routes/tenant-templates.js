const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { verifyToken } = require("../middleware/verifyToken");
const Institution = require("../models/Institutions");
const BaseTemplate = require("../models/BaseTemplate");
const { v4: uuidv4 } = require("uuid");

// --- Middleware: Verify Tenant Access ---
// Ensures the user belongs to an institution
const getTenantContext = async (req, res, next) => {
    try {
        const institutionId = req.user.institutionId;
        if (!institutionId) {
            return res.status(403).json({ message: "No institution linked to user." });
        }

        // We need to query the MASTER DB Institution collection to update it
        // The Institution model is already connected to the default connection (Master)
        const institution = await Institution.findOne({ institutionId });

        if (!institution) {
            return res.status(404).json({ message: "Institution not found." });
        }

        req.institution = institution;
        next();
    } catch (err) {
        console.error("Tenant Context Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

router.use(verifyToken, getTenantContext);

/**
 * @route   GET /api/tenant-templates/library
 * @desc    Fetch all available Base Templates from the Global Library
 */
router.get("/library", async (req, res) => {
    try {
        const { type, search } = req.query;
        let query = { isActive: true };

        if (type) query.type = type;
        if (search) query.$text = { $search: search };

        const templates = await BaseTemplate.find(query).sort({ category: 1, name: 1 });

        res.json({ data: templates });
    } catch (err) {
        console.error("Fetch Library Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/tenant-templates/import
 * @desc    Import a Global Template into the Institution's Local Config
 */
router.post("/import", async (req, res) => {
    try {
        const { baseTemplateId, variableValues } = req.body;
        // variableValues: { "HELPLINE": "12345", "FOOTER_TEXT": "Thank you" }

        if (!baseTemplateId) {
            return res.status(400).json({ message: "Template ID is required." });
        }

        const baseTemplate = await BaseTemplate.findById(baseTemplateId);
        if (!baseTemplate) {
            return res.status(404).json({ message: "Base Template not found." });
        }

        // --- Process Content: Inject Static Variables ---
        let processedContent = JSON.parse(JSON.stringify(baseTemplate.content)); // Deep copy

        // Helper to replace placeholders in a string
        const replacePlaceholders = (str) => {
            if (!str) return str;
            let newStr = str;
            if (variableValues) {
                Object.keys(variableValues).forEach(key => {
                    const placeholder = `{{${key}}}`;
                    // Replace all occurrences
                    newStr = newStr.split(placeholder).join(variableValues[key]);
                });
            }
            return newStr;
        };

        // 1. Process HTML Fields
        processedContent.headerHtml = replacePlaceholders(processedContent.headerHtml);
        processedContent.footerHtml = replacePlaceholders(processedContent.footerHtml);

        // 2. Process Custom Elements (if they contain text/variables)
        if (processedContent.customElements && Array.isArray(processedContent.customElements)) {
            processedContent.customElements = processedContent.customElements.map(el => {
                if (el.content && typeof el.content === 'string') {
                    el.content = replacePlaceholders(el.content);
                }
                return el;
            });
        }

        // --- Construct Local Template Object ---
        const newLocalTemplate = {
            templateId: uuidv4(),
            name: `${baseTemplate.name} (Imported)`,
            type: baseTemplate.type,
            isDefault: false, // User can set default later
            pageSize: baseTemplate.pageSize,
            orientation: baseTemplate.orientation,
            margins: baseTemplate.margins,
            content: processedContent
        };

        // --- Save to Institution ---
        req.institution.printTemplates.push(newLocalTemplate);
        await req.institution.save();

        res.status(201).json({
            message: "Template imported successfully.",
            data: newLocalTemplate
        });

    } catch (err) {
        console.error("Import Template Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;
