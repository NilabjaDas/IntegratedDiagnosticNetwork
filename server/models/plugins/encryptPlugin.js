const crypto = require('crypto');

// Default algorithm
const ALGORITHM = 'aes-256-cbc';

const getCipherKey = (secret) => {
    return crypto.createHash('sha256').update(secret).digest();
};

const encrypt = (text, secret) => {
    if (!text || typeof text !== 'string') return text;
    const key = getCipherKey(secret);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
};

const decrypt = (text, secret) => {
    if (!text || typeof text !== 'string') return text;
    const parts = text.split(':');
    if (parts.length !== 2) return text;

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = getCipherKey(secret);

    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error("Decryption failed:", err.message);
        return text;
    }
};

const hashValue = (text, secret) => {
    if (!text || !secret) return text;
    return crypto.createHmac('sha256', secret).update(text).digest('hex');
};

// Helper to access nested properties safely
const getNestedValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const setNestedValue = (obj, path, value) => {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc, part) => {
        if (!acc[part]) acc[part] = {};
        return acc[part];
    }, obj);
    target[last] = value;
};

module.exports = function (schema, options) {
    const { fields, secret, blindIndexFields = [] } = options;

    if (!secret) {
        throw new Error('Encryption secret is required');
    }

    if (!fields || !Array.isArray(fields)) {
        throw new Error('Fields to encrypt must be an array');
    }

    // Hook: Pre-save (Encrypt)
    schema.pre('save', function (next) {
        const doc = this;

        // Handle Blind Indexes (Hashing) if configured
        // convention: field "mobile" -> blind index "mobileHash"
        fields.forEach(field => {
            if (doc.isModified(field)) {
                const val = typeof doc.get === 'function' ? doc.get(field) : getNestedValue(doc, field);

                // If there is a corresponding hash field in the schema, update it properly
                const hashFieldName = `${field}Hash`.replace(/\./g, '_');

                // Just check root level for now for mobileHash/emailHash
                if (doc.schema.path(hashFieldName)) {
                     doc.set(hashFieldName, hashValue(val, secret));
                }

                if (val) {
                    const encryptedVal = encrypt(val, secret);
                    if (typeof doc.set === 'function') {
                        doc.set(field, encryptedVal);
                    } else {
                        setNestedValue(doc, field, encryptedVal);
                    }
                }
            }
        });
        next();
    });

    // Hook: Pre-update (Encrypt updates)
    schema.pre(['update', 'updateOne', 'findOneAndUpdate'], function (next) {
        const update = this.getUpdate();
        fields.forEach(field => {
            // Check flat update
            if (update[field]) {
                // Hash if configured
                 if (blindIndexFields.includes(field)) {
                     update[`${field}Hash`] = hashValue(update[field], secret);
                 }
                update[field] = encrypt(update[field], secret);
            }
            // Check $set
            if (update.$set && update.$set[field]) {
                 const val = update.$set[field];
                 update.$set[field] = encrypt(val, secret);

                 // Hash if configured
                 if (blindIndexFields.includes(field)) {
                     update.$set[`${field}Hash`] = hashValue(val, secret);
                 }
            }
        });
        next();
    });

    // Hook: Post-init (Decrypt) - For findOne, find, etc.
    schema.post('init', function (doc) {
        fields.forEach(field => {
            const val = getNestedValue(doc, field);
            if (val) {
                const decryptedVal = decrypt(val, secret);
                setNestedValue(doc, field, decryptedVal);
            }
        });
    });

    // Handle decryption after save
    schema.post('save', function (doc) {
        fields.forEach(field => {
            const val = typeof doc.get === 'function' ? doc.get(field) : getNestedValue(doc, field);
            if (val) {
                const decryptedVal = decrypt(val, secret);
                if (typeof doc.set === 'function') {
                    doc.set(field, decryptedVal);
                } else {
                    setNestedValue(doc, field, decryptedVal);
                }
            }
        });
    });
};

module.exports.hashValue = hashValue; // Export helper
