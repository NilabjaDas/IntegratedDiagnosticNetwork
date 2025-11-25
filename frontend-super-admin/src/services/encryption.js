import CryptoJS from 'crypto-js';

const PASS_SEC = process.env.REACT_APP_PASS_SEC;
const AES_SEC = process.env.REACT_APP_AES_SEC;

export const encryptPayload = (data, endpoint) => {
    // Determine key based on endpoint (matching server logic)
    const url = endpoint.toLowerCase();
    const usePassKey =
      url.endsWith("/admin-login") ||
      url.endsWith("/brand-admin-login");

    const key = usePassKey ? PASS_SEC : AES_SEC;
    console.log(key)
    // Encrypt
    const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
    return ciphertext;
};
