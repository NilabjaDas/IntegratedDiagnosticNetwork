const { getConnection } = require("../handlers/dbConnection");
const Institution = require("../models/Institutions");

/**
 * Middleware to resolve Institution DB based on Subdomain or Header
 */
const institutionMiddleware = () => async (req, res, next) => {
  const masterConnection = getConnection();
  if (!masterConnection) {
    return res.status(500).json({ message: "Database connection not available" });
  }

  // 1. Identify context
  // Subdomain is primary for production (e.g., clinic.site.com)
  // Headers are for dev/testing (x-institution-code)
  const host = req.headers.host || "";
  const subdomain = host.split(".")[0];
  const headerCode = req.headers["x-institution-code"]; // Code for dev
  const headerDomain = req.headers["x-institution-domain"]; // Domain override for dev

  // Exclude global routes (Super Admin, Consumer App, Webhooks)
  const globalPrefixes = [
    "/api/authenticate/login-super-admin",
    "/api/authenticate/connect",
    "/api/authenticate/ping",
    "/api/admin-master", // Super Admin
    "/api/consumer",     // Consumer App
    "/api/server",       // Server checks
    "/api/auth/otp",     // Global OTP
  ];

  if (globalPrefixes.some(prefix => req.path.startsWith(prefix))) {
    // Explicitly set context to Master DB for these routes
    req.db = masterConnection.useDb("MASTER-INSTITUTION-DATA");
    req.isGlobal = true;
    return next();
  }

  // 2. Resolve Institution
  let institution = null;
  const masterDb = masterConnection.useDb("MASTER-INSTITUTION-DATA");
  const InstitutionModel = masterDb.model("Institution", require("../models/Institutions").schema);

  try {
    if (headerCode) {
      institution = await InstitutionModel.findOne({ institutionCode: headerCode });
    } else if (headerDomain) {
       institution = await InstitutionModel.findOne({ primaryDomain: headerDomain });
    } else if (subdomain && subdomain !== "www" && subdomain !== "localhost") {
       // Assuming subdomain matches the start of primaryDomain or is mapped
       // We can search where primaryDomain starts with subdomain or exact match if you store full domain
       // Logic: user said "someName.site.com", server checks "someName"
       // We'll search for primaryDomain that *contains* this subdomain or matches exactly if stored as subdomain
       // Ideally we store "clinic.site.com" in primaryDomain.
       // So we search { primaryDomain: new RegExp(`^${subdomain}\\.`, 'i') } or just match the subdomain field if we added one.
       // Let's assume primaryDomain stores the FULL domain.

       institution = await InstitutionModel.findOne({
          $or: [
             { primaryDomain: new RegExp(`^${subdomain}\\.`, "i") },
             { domains: subdomain } // If we store just "clinic" in domains
          ]
       });
    }

    if (!institution) {
      // If no institution found, but we are not in a global route,
      // it might be a request to the main landing page (Consumer) but hitting a generic API?
      // For now, return 404 or Unauthorized.
      return res.status(404).json({ message: "Institution not found" });
    }

    // 3. Switch Database
    req.institutionId = institution.institutionId;
    req.institution = institution;

    // CACHE CONNECTION: Mongoose useDb with { useCache: true } reuses connections
    req.db = masterConnection.useDb(institution.dbName, { useCache: true });

    // Attach models helper if needed, or just let controllers use req.db.model(...)
    req.getInstitutionModel = (modelName, schema) => {
        return req.db.model(modelName, schema);
    };

    next();

  } catch (error) {
    console.error("Institution Middleware Error:", error);
    res.status(500).json({ message: "Internal Server Error resolving institution" });
  }
};

module.exports = institutionMiddleware;
