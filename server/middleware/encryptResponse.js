const CryptoJS = require("crypto-js");


const encryptResponse = (req, res, next) => {
  // Overwrite the `res.json` method
  const originalJson = res.json;

  res.json = function (data) {
    try {
      // Convert data to string and encrypt
      const stringifiedData = JSON.stringify(data);
      const encryptedData = CryptoJS.AES.encrypt(
        stringifiedData,
        process.env.AES_SEC
      ).toString();

      // Call the original res.json with the encrypted data
      originalJson.call(this, encryptedData);
    } catch (error) {
      console.error("Error encrypting response:", error);
      res.status(500).json({ message: "Encryption Error", error: error.message });
    }
  };

  next();
};

const decryptResponse = (encryptedData) => {
  try {
    // Decrypt the encrypted data
    const bytes = CryptoJS.AES.decrypt(encryptedData, process.env.AES_SEC);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

    // Parse the decrypted data to JSON
    return JSON.parse(decryptedData);
  } catch (error) {
    console.error("Error decrypting response:", error);
    // throw new Error("Decryption Error");
  }
};

module.exports = {encryptResponse,decryptResponse};
