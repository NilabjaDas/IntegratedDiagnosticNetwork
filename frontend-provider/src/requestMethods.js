// src/utils/axios.js
import axios from "axios";
import CryptoJS from "crypto-js";
import { store } from "./redux/store";

/* -------------------------
   Domain / baseURL helpers
   ------------------------- */
// Get the protocol (e.g., "https:")
const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
// Get hostname and remove admin. prefix if present
const hostname = typeof window !== "undefined" ? window.location.hostname : "saltstayz.ai";
const mainDomain = hostname.startsWith("admin.") ? hostname.slice(6) : hostname;
const finalUrl = `${protocol}//${mainDomain}`;

export const BASE_URL = "/";
// export const BASE_URL = process.env.REACT_APP_BASE_URL;

export const currentDomain = "wakilslab.com"

/* -------------------------
   Create axios instances
   ------------------------- */
export const publicRequest = axios.create({
  baseURL: BASE_URL,
  headers: { brandDomain: currentDomain },
});

export const userRequest = axios.create({
  baseURL: BASE_URL,
  headers: { brandDomain: currentDomain },
});

export const adminRequest = axios.create({
  baseURL: BASE_URL,
  headers: { brandDomain: currentDomain },
});

/* -------------------------
   Auth token helpers
   ------------------------- */
const ACCESS_KEY = process.env.REACT_APP_ACCESS_TOKEN_KEY || "access"; // safe fallback

const getTokensFromStore = () => {
  const s = store.getState();
  const keySlice = s?.[ACCESS_KEY] || {};
  return {
    token: keySlice?.token || "",
    masterToken: keySlice?.masterToken || "",
    key: keySlice?.key || process.env.REACT_APP_PASS_SEC || "",
  };
};

/* — AES key (same on client & server) — */
const getKey = () => getTokensFromStore().key;

/* — helpers — */
const encrypt = (obj) => {
  // only encrypt if there's something to encrypt
  if (obj === undefined || obj === null) return obj;
  try {
    return CryptoJS.AES.encrypt(JSON.stringify(obj), getKey()).toString();
  } catch (e) {
    // if encryption fails, return original (fail-safe)
    return obj;
  }
};

const decrypt = (data) => {
  if (!data) return data;
  try {
    const bytes = CryptoJS.AES.decrypt(data, getKey());
    const text = bytes.toString(CryptoJS.enc.Utf8);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (e) {
    return data;
  }
};

/* -------------------------
   Dynamic token interceptors
   ------------------------- */
/*
  These interceptors read the latest tokens from the Redux store at request time.
  We keep references so we can re-eject/recreate them when the store changes.
*/
let userTokenInterceptor = userRequest.interceptors.request.use(
  (cfg) => {
    const { token } = getTokensFromStore();
    if (token) cfg.headers.token = `Bearer ${token}`;
    return cfg;
  },
  (err) => Promise.reject(err)
);

let adminTokenInterceptor = adminRequest.interceptors.request.use(
  (cfg) => {
    const { masterToken } = getTokensFromStore();
    if (masterToken) cfg.headers.token = `Bearer ${masterToken}`;
    return cfg;
  },
  (err) => Promise.reject(err)
);

// Update token interceptors on store change so they always use latest tokens
store.subscribe(() => {
  try {
    userRequest.interceptors.request.eject(userTokenInterceptor);
  } catch (e) {}
  userTokenInterceptor = userRequest.interceptors.request.use(
    (cfg) => {
      const { token } = getTokensFromStore();
      if (token) cfg.headers.token = `Bearer ${token}`;
      return cfg;
    },
    (err) => Promise.reject(err)
  );

  try {
    adminRequest.interceptors.request.eject(adminTokenInterceptor);
  } catch (e) {}
  adminTokenInterceptor = adminRequest.interceptors.request.use(
    (cfg) => {
      const { masterToken } = getTokensFromStore();
      if (masterToken) cfg.headers.token = `Bearer ${masterToken}`;
      return cfg;
    },
    (err) => Promise.reject(err)
  );
});

/* -------------------------
   Request cancellation + AES encrypt/decrypt interceptors
   ------------------------- */

/*
  Behavior:
  - If a new request is started with the same "key" as an earlier still-pending request,
    we abort the earlier one.
  - Key is: method + baseURL + url + params + body (so POST/PUT with different bodies are distinct).
  - Per-request opt-out: set `skipCancel: true` in axios config.
*/

const pendingRequests = new Map();

const getRequestKey = (cfg = {}) => {
  const method = (cfg.method || "get").toLowerCase();
  const url = `${cfg.baseURL || ""}${cfg.url || ""}`;
  const params = cfg.params ? JSON.stringify(cfg.params) : "";
  // include data (body) to differentiate POSTs with different payloads
  let data = "";
  try {
    if (cfg.data !== undefined && cfg.data !== null) {
      // if data is an object, stringify it (but avoid huge objects); if it's already a string, use it
      data = typeof cfg.data === "string" ? cfg.data : JSON.stringify(cfg.data);
    }
  } catch (e) {
    data = "";
  }
  return `${method}::${url}::${params}::${data}`;
};

[publicRequest, userRequest, adminRequest].forEach((inst) => {
  // 1) Cancellation interceptor (runs first for the instance)
  inst.interceptors.request.use(
    (cfg) => {
      // allow opt-out per request
      if (cfg && cfg.skipCancel) return cfg;

      const key = getRequestKey(cfg);
      const existing = pendingRequests.get(key);
      if (existing) {
        try {
          if (existing.abort) existing.abort("Aborted in favor of new request");
          else if (existing.cancel) existing.cancel("Aborted in favor of new request");
        } catch (e) {
          // swallow
        }
        pendingRequests.delete(key);
      }

      // create controller (prefer AbortController)
      if (typeof AbortController !== "undefined") {
        const controller = new AbortController();
        cfg.signal = controller.signal; // axios supports AbortController.signal
        pendingRequests.set(key, { abort: () => controller.abort(), key });
      } else {
        // fallback to axios CancelToken for older environments/axios versions
        const source = axios.CancelToken.source();
        cfg.cancelToken = source.token;
        pendingRequests.set(key, { cancel: source.cancel, key });
      }

      // store key to help cleanup on response
      cfg._pendingKey = key;
      return cfg;
    },
    (err) => Promise.reject(err)
  );

  // 2) Token/header injection for publicRequest is only brandDomain (already set during creation)
  //    (userRequest/adminRequest token interceptors were registered earlier and re-registered on store changes)

  // 3) Encrypt outgoing payload (skip FormData)
  inst.interceptors.request.use(
    (cfg) => {
      // If this is a FormData (file upload), skip encryption entirely
      if (cfg.data instanceof FormData) {
        // also preserve Content-Type behavior (let browser set multipart/form-data boundary)
        return cfg;
      }

      // Only encrypt non-empty data. Note: data may be a string or object.
      if (cfg.data !== undefined && cfg.data !== null && cfg.data !== "") {
        try {
          // If data is already a string we still encrypt (server expects encrypted text/plain)
          cfg.data = encrypt(cfg.data);
          cfg.headers = cfg.headers || {};
          cfg.headers["Content-Type"] = "text/plain";
        } catch (e) {
          // if encryption fails, just pass original data
        }
      }
      return cfg;
    },
    (err) => Promise.reject(err)
  );

  // 4) Decrypt responses (success)
  inst.interceptors.response.use(
    (res) => {
      try {
        const key = res?.config?._pendingKey;
        if (key && pendingRequests.has(key)) pendingRequests.delete(key);
      } catch (e) {}

      try {
        const ct = (res?.headers?.["content-type"] || "").toString();
        if (typeof res.data === "string" && ct.includes("text/plain")) {
          res.data = decrypt(res.data);
        }
      } catch (e) {
        // ignore decryption errors
      }
      return res;
    },
    (err) => {
      // cleanup pending map for this request (if any)
      try {
        const cfg = err?.config || err?.response?.config;
        const key = cfg?._pendingKey;
        if (key && pendingRequests.has(key)) pendingRequests.delete(key);
      } catch (e) {}

      // attempt to decrypt textual error payload if present
      try {
        const ct = (err?.response?.headers?.["content-type"] || "").toString();
        if (err?.response?.data && typeof err.response.data === "string" && ct.includes("text/plain")) {
          err.response.data = decrypt(err.response.data);
        }
      } catch (e) {
        // ignore
      }

      return Promise.reject(err);
    }
  );
});

/* -------------------------
   Cleanup pending requests on unload
   ------------------------- */
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    pendingRequests.forEach((v) => {
      try {
        if (v.abort) v.abort();
        else if (v.cancel) v.cancel();
      } catch (e) {}
    });
    pendingRequests.clear();
  });
}

/* -------------------------
   Exports
   ------------------------- */
const requestMethods = {
  publicRequest,
  userRequest,
  adminRequest,
};

export default requestMethods;
