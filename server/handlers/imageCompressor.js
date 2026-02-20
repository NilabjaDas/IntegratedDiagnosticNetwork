const sharp = require("sharp");

/**
 * Compresses and resizes an image buffer.
 * @param {Buffer} buffer - The original image buffer from Multer
 * @returns {Promise<{buffer: Buffer, mimetype: String, extension: String}>}
 */
const compressImage = async (buffer) => {
    try {
        const compressedBuffer = await sharp(buffer)
            .resize({ 
                width: 1200, // Reasonable max width for web
                withoutEnlargement: true // Don't scale up small images
            })
            .webp({ quality: 80 }) // Convert to WebP with 80% quality
            .toBuffer();

        return {
            buffer: compressedBuffer,
            mimetype: "image/webp",
            extension: ".webp"
        };
    } catch (error) {
        console.error("Image Compression Error:", error);
        throw new Error("Failed to compress image");
    }
};

module.exports = { compressImage };