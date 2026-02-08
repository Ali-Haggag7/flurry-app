/* public/firebase-messaging-sw.js */
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


if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Service Worker: Firebase Initialized");
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('🌙 Background Notification:', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
    console.log('[SW] Notification click Received.', event.notification.data);

    event.notification.close();

    let urlToOpen = '/';
    const data = event.notification.data;

    if (data) {
        if (data.type === 'chat' && data.chatId) {
            urlToOpen = `/messages/${data.chatId}`;
        } else if (data.type === 'group_chat' && data.groupId) {
            urlToOpen = `/groups/${data.groupId}/chat`;
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});