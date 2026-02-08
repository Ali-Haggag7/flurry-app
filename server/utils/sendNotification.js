import admin from "../configs/firebase.js";
import User from "../models/User.js";

/**
 * Sends a push notification to a single user.
 * Automatically cleans up invalid/expired FCM tokens.
 *
 * @param {string} userId - The target user's MongoDB _id.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 * @param {object} [data={}] - Additional data payload.
 */
export const sendPushNotification = async (userId, title, body, data = {}) => {
    console.log(`🚀 [Push] Starting for User: ${userId}`);

    try {
        // Optimization: Use .lean() for faster read-only performance
        const user = await User.findById(userId)
            .select("fcmTokens isPushEnabled")
            .lean();

        if (!user || !user.isPushEnabled || !user.fcmTokens || user.fcmTokens.length === 0) {
            console.log("⚠️ [Push] User disabled notifications or no tokens.");
            return;
        }

        const message = {
            notification: { title, body },
            data: { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
            tokens: user.fcmTokens,
        };

        console.log(`📨 [Push] Sending to ${user.fcmTokens.length} tokens...`);

        const response = await admin.messaging().sendEachForMulticast(message);

        console.log(`✅ [Push] Result: Success ${response.successCount}, Failed ${response.failureCount}`);

        // Token Cleanup Logic
        if (response.failureCount > 0) {
            const failedTokens = response.responses
                .map((resp, idx) => (!resp.success ? user.fcmTokens[idx] : null))
                .filter(token => token !== null);

            if (failedTokens.length > 0) {
                await User.updateOne(
                    { _id: userId },
                    { $pull: { fcmTokens: { $in: failedTokens } } }
                );
                console.log(`🧹 [Push] Cleaned ${failedTokens.length} invalid tokens.`);
            }
        }

    } catch (error) {
        console.error("🔥 [Push] FATAL ERROR:", error);
        // Debug helper preserved from original logic
        if (admin && admin.messaging) {
            console.debug("ℹ️ Admin Messaging Methods:", Object.keys(admin.messaging()));
        }
    }
};

/**
 * Sends a push notification to a group of users.
 * Optimized to fetch only valid users with tokens.
 *
 * @param {Array<string>} memberIds - Array of user IDs.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 * @param {object} [data={}] - Additional data payload.
 */
export const sendGroupPushNotification = async (memberIds, title, body, data = {}) => {
    try {
        // Optimization: Filter at DB level and use .lean()
        const users = await User.find({
            _id: { $in: memberIds },
            isPushEnabled: true,
            fcmTokens: { $exists: true, $not: { $size: 0 } }
        })
            .select("fcmTokens")
            .lean();

        if (!users || users.length === 0) return;

        // Flatten all tokens into a single array
        const allTokens = users.flatMap(u => u.fcmTokens);

        if (allTokens.length === 0) return;

        console.log(`📣 [Group Push] Sending to ${users.length} members (${allTokens.length} tokens)...`);

        const message = {
            notification: { title, body },
            data: { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
            tokens: allTokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        console.log(`✅ [Group Push] Success: ${response.successCount}, Failed: ${response.failureCount}`);

    } catch (error) {
        console.error("🔥 [Group Push] Error:", error);
    }
};