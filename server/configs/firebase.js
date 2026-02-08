import { createRequire } from "module";
const require = createRequire(import.meta.url);

const admin = require("firebase-admin");

const serviceAccount = require("../firebase-key.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin Initialized (v12+)");
}

export default admin;