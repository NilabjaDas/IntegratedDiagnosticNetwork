// src/utils/axios.js
import axios from "axios";
import CryptoJS from "crypto-js";
import { store } from "./redux/store";
import { CLEAR_ALL_REDUCERS } from "./redux/actionTypes";

/* -------------------------
   Domain / baseURL helpers
   ------------------------- */
// Get the protocol (e.g., "https:")
const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
// Get hostname and remove admin. prefix if present
const hostname = typeof window !== "undefined" ? window.location.hostname : "saltstayz.ai";
const mainDomain = hostname.startsWith("admin.") ? hostname.slice(6) : hostname;

export const BASE_URL = "/";
export const currentDomain = "wakilslab.com";

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
  if (obj === undefined || obj === null) return obj;
  try {
    return CryptoJS.AES.encrypt(JSON.stringify(obj), getKey()).toString();
  } catch (e) {
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
   Global Interceptors (Encryption + Auth Error Handling)
   ------------------------- */
// Note: Cancellation logic removed to prevent "ERR_CANCELED" issues

[publicRequest, userRequest, adminRequest].forEach((inst) => {
  
  // 1) Encrypt outgoing payload (skip FormData)
  inst.interceptors.request.use(
    (cfg) => {
      if (cfg.data instanceof FormData) {
        return cfg;
      }
      if (cfg.data !== undefined && cfg.data !== null && cfg.data !== "") {
        try {
          cfg.data = encrypt(cfg.data);
          cfg.headers = cfg.headers || {};
          cfg.headers["Content-Type"] = "text/plain";
        } catch (e) {}
      }
      return cfg;
    },
    (err) => Promise.reject(err)
  );

  // 2) Decrypt responses & Handle Auth Errors
  inst.interceptors.response.use(
    (res) => {
      // Attempt decryption
      try {
        const ct = (res?.headers?.["content-type"] || "").toString();
        if (typeof res.data === "string" && ct.includes("text/plain")) {
          res.data = decrypt(res.data);
        }
      } catch (e) {}
      return res;
    },
    (err) => {
      // --- GLOBAL AUTH HANDLER ---
      // If 401 or 403, force logout
      if (err.response) {
        const { status } = err.response;
        if (status === 401 || status === 403) {
           if (window.location.pathname !== "/login") {
              store.dispatch({ type: CLEAR_ALL_REDUCERS });
           }
        }
      }

      // Attempt to decrypt error payload if present
      try {
        const ct = (err?.response?.headers?.["content-type"] || "").toString();
        if (err?.response?.data && typeof err.response.data === "string" && ct.includes("text/plain")) {
          err.response.data = decrypt(err.response.data);
        }
      } catch (e) {}

      return Promise.reject(err);
    }
  );
});

/* -------------------------
   Exports
   ------------------------- */
const requestMethods = {
  publicRequest,
  userRequest,
  adminRequest,
};

export default requestMethods;