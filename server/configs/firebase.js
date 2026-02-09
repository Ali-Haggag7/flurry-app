/**
 * @fileoverview Firebase Admin SDK Configuration
 * Handles secure credential loading from Environment Variables.
 * Supports automatic private key formatting for cloud deployment.
 */

import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

let serviceAccount;

try {
    // ---------------------------------------------------------
    // 1. Load Credentials from Environment Variable (Production)
    // ---------------------------------------------------------
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Parse the JSON string from the environment variable
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        // 🔧 CRITICAL FIX: Sanitize Private Key
        // Replaces escaped newlines (\\n) with real newlines (\n)
        // This is required for Vercel/Heroku/Sevalla environments.
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        console.log("✅ [Firebase Config] Successfully loaded credentials from Env Var.");
    }
    // ---------------------------------------------------------
    // 2. Fallback: Local Configuration (Optional)
    // ---------------------------------------------------------
    else {
        console.warn("⚠️ [Firebase Config] Warning: FIREBASE_SERVICE_ACCOUNT Env Var not found.");
    }

} catch (error) {
    console.error("❌ [Firebase Config] Failed to parse credentials:", error.message);
}

// ---------------------------------------------------------
// 3. Initialize Firebase Admin SDK
// ---------------------------------------------------------
// Prevent multiple initializations (Singleton pattern)
if (!admin.apps.length && serviceAccount) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("🚀 [Firebase Config] Admin SDK Initialized Successfully.");
    } catch (error) {
        console.error("❌ [Firebase Config] Initialization Error:", error);
    }
} else if (!serviceAccount) {
    console.error("🚨 [Firebase Config] Fatal: No valid service account provided. Notifications will fail.");
}

export default admin;