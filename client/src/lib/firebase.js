import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyALykMDILuzNABYm1w-8pScP8Am1oyG4z4",
    authDomain: "flurry-cbbf8.firebaseapp.com",
    projectId: "flurry-cbbf8",
    storageBucket: "flurry-cbbf8.firebasestorage.app",
    messagingSenderId: "362768480508",
    appId: "1:362768480508:web:173e90724500500de83f79"
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

export const requestFcmToken = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            const token = await getToken(messaging, {
                vapidKey: "BOSP7qmW8LhYXBqwYcArg5LTGRus7h-e1UGOW4ei0Pi3_mde-J75G2-CSZSTr9_DhpPxqGwGmS7Ikgd6SPvzDbg",
            });
            return token;
        } else {
            console.log("❌ Permission denied");
            return null;
        }
    } catch (error) {
        console.error("❌ Error getting token:", error);
        return null;
    }
};