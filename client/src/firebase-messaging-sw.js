/* src/firebase-messaging-sw.js */

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// 1. PWA & Caching Logic (The Fix 🛠️)
// --------------------------------------------------

// تنظيف الكاشات القديمة عشان مفيش ملفات قديمة تضرب الموقع
cleanupOutdatedCaches();

// self.skipWaiting() force causes the waiting service worker to become the active service worker.
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// وده بيخليه يسيطر على كل التابات المفتوحة فوراً
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// تحميل ملفات الموقع اللي Vite بيبعتها
precacheAndRoute(self.__WB_MANIFEST || []);

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
}

const messaging = firebase.messaging();

/**
 * 🌙 Background Message Handler
 */
messaging.onBackgroundMessage((payload) => {
    console.log('🌙 [SW] Background Notification Received:', payload);
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
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // 1. Check if tab is already open
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
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