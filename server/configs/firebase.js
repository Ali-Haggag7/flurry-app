import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

let serviceAccount;

try {
    const rawData = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (rawData) {
        // 1. Parsing JSON
        serviceAccount = JSON.parse(rawData);

        // 2. Fixing Private Key (The Ultimate Fix) 🔧
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key
                // الخطوة دي بتصلح الغلطة اللي ظهرت في اللوج (n لازقة في الهيدر)
                .replace(/-----BEGIN PRIVATE KEY-----n/g, '-----BEGIN PRIVATE KEY-----\n')
                .replace(/n-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----')

                // الخطوات العادية لباقي الأسطر
                .replace(/\\n/g, '\n')
                .replace(/\\\\n/g, '\n');

            console.log("🔑 [Firebase] Key Start Check:", JSON.stringify(serviceAccount.private_key.substring(0, 50)));
        }
    } else {
        console.error("❌ [Firebase] Env Var is Missing!");
    }
} catch (error) {
    console.error("❌ [Firebase] Config Error:", error.message);
}

// 3. Initialize Firebase
if (!admin.apps.length && serviceAccount) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("🚀 [Firebase] Admin Initialized Successfully!");
    } catch (error) {
        console.error("❌ [Firebase] Init Failed:", error);
    }
}

export default admin;