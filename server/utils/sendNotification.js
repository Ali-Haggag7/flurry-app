import admin from "../configs/firebase.js";
import User from "../models/User.js";

// CONFIG: Notification Appearance
const APP_LOGO_URL = "https://ik.imagekit.io/flowNet/tr:f-webp:w-512:q-auto/1769641208117_apple-touch-icon_xGjsDRYtd.png";

/**
 * Sends a push notification to a single user based on their User ID.
 */
export const sendPushNotification = async (userId, title, body, data = {}) => {
    try {
        if (!admin.apps.length) {
            console.error("❌ [Push] Firebase Admin not initialized.");
            return;
        }

        const user = await User.findById(userId).select("fcmTokens isPushEnabled").lean();

        if (!user || !user.isPushEnabled || !user.fcmTokens || user.fcmTokens.length === 0) {
            return;
        }

        // Convert data values to strings
        const stringifiedData = Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
        }, {});

        // Resolve the main icon (sender image fallback to app logo)
        const senderIcon = data.senderImage || data.icon || APP_LOGO_URL;

        const message = {
            notification: {
                title: title || "Flurry Notification",
                body: body || ""
            },
            webpush: {
                notification: {
                    icon: senderIcon,
                    badge: APP_LOGO_URL,
                    image: data.image || null,
                    click_action: "https://flurry-app.vercel.app/",
                    tag: `flurry_msg_${Date.now()}`,
                    renotify: true,
                    requireInteraction: false
                },
                fcm_options: {
                    link: "https://flurry-app.vercel.app/"
                }
            },
            data: {
                ...stringifiedData,
                url: "/",
                type: "NOTIFICATION"
            },
            tokens: user.fcmTokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // Token Cleanup
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if (error.code === "messaging/registration-token-not-registered" || error.code === "messaging/invalid-argument") {
                        failedTokens.push(user.fcmTokens[idx]);
                    }
                }
            });

            if (failedTokens.length > 0) {
                await User.updateOne({ _id: userId }, { $pull: { fcmTokens: { $in: failedTokens } } });
            }
        }
    } catch (error) {
        console.error("🔥 [Push] FATAL ERROR:", error.message);
    }
};

/**
 * Sends a push notification to a group of users.
 */
export const sendGroupPushNotification = async (memberIds, title, body, data = {}) => {
    try {
        if (!memberIds || memberIds.length === 0) return;

        const users = await User.find({
            _id: { $in: memberIds },
            isPushEnabled: true,
            fcmTokens: { $exists: true, $not: { $size: 0 } }
        }).select("fcmTokens").lean();

        if (!users || users.length === 0) return;

        const allTokens = [...new Set(users.flatMap(u => u.fcmTokens))];
        if (allTokens.length === 0) return;

        const stringifiedData = Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
        }, {});

        // Resolve the main icon (group image, sender image fallback to app logo)
        const groupOrSenderIcon = data.groupImage || data.senderImage || data.icon || APP_LOGO_URL;

        const message = {
            notification: { title, body },
            webpush: {
                notification: {
                    icon: groupOrSenderIcon,
                    badge: APP_LOGO_URL,
                    click_action: "https://flurry-app.vercel.app/",
                    tag: `flurry_group_${Date.now()}`,
                    renotify: true
                },
                fcm_options: {
                    link: "https://flurry-app.vercel.app/"
                }
            },
            data: { ...stringifiedData, click_action: "/" },
            tokens: allTokens,
        };

        await admin.messaging().sendEachForMulticast(message);

    } catch (error) {
        console.error("🔥 [Group Push] Error:", error.message);
    }
};