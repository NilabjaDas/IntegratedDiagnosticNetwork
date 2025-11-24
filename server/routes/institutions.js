// routes/institutions.js
const express = require("express");
const router = express.Router();
const Institution = require("../models/Institutions");
const { v4: uuidv4 } = require("uuid");

// Helper: remove sensitive keys before sending to client
function filterInstitutionForClient(doc) {
  if (!doc) return null;
  // operate on a shallow clone
  const inst = { ...doc };

  // delete common sensitive top-level fields
  delete inst.masterPassword;
  delete inst.paymentGateway;
  delete inst.smtp;
  delete inst.__v;
  delete inst.deleted;

  // remove any other fields you don't want exposed
  // leave createdAt/updatedAt if you want; remove them if not
  // delete inst.createdAt;
  // delete inst.updatedAt;

  return inst;
}


router.post("/", async (req, res) => {

  try {
    const payload = req.body || {};

    if (!payload.primaryDomain) {
      return res.status(400).json({ message: "primaryDomain is required" });
    }
    if (!payload.institutionName) {
      return res.status(400).json({ message: "institutionName is required" });
    }

    const domain = String(payload.primaryDomain).toLowerCase().trim();
    const loc = payload.location;
    if (loc) {
    if (loc.type !== "Point") {
        return res.status(400).json({ message: "location.type must be 'Point' if provided" });
    }
    if (!Array.isArray(loc.coordinates) || loc.coordinates.length !== 2) {
        return res.status(400).json({ message: "location.coordinates must be an array: [lng, lat]" });
    }
    // optionally ensure numbers
    if (!loc.coordinates.every(Number.isFinite)) {
        return res.status(400).json({ message: "location.coordinates must contain valid numbers" });
    }
    }

    // Check duplicate by primaryDomain or in domains array
    const existing = await Institution.findOne({
      $or: [
        { primaryDomain: domain },
        { domains: domain }
      ]
    }).lean();

    if (existing) {
      return res.status(409).json({ message: "Institution with this domain already exists" });
    }

    // create object with defaults
    const newInst = new Institution({
      institutionId: payload.institutionId || uuidv4(),
      primaryDomain: domain,
      domains: payload.domains || [],
      institutionName: payload.institutionName,
      brand: payload.brand,
      brandName: payload.brandName,
      loginPageImgUrl: payload.loginPageImgUrl,
      institutionLogoUrl: payload.institutionLogoUrl,
      favicon: payload.favicon,
      status: payload.status !== undefined ? !!payload.status : true,
      contact: payload.contact || {},
      address: payload.address || {},
      billing: payload.billing || {},
      outlets: payload.outlets || [],
      integrations: payload.integrations || {},
      features: payload.features || {},
      settings: payload.settings || {},
      plan: payload.plan || {},
      maintenance: payload.maintenance || {},
      createdBy: req.user ? req.user.id : payload.createdBy // if auth middleware sets req.user
    });

    if (loc) {
    newInst.location = {
        type: "Point",
        coordinates: [ Number(loc.coordinates[0]), Number(loc.coordinates[1]) ]
    };
    }
    if (payload.masterPassword) {
      newInst.masterPassword = payload.masterPassword;
    }

    const saved = await newInst.save();
    const savedObj = saved.toObject();
    const filtered = filterInstitutionForClient(savedObj);

    return res.status(201).json({ message: "Institution created", data: filtered });
  } catch (err) {
    console.error("Error creating institution:", err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});


router.get("/", async (req, res) => {
  const domainFromHeader = req.headers.domain;
  const domainFromQuery = req.query.domain;
  const domain = (domainFromHeader || domainFromQuery || "").toString().toLowerCase().trim();

  if (!domain) {
    return res.status(400).json({ message: "Missing domain in header or query param" });
  }

  try {
    // find by primaryDomain OR domains array
    const inst = await Institution.findOne({
      $or: [
        { primaryDomain: domain },
        { domains: domain }
      ]
    }).lean();

    if (!inst) {
      return res.status(404).json({ message: "No institution found for the specified domain" });
    }

    // Filter out sensitive fields and return
    const filtered = filterInstitutionForClient(inst);

    return res.status(200).json(filtered);
  } catch (error) {
    console.error("Error fetching institution:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

module.exports = router;
