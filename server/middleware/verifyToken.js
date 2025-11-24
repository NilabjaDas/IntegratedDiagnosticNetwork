const jwt = require("jsonwebtoken");
const CryptoJS = require("crypto-js");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.token;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWT_SEC, (err, jwtData) => {
      if (err) {
        return res.status(403).json("Token is not valid");
      }

      // Attach the decoded token data to the req object
      req.user = jwtData;
      next();
    });
  } else {
    return res.status(401).json("You are not authenticated!");
  }
};

const verifyTokenGuestHubAccess = (req, res, next) => {
  verifyToken(req, res, () => {
    // Check for guestHubAccess in the decoded token data
    if (req.user && req.user.guestHubAccess || req.user && req.user.adminAccess) {
      next();
    } else {
      res.status(403).json("You are not allowed to do that!");
    }
  });
};

const verifyTokenAdminAccess = (req, res, next) => {
  verifyToken(req, res, () => {
    // Check for guestHubAccess in the decoded token data
    if (req.user && req.user.adminAccess) {
      next();
    } else {
      res.status(403).json("You are not allowed to do that!");
    }
  });
};

const verifyMasterToken = (req, res, next) => {
  verifyToken(req, res, () => {
    // Check for guestHubAccess in the decoded token data
    if ( req.user && req.user.masterAdmin) {
      next();
    } else {
      res.status(403).json("You are not an authenticated user!");
    }
  });
};

const verifyBrandUserToken = (req, res, next) => {
  verifyToken(req, res, () => {
    // Check for guestHubAccess in the decoded token data
    if ( req.user && req.user.domainAdminAccess && req.user.status) {
      next();
    } else {
      res.status(403).json("You are not an authenticated user!");
    }
  });
};


module.exports = {
  verifyToken,
  verifyTokenGuestHubAccess,
  verifyTokenAdminAccess,
  verifyMasterToken,
  verifyBrandUserToken
};
