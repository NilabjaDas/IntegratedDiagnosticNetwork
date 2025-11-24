const { getConnection } = require("../handlers/dbConnection");
const JWT = require("jsonwebtoken");

const propertiesMiddleware = () => async (req, res, next) => {
  const excludedRoutes = [
    "/api/secure-payment/payment-callback",
    "/api/saas-client",
    "/server/events",
    "/api/server/events/ping",
    "/server/events/ping",
    "/api/server/events",
    "/api/auth/encrypt",
    "/api/auth/scheduled-maintenance",
    "/api/institutions",
    "/api/admin-master/seed-base",
    "/api/admin-master",
  ];

  if (req.path.startsWith("/api/admin/rejected-document-view") || excludedRoutes.includes(req.path)) {
    return next();
  }

  const connection = getConnection();
  if (!connection) {
    return res.status(500).json({ message: "No database connection available" });
  }
  if (typeof connection.useDb !== "function") {
    console.error("The connection object does not have useDb method");
    return res.status(500).json({ message: "Improper connection object" });
  }

  let derivedDomain = null;
  let derivedBrand = null;
  let derivedHotelCode = null;

  try {
    const maybeToken =
      (req.query && req.query.token) ||
      (req.headers && (req.headers.authorization || req.headers.Authorization)) ||
      (req.cookies && req.cookies.accessToken) ||
      null;

    let rawToken = null;
    if (typeof maybeToken === "string") {
      rawToken = maybeToken.replace?.(/^Bearer\s+/i, "") ?? maybeToken;
    }

    if (rawToken) {
      try {
        const payload = JWT.verify(rawToken, process.env.JWT_SEC);
        if (payload && typeof payload === "object") {
          derivedDomain = payload.brandDomain || payload.domain || payload.brandDomainUrl || null;
          derivedBrand = payload.brand || payload.brandName || null;
          derivedHotelCode = payload.hotelCode || payload.hotelcode || payload.hotel_id || null;
        }
      } catch (jwtErr) {
        // token invalid or expired — do not block; fallback to headers
        // Keep a non-throwing behavior but log (optional)
        // console.warn("JWT verify failed in propertiesMiddleware:", jwtErr.message);
      }
    }
  } catch (err) {
    // unexpected error reading token - continue to fallback path
    console.error("Error reading token in propertiesMiddleware:", err.message || err);
  }

  const headerDomain = req.headers.domain || null;
  const domain = derivedDomain || headerDomain || null;

  try {
    const masterDB = connection.useDb("MASTER-PROPERTY-DATA");

    let clientData = null;

    if (domain) {
      clientData = await masterDB.collection("properties").findOne({ domain });
    }

    if (!clientData && derivedBrand) {
      clientData = await masterDB.collection("properties").findOne({ brand: new RegExp(`^${String(derivedBrand).trim()}$`, "i") });
    }

    if (!clientData && derivedHotelCode) {
      // Best-effort: attempt to locate property by guest_hub_details.hotelCode
      // This can be a bit heavier as it reads each property DB but used only when needed.
      const props = await masterDB.collection("properties").find({}).toArray();
      for (const p of props) {
        if (!p || !p.propertyId) continue;
        try {
          const tenantDb = connection.useDb(p.propertyId, { useCache: true });
          const GuestHub = tenantDb.model("guest_hub_details", require("../models/guestHubDetailsSchema") /* adjust path if needed */ , "guest_hub_details");
          // If the model doesn't exist or throws, use collection read as fallback
          let gh = null;
          try {
            gh = await GuestHub.findOne().lean().catch(() => null);
          } catch (e) {
            // fallback: try reading collection directly (some tenant dbs may not have the model)
            try {
              gh = await tenantDb.collection("guest_hub_details").findOne({}) || null;
            } catch (e2) {
              gh = null;
            }
          }
          const hotelCodeInGh = gh?.hotelCode ?? gh?.hotelcode ?? gh?.hotel_id ?? null;
          if (hotelCodeInGh && String(hotelCodeInGh) === String(derivedHotelCode)) {
            clientData = p;
            break;
          }
        } catch (err) {
          // ignore per-tenant read errors and continue
          // console.warn(`Error reading guest_hub_details for ${p.propertyId}:`, err.message || err);
        }
      }
    }

    if (!clientData) {
      return res.status(400).json({ message: "SaaS Client not found" });
    }

    req.clientData = clientData;
    req.propertyName = clientData.propertyName;
    req.propertyId = clientData.propertyId;
    req.propertyDB = connection.useDb(clientData.propertyId, { useCache: true });

    return next();
  } catch (error) {
    console.error("Error fetching SaaS Client ID:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = propertiesMiddleware;
