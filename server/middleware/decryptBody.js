// middlewares/decryptBody.js
const getRawBody = require("raw-body");
const CryptoJS = require("crypto-js");

const PASS_KEY = process.env.PASS_SEC;
const AES_KEY = process.env.AES_SEC;
const decryptBody = async (req, res, next) => {
  // 0) skip GET requests entirely
  if (req.method === "GET") {
    return next();
  }

  // Skip non‑ciphertext
  if (!req.is("text/plain")) {
    const url = req.originalUrl.toLowerCase();
    if (
      url.includes("/server/events/ping") ||
      url.endsWith("/scheduled-maintenance") ||
      url.endsWith("/encrypt") ||
      url.endsWith("/institutions") ||
      url.endsWith("/authenticate/login-staff") || 
      url.endsWith("/admin-master/seed-base") ||
      url.endsWith("/admin-master") ||
      url.endsWith("/admin-master/login") || 
      url.endsWith("/test-api") ||
      url.includes("/admin-master/institutions/delete") ||
      url.includes("/admin-master")
    ) {
      return next();
    } else {
      return res.status(403).json({
        error:
          "Unauthorized access detected. Your IP has been logged for legal review. Cease all activity immediately.",
      });
    }
  }

  try {
    const cipherText = await getRawBody(req, { encoding: "utf8" });
    if (!cipherText) return next();
    // 1) pick key based on endpoint
    //    adjust these paths if your router is mounted elsewhere
    const url = req.originalUrl.toLowerCase();
    const usePassKey =
      url.endsWith("/authenticate/login-super-admin") ||
      url.endsWith("/brand-admin-login");

    const key = usePassKey ? PASS_KEY : AES_KEY;
    // 2) decrypt
    const plain = CryptoJS.AES.decrypt(cipherText, key).toString(
      CryptoJS.enc.Utf8
    );

    // 3) parse JSON
    req.body = JSON.parse(plain);
    next();
  } catch (err) {
    console.error("decryptBody error:", req.originalUrl, req.propertyId, err);
    return res.status(400).json({ message: "Invalid encrypted payload" });
  }
};

module.exports = decryptBody;
