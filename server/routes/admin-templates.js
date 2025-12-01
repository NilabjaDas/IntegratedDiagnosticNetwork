const express = require("express");
const router = express.Router();
const BaseTemplate = require("../models/BaseTemplate");
const { requireSuperAdmin } = require("../middleware/auth");

/**
 * @route   GET /api/admin-templates
 * @desc    Get All Base Templates (Search & Pagination)
 * @access  Super Admin Only
 */
router.get("/", requireSuperAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || "";
        const type = req.query.type;

        const skip = (page - 1) * limit;
        let query = {};

        if (search) {
            query.$text = { $search: search };
        }

        if (type) {
            query.type = type;
        }

        const templates = await BaseTemplate.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await BaseTemplate.countDocuments(query);

        res.json({
            data: templates,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error("Get Templates Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/admin-templates/:id
 * @desc    Get Single Template
 */
router.get("/:id", requireSuperAdmin, async (req, res) => {
    try {
        const template = await BaseTemplate.findById(req.params.id);
        if (!template) return res.status(404).json({ message: "Template not found" });
        res.json({ data: template });
    } catch (err) {
        res.status(500).json({ message: "Error fetching template" });
    }
});

/**
 * @route   POST /api/admin-templates
 * @desc    Create a new Base Template
 */
router.post("/", requireSuperAdmin, async (req, res) => {
    try {
        const {
            name, description, category, type,
            pageSize, orientation, margins,
            content, variables, previewImage
        } = req.body;

        if (!name || !type) {
            return res.status(400).json({ message: "Name and Type are required." });
        }

        const newTemplate = new BaseTemplate({
            name,
            description,
            category: category || "General",
            type,
            pageSize,
            orientation,
            margins,
            content,
            variables,
            previewImage,
            createdBy: req.user.username
        });

        await newTemplate.save();
        res.status(201).json({ message: "Template created successfully", data: newTemplate });

    } catch (err) {
        console.error("Create Template Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @route   PUT /api/admin-templates/:id
 * @desc    Update a Base Template
 */
router.put("/:id", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updatedTemplate = await BaseTemplate.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedTemplate) {
            return res.status(404).json({ message: "Template not found." });
        }

        res.json({ message: "Template updated successfully", data: updatedTemplate });

    } catch (err) {
        console.error("Update Template Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

/**
 * @route   DELETE /api/admin-templates/:id
 * @desc    Delete a Base Template
 */
router.delete("/:id", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await BaseTemplate.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ message: "Template not found." });
        }

        res.json({ message: "Template deleted successfully" });

    } catch (err) {
        console.error("Delete Template Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;
