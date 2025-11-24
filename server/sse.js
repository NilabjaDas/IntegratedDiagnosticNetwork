// sse.js
const { encryptResponse } = require("./middleware/encryptResponse");
const router = require("express").Router();
const sseManager = require("./sseManager");
const jwt = require("jsonwebtoken");

function normalizeToken(raw) {
  if (!raw) return null;
  return raw.includes(" ") ? raw.split(" ")[1] : raw;
}

router.get(
  "/events",
  encryptResponse,
  async (req, res) => {
    const rawToken = req.query?.token;
    const token = normalizeToken(rawToken);

    // quick reject if no token
    if (!token) {
      // plain 401 (don't open SSE stream)
      return res.status(401).json({ error: "Missing token" });
    }

    // verify token before opening SSE; this avoids registering a response
    // that other code might try to write to after we've already ended it.
    try {
      jwt.verify(token, process.env.JWT_SEC);
    } catch (err) {
      if (err && err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired" });
      }
      return res.status(401).json({ error: "Invalid token" });
    }

    // Token ok — set SSE headers and keep connection open
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Content-Encoding", "none");
    res.flushHeaders();

    // Register response so sseManager.addClient can find it.
    if (!sseManager.registerResponse(res, token)) {
      if (!res.writableEnded) res.status(500).json({ error: "Failed to register SSE response" });
      return;
    }

    // Create client in manager (manager will send the initial connected event)
    const clientId = sseManager.addClient(token);
    if (!clientId) {
      // safe write SSE-style error and close if possible
      try {
        if (!res.writableEnded) {
          res.write(
            `event: error\ndata: ${JSON.stringify({ message: "Unauthorized" })}\n\n`
          );
        }
      } catch (_) {}
      try { if (!res.writableEnded) res.end(); } catch (_) {}
      return;
    }

    // cleanup helper
    const cleanup = () => {
      try { sseManager.removeClient(clientId); } catch (_) {}
    };

    // Attach cleanup listeners AFTER client is successfully added
    req.on("close", () => {
      console.log("Client req close from SSE endpoint.");
      cleanup();
    });
    req.on("aborted", () => {
      console.log("Client aborted from SSE endpoint.");
      cleanup();
    });
    res.on("close", () => {
      console.log("Client close from SSE endpoint.");
      cleanup();
    });
    res.on("finish", () => {
      console.log("Client finish from SSE endpoint.");
      cleanup();
    });
    res.on("error", (err) => {
      console.log("Client error from SSE endpoint.", err);
      cleanup();
    });
  }
);

module.exports = router;
