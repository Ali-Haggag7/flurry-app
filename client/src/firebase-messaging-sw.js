/* src/firebase-messaging-sw.js */

// 1. PWA & Caching Logic (Workbox)
// --------------------------------------------------
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// Immediate control: This ensures the SW takes control immediately, not after a reload.
self.skipWaiting();
clientsClaim();

// Cleanup old caches to keep the app lightweight.
cleanupOutdatedCaches();

// 🚀 The Magic Line: Vite injects the list of files to cache here.
// Without this, the PWA won't work offline properly.
precacheAndRoute(self.__WB_MANIFEST);


// 2. Firebase Cloud Messaging Logic
// --------------------------------------------------
// We use importScripts because Firebase SDKs are external scripts.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyALykMDILuzNABYm1w-8pScP8Am1oyG4z4",
    authDomain: "flurry-cbbf8.firebaseapp.com",
    projectId: "flurry-cbbf8",
    storageBucket: "flurry-cbbf8.firebasestorage.app",
    messagingSenderId: "362768480508",
    appId: "1:362768480508:web:173e90724500500de83f79"
};

// Initialize Firebase only once
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    // console.log("✅ [SW] Firebase Initialized inside PWA Service Worker");
}

const messaging = firebase.messaging();

/**
 * 🌙 Background Message Handler
 * This handles messages when the browser is in the background or closed.
 * Note: If the backend sends a 'notification' payload, the browser might
 * show it automatically. This handler allows for custom handling/logging.
 */
messaging.onBackgroundMessage((payload) => {
    console.log('🌙 [SW] Background Notification Received:', payload);

    // Optional: If you want to customize the notification only if
    // the backend didn't send a full display payload.
    // Since our Backend sends 'webpush' config, this is mostly for logging/debugging.
    const notificationTitle = payload.notification?.title || "New Message";
    const notificationOptions = {
        body: payload.notification?.body || "",
        icon: payload.notification?.icon || "/icon-192x192.png", // Fallback icon
        tag: payload.notification?.tag, // Important for grouping
        data: payload.data
    };

    // Use self.registration to show notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
});


// 3. Notification Click Handler (Interaction)
// --------------------------------------------------
self.addEventListener('notificationclick', function (event) {
    console.log('👆 [SW] Notification Clicked:', event.notification.data);

    // Close the notification immediately
    event.notification.close();

    // Determine the URL to open
    let urlToOpen = '/';
    const data = event.notification.data;

    // Handle Deep Linking based on payload type
    if (data) {
        if (data.click_action && data.click_action !== '/') {
            urlToOpen = data.click_action;
        } else if (data.url) {
            urlToOpen = data.url;
        } else if (data.chatId) {
            urlToOpen = `/messages/${data.chatId}`;
        } else if (data.groupId) {
            urlToOpen = `/groups/${data.groupId}/chat`;
        }
    }

    // Smart Navigation:
    // If the tab is already open, focus it. If not, open a new one.
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // 1. Check if tab is already open
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                // Check if the URL matches (ignoring query params if needed)
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // 2. If not open, open new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});