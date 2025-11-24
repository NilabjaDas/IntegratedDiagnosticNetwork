const sharp = require("sharp");
const fetch = require("node-fetch");
const CryptoJS = require("crypto-js");
const { randomBytes, createCipheriv, createDecipheriv } = require('crypto');

const compressImage = async (base64Image, maxSizeKB) => {
  // Remove the data URI prefix and decode base64
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  let quality = 80;
  let width = 1000;
  let compressedBuffer = await sharp(buffer)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();

  // Reduce quality until file size is within limit or quality is too low
  while (compressedBuffer.length / 1024 > maxSizeKB && quality > 10) {
    quality -= 10;
    compressedBuffer = await sharp(buffer)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
  }

  // If quality alone doesn't work, reduce width as well (down to a minimum width)
  while (compressedBuffer.length / 1024 > maxSizeKB && width > 300) {
    width = Math.floor(width * 0.9);
    compressedBuffer = await sharp(buffer)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
  }

  return compressedBuffer;
};


const KEY = Buffer.from(process.env.DOCUMENT_ENCRYPTION_KEY, 'hex');

function encryptBuffer(plainBuffer) {
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', KEY, iv);
    const ciphertext = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    // output: iv‖tag‖ciphertext
    return Buffer.concat([iv, tag, ciphertext]);
  } catch (err) {
    console.error('encryptBuffer error:', err);
    return null;
  }
}

function decryptBuffer(ivTagCipherBuffer) {
  try {
    // extract iv, tag, ciphertext
    const iv  = ivTagCipherBuffer.subarray(0, 12);
    const tag = ivTagCipherBuffer.subarray(12, 28);
    const ct  = ivTagCipherBuffer.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain;
  } catch (err) {
    console.error('decryptBuffer error or auth failed:', err);
    return null;
  }
}



function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

async function applyWatermarkToImage(imageUrl,overlayText) {
  if (!imageUrl) {
    throw new Error("Image URL is required");
  }

  let decryptedData;
  let decryptedUrl;
  let propertyName;
  try {
    const bytes = CryptoJS.AES.decrypt(imageUrl, process.env.AES_SEC);
    // Convert decrypted data to string
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    
    // Parse the decrypted string to an object
    decryptedData = JSON.parse(decryptedStr);
    decryptedUrl = decryptedData.value;
    propertyName = decryptedData.propertyName;
    
    // Remove extra quotes if present
    decryptedUrl = decryptedUrl?.replace(/^"|"$/g, '');
    console.log("Property Name:", propertyName);
    
    // Convert propertyName to uppercase first, then escape it for XML
    if (propertyName) {
      propertyName = escapeXml(propertyName.toUpperCase());
    }
  } catch (error) {
    console.log("Decryption error:", error);
    throw error;
  }

  // Fetch the image from the provided URL
  const response = await fetch(decryptedUrl);
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error fetching image. Status: ${response.status}, Message: ${errorText}`);
    throw new Error("Failed to fetch image from URL");
  }
  const imageBuffer = await response.buffer();
  const decryptedBuffer = decryptBuffer(imageBuffer);
  // Load the image with sharp and get its metadata
  const image = sharp(decryptedBuffer);
  const metadata = await image.metadata();

  // Determine a font size relative to the image width
  const fontSize = Math.round(metadata.width / 8);

  // Create an SVG overlay for the watermark.
  // The watermark text is centered and rotated.
  const svgOverlay = `
  <svg width="${metadata.width}" height="${metadata.height}">
    <text x="50%" y="50%" text-anchor="middle" 
      transform="rotate(-45, ${metadata.width / 2}, ${metadata.height / 2})"
      fill="rgba(255, 0, 0, 0.38)" font-size="${fontSize}" font-family="Arial">
      CONFIDENTIAL
    </text>
    <text x="50%" y="60%" text-anchor="middle" 
      transform="rotate(-45, ${metadata.width / 2}, ${metadata.height / 2})"
      fill="rgb(142, 0, 0)" font-size="30" font-family="Arial">
      <tspan x="50%" dy="0">${overlayText}</tspan>
      ${
        propertyName
          ? `<tspan x="50%" dy="1.2em" fill="rgb(166, 0, 0)" font-size="20">${propertyName}</tspan>`
          : ""
      }
    </text>
  </svg>
  `;

  // Composite the SVG overlay over the image and return the result as a PNG buffer
  const watermarkedImageBuffer = await image
    .composite([{ input: Buffer.from(svgOverlay), gravity: "center" }])
    .png()
    .toBuffer();

  return watermarkedImageBuffer;
}


module.exports = {
  compressImage,
  applyWatermarkToImage,
  encryptBuffer,
  decryptBuffer,
};
