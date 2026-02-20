const admin = require("firebase-admin");

const initializeFirebase = () => {
    if (!admin.apps.length) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    // Regex replaces escaped newline characters with actual newlines
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                }),
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET
            });
            console.log("Firebase Admin SDK initialized successfully.");
        } catch (error) {
            console.error("Firebase Initialization Error:", error);
        }
    }
};

module.exports = { admin, initializeFirebase };