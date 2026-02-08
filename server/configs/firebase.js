import admin from "firebase-admin";
import { createRequire } from "module";
import dotenv from "dotenv";

dotenv.config();

const require = createRequire(import.meta.url);

let serviceAccount;

try {
    // 1. الأولوية: لو احنا لايف، اقرأ المفاتيح من متغير البيئة
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // لازم نعمل parse عشان نحول النص لـ JSON Object
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log("✅ Loaded Firebase config from Env Var");
    }
    // 2. البديل: لو احنا لوكال (على جهازك)، اقرأ من الملف
    else {
        serviceAccount = require("../firebase-key.json");
        console.log("✅ Loaded Firebase config from local file");
    }
} catch (error) {
    console.error("❌ Error loading Firebase credentials:", error.message);
}

// تهيئة الفايربيز
if (!admin.apps.length && serviceAccount) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("✅ Firebase Admin Initialized successfully");
    } catch (error) {
        console.error("❌ Firebase Init Error:", error);
    }
}

export default admin;