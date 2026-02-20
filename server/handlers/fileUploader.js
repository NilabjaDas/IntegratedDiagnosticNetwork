const { admin } = require("./firebaseInit");
const { randomUUID } = require("crypto");
const path = require("path");

/**
 * Uploads a buffer to Firebase Storage and returns the public URL.
 * @param {Buffer} buffer - The file buffer
 * @param {String} originalName - Original file name (for tracking)
 * @param {String} mimetype - File mime type
 * @param {String} extension - File extension
 * @param {String} folder - Target folder path in storage
 * @returns {Promise<String>} - Public Download URL
 */
const uploadToFirebase = async (buffer, originalName, mimetype, extension, folder = "misc") => {
    const bucket = admin.storage().bucket();
    
    // Fallback extension if none provided
    const ext = extension || path.extname(originalName);
    const fileName = `${folder}/${Date.now()}_${randomUUID()}${ext}`;
    const fileRef = bucket.file(fileName);

    const downloadToken = randomUUID();

    await fileRef.save(buffer, {
        metadata: {
            contentType: mimetype,
            metadata: {
                firebaseStorageDownloadTokens: downloadToken
            }
        }
    });

    const bucketName = bucket.name;
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(fileName)}?alt=media&token=${downloadToken}`;
};

module.exports = { uploadToFirebase };