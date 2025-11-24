const jwt = require('jsonwebtoken');
const redis = require('redis');

const clients = [];
const responseMap = new Map();

const PING_INTERVAL_MS = 60000;
const STALE_TTL_MS = 600000;
let pingIntervalHandle = null;

const publisher = redis.createClient();
const subscriber = redis.createClient();

function logGroupedUsernames() {
  const grouped = (clients || []).reduce((acc, c) => {
    const brand = c?.brand ?? "unknown";
    const name = c?.username;
    if (!name) return acc;
    (acc[brand] = acc[brand] || []).push(name);
    return acc;
  }, {});
  console.log("Clients connected - ", clients.length);
  Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b))
    .forEach(brand => {
      const users = grouped[brand].sort((x, y) => x.localeCompare(y)).join(", ");
      console.log(`Usernames - ${brand}: ${users}`);
    });
}

(async () => {
  try {
    await publisher.connect();
    await subscriber.connect();
    startPinger();
    console.log('Redis clients connected.');
  } catch (err) {
    console.error('Redis connection error:', err);
  }
})();

subscriber.on('error', err => console.error('Redis Subscriber Error:', err));
publisher.on('error', err => console.error('Redis Publisher Error:', err));

subscriber.subscribe('sse-broadcast', (message) => {
  try {
    const parsed = JSON.parse(message);
    const { data, eventName, id, targets, brand } = parsed;
    broadcastLocal(data, eventName, id, targets, brand);
  } catch (err) {
    console.error('Failed to parse Redis message:', err);
  }
});

function normalizeToken(token) {
  if (!token) return null;
  return token.includes(' ') ? token.split(' ')[1] : token;
}

/**
 * Register a response for a token. If a previous response exists for the token,
 * try to end it before replacing (avoids leaked responses).
 */
function registerResponse(res, token) {
  const t = normalizeToken(token);
  if (!t || !res) return false;

  // if there is an existing response for this token and it's different, close it
  if (responseMap.has(t)) {
    const old = responseMap.get(t);
    if (old !== res) {
      try { if (!old.writableEnded && !old.destroyed) old.end(); } catch (_) {}
    }
  }

  responseMap.set(t, res);
  return true;
}

/**
 * Safely write to the client's response. If response is already ended/destroyed,
 * remove the client and return false.
 */
function safeWrite(client, payload) {
  try {
    const res = client?.res;
    if (!res) {
      removeClient(client.id);
      return false;
    }

    // defensive checks: don't write if already ended/destroyed
    if (res.writableEnded || res.destroyed || res.writableFinished) {
      try { removeClient(client.id); } catch (e) {}
      return false;
    }

    res.write(payload);
    if (typeof res.flush === 'function') res.flush();
    client.lastSeen = Date.now();
    return true;
  } catch (err) {
    // if write fails, remove client and return false
    try { removeClient(client.id); } catch (e) {}
    return false;
  }
}

function addClient(token) {
  const tokenStr = normalizeToken(token);
  if (!tokenStr) {
    console.error('addClient: missing token');
    return null;
  }

  const res = responseMap.get(tokenStr);
  if (!res) {
    console.error('addClient: no registered response for token');
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(tokenStr, process.env.JWT_SEC);
  } catch (err) {
    // more explicit handling: expired vs other jwt issues
    console.error('addClient: jwt verify failed:', err && err.name ? err.name : err);

    // remove the pending response mapping so it won't be used again
    responseMap.delete(tokenStr);

    // only write/end if the response is still writable
    try {
      if (!res.writableEnded && !res.destroyed) {
        // ensure we have appropriate SSE headers if they weren't set yet
        if (!res.headersSent) {
          try {
            res.writeHead(401, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            });
          } catch (_) {}
        }
        const msg = err && err.name === 'TokenExpiredError'
          ? { message: 'Token expired' }
          : { message: 'Invalid token' };
        try {
          res.write(`event: error\ndata: ${JSON.stringify(msg)}\n\n`);
        } catch (_) {}
        try { res.end(); } catch (_) {}
      }
    } catch (_) {}
    return null;
  }

  const brand = decoded?.brand ?? null;
  const username = decoded?.username ?? null;
  const modules = Array.isArray(decoded?.modules) ? decoded.modules : [];
  const properties = Array.isArray(decoded?.properties) ? decoded.properties : [];

  const uid = decoded && (decoded.id || decoded._id || username) || `anon-${Date.now()}`;
  const clientId = `${uid}-${Date.now()}`;
  const now = Date.now();
  const client = { id: clientId, res, token: tokenStr, brand, username, modules, properties, lastSeen: now };
  clients.push(client);
  responseMap.delete(tokenStr);

  try {
    const initial = { message: 'connected', brand, username, properties };
    logGroupedUsernames();
    safeWrite(client, `event: connected\ndata: ${JSON.stringify(initial)}\n\n`);
  } catch (err) {
    console.warn('addClient: failed to send initial event:', err);
  }

  res.on('close', () => {
    const i = clients.findIndex(c => c.res === res);
    if (i !== -1) {
      const rem = clients.splice(i, 1)[0];
      try { if (!rem.res.finished && !rem.res.destroyed) rem.res.end(); } catch (_) {}
    }
  });

  return clientId;
}

function removeClient(resOrIdOrToken) {
  const normToken = typeof resOrIdOrToken === 'string' ? normalizeToken(resOrIdOrToken) : null;
  const idx = clients.findIndex(c =>
    c.res === resOrIdOrToken || c.id === resOrIdOrToken || (normToken && c.token === normToken)
  );

  if (idx !== -1) {
    const removed = clients.splice(idx, 1)[0];
    try { if (!removed.res.finished && !removed.res.destroyed) removed.res.end(); } catch (_) {}
    return true;
  }

  if (normToken && responseMap.has(normToken)) {
    const r = responseMap.get(normToken);
    responseMap.delete(normToken);
    try { if (!r.finished && !r.destroyed) r.end(); } catch (_) {}
    return true;
  }
  logGroupedUsernames();
  return false;
}

function broadcastLocal(data, eventName = 'message', id, targets = null, brand = null) {
  let payload = '';
  if (eventName) payload += `event: ${eventName}\n`;
  if (id) payload += `id: ${id}\n`;
  payload += `data: ${JSON.stringify(data)}\n\n`;

  const targetSet = Array.isArray(targets) && targets.length ? new Set(targets) : null;

  clients.slice().forEach(client => {
    try {
      if (targetSet) {
        if (!targetSet.has(client.id)) return;
      } else if (brand) {
        if (String(client.brand) !== String(brand)) return;
      }
      safeWrite(client, payload);
    } catch (err) {}
  });
}

async function publishEvent(data, eventName = 'message', id = undefined, targets = undefined, brand = undefined) {
  const message = JSON.stringify({ data, eventName, id, targets, brand });
  try {
    if (!publisher.isOpen) await publisher.connect();
    await publisher.publish('sse-broadcast', message);
  } catch (err) {
    console.error('publishEvent error:', err);
  }
}

function sendToClient(clientId, data, eventName = 'message', id = undefined) {
  return publishEvent(data, eventName, id, [clientId], undefined);
}

function sendToBrand(brand, data, eventName = 'message', id = undefined) {
  return publishEvent(data, eventName, id, undefined, brand);
}

function broadcastEvent(data, eventName = 'message', id) {
  publishEvent(data, eventName, id);
}

function getClients() {
  return clients;
}

function startPinger() {
  if (pingIntervalHandle) return;
  pingIntervalHandle = setInterval(() => {
    const now = Date.now();
    clients.slice().forEach(client => {
      if (client.lastSeen && (now - client.lastSeen) > STALE_TTL_MS) {
        removeClient(client.id);
        return;
      }
      try {
        // Send SSE comment heartbeat (won't create 'message' event on client)
        safeWrite(client, ':\n\n');
      } catch (e) {
        removeClient(client.id);
      }
    });
  }, PING_INTERVAL_MS);
}

function stopPinger() {
  if (pingIntervalHandle) {
    clearInterval(pingIntervalHandle);
    pingIntervalHandle = null;
  }
}

module.exports = {
  registerResponse,
  addClient,
  removeClient,
  broadcastEvent,
  sendToClient,
  sendToBrand,
  getClients,
  stopPinger
};
