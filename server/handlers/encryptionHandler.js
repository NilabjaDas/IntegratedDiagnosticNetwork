const { randomBytes, createCipheriv, createDecipheriv } = require('crypto');

const KEY = Buffer.from(process.env.DOCUMENT_ENCRYPTION_KEY, 'hex');


function encryptText(plaintext) {
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', KEY, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, tag, ciphertext]).toString('base64');

    // Add a custom marker to detect later
    return `ENC:${combined}`;
  } catch (error) {
    console.error('encryptText error:', error);
    return null;
  }
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('ENC:');
}
function decryptText(encData) {
  try {
    if (!isEncrypted(encData)) throw new Error('Not encrypted data');

    const b64 = encData.slice(4); // Remove 'ENC:'
    const buffer = Buffer.from(b64, 'base64');

    const iv = buffer.slice(0, 12);
    const tag = buffer.slice(12, 28);
    const ciphertext = buffer.slice(28);

    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (err) {
    console.error('decryptText error:',"Text: ", encData, err);
    return null;
  }
}



function maskString(str) {
  // handle empty / null / undefined
  if (!str) return "ID Number Not Available";

  const len = str.length;

  if (len > 4) {
    // mask all but last 4
    const maskLen = len - 4;
    return "X".repeat(maskLen) + str.slice(-4);
  } else {
    // for 4 or fewer, mask floor(half) chars
    const maskLen = Math.floor(len / 2);
    // if maskLen is 0 (i.e. len == 1), we just return original
    return "X".repeat(maskLen) + str.slice(maskLen);
  }
}

module.exports = {
  encryptText,
  decryptText,
  maskString,
};
