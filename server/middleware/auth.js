const jwt = require("jsonwebtoken");

// --- MIDDLEWARE: Super Admin Auth Check ---
const requireSuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.token;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SEC);

    if (decoded.role !== "super_admin") {
      return res.status(403).json({ message: "Not authorized as Super Admin" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.log(err)
    return res.status(401).json({ message: "Invalid token" });
  }
};

/**
 * Middleware: authenticateUser
 * 1. Verifies the JWT Token.
 * 2. Decodes user info (ID, Role, Institution).
 * 3. MASTER ADMIN LOGIC: Allows switching context to any institution via header.
 */
const authenticateUser = async (req, res, next) => {
  try {
    // 1. Check for Token
    const authHeader = req.headers.token;
    if (!authHeader) {
      return res.status(401).json({ message: "Access Denied. No token provided." });
    }

    // 2. Verify Token
    // Format: "Bearer <token>"
    const token = authHeader.replace("Bearer ", "");
    
    if (!process.env.JWT_SEC) {
      console.error("CRITICAL: JWT_SEC is not defined.");
      return res.status(500).json({ message: "Internal Server Error" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SEC);

    // 3. Attach User to Request
    req.user = decoded; 
    // decoded contains: { id, userId, role, institutionId, isMasterAdmin, iat, exp }

    // =================================================================
    // 👑 MASTER ADMIN "GOD MODE" LOGIC
    // =================================================================
    // If the logged-in user is a Master Admin (isMasterAdmin: true),
    // they can optionally specify which Institution they want to view
    // using the 'x-target-institution' header.
    //
    // If provided, we overwrite req.user.institutionId with the target.
    // This allows existing Controllers (Orders, Patients) to work transparently
    // because they always query based on req.user.institutionId.
    // =================================================================
    
    if (decoded.isMasterAdmin) {
        const targetInstitutionId = req.header("x-target-institution");
        
        if (targetInstitutionId) {
            req.user.institutionId = targetInstitutionId; // Impersonate specific clinic
            console.log(`👑 Master Admin [${decoded.userId}] accessing Institution: [${targetInstitutionId}]`);
        } else {
            // If no header provided, they remain in "Global" context (or their own default)
            // Some controllers might handle "GLOBAL" differently if needed.
        }
    }

    next();
  } catch (err) {
    console.error("Auth Error:", err.message);
    res.status(401).json({ message: "Invalid or expired authentication token." });
  }
};

/**
 * Middleware: authorizeRoles
 * Restricts access to specific user roles.
 * Usage: router.get("/", authenticateUser, authorizeRoles("admin", "doctor"), controller)
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // 1. Master Admin Bypass
    // Always allow Master Admin, regardless of the route's required role
    if (req.user.isMasterAdmin) {
      return next();
    }

    // 2. Check Role
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Forbidden: You do not have permission to access this resource. Required: ${allowedRoles.join(", ")}` 
      });
    }

    next();
  };
};

module.exports = { authenticateUser, authorizeRoles,requireSuperAdmin };