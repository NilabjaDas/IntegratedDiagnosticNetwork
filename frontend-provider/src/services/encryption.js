import CryptoJS from 'crypto-js';

const PASS_SEC = process.env.REACT_APP_PASS_SEC || "GnJGYEFWwMHP6BrAN7SYhZzDS6nVwM";
const AES_SEC = process.env.REACT_APP_AES_SEC || "GnJGYEFWwMHP6BrAN7SYhZzDS6nVwM";

export const encryptPayload = (data, endpoint) => {
    // Determine key based on endpoint (matching server logic)
    const url = endpoint.toLowerCase();
    const usePassKey =
      url.endsWith("/guesthubaccess") ||
      url.endsWith("/admin-login") ||
      url.endsWith("/brand-admin-login");

    const key = usePassKey ? PASS_SEC : AES_SEC;

    // Encrypt
    const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
    return ciphertext;
};
