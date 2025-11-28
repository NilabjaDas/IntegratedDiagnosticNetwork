// server/middleware/institutionMiddleware.js
const mongoose = require("mongoose");
const Institution = require("../models/Institutions");
const getModel = require("./getModelsHandler");

const institutionMiddleware = () => {
  return async (req, res, next) => {
    // 1. Identify the domain
    // FIX: Check req.query.domain first (for SSE/EventSource support)
    const rawDomain = req.query.domain || req.headers["branddomain"] || req.headers.host;
    
    // Clean up port if present
    const domain = rawDomain.split(":")[0].toLowerCase();

    // 2. EXCEPTION: Super Admin Bypass
    if (domain === "super-admin" || domain.startsWith("super-admin.")) {
      return next();
    }

    try {
      const institution = await Institution.findOne({ 
        domains: domain 
      });

      if (!institution) {
        return res.status(404).json({ message: `Institution not found for domain: ${domain}` });
      }

      req.institution = institution;
      req.institutionId = institution.institutionId;

      const tenantDbName = institution.dbName;
      const tenantDb = mongoose.connection.useDb(tenantDbName, { useCache: true });
      
      req.db = tenantDb;

      next();
    } catch (err) {
      console.error("Institution Middleware Error:", err);
      return res.status(500).json({ message: "Internal Server Error during tenant resolution." });
    }
  };
};

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

module.exports = {institutionMiddleware, getTenantUserModel};
