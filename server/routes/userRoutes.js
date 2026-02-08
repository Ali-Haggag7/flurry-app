import express from "express";
import { protect, verifyToken } from "../middlewares/auth.js";
import upload from "../configs/multer.js";
import {
    syncUser,
    getUserData,
    updateUserData,
    discoverUsers,
    getUserById,
    getUserNetwork,
    followUser,
    unfollowUser,
    acceptFollowRequest,
    declineFollowRequest,
    toggleBlockUser,
    toggleMuteUser,
    updatePrivacySettings,
    updateNotificationSettings,
    saveFcmToken
} from "../controllers/userController.js";

const userRouter = express.Router();

// =========================================================
// 1. Authentication & Onboarding
// =========================================================

/**
 * @route POST /api/user/sync
 * @desc Syncs user data from Clerk (First time login / Update).
 * @middleware verifyToken (Allows users not yet in DB to access this)
 */
userRouter.post("/sync", verifyToken, syncUser);

/**
 * @route POST /api/user/fcm-token
 * @desc Save FCM Token for Push Notifications
 */
userRouter.post("/fcm-token", protect, saveFcmToken);

// =========================================================
// 2. Current User Profile Management
// =========================================================

/**
 * @route GET /api/user/me
 * @desc Get current logged-in user's full profile.
 */
userRouter.get("/me", protect, getUserData);

/**
 * @route PUT /api/user/update-profile
 * @desc Update profile info and upload images.
 */
userRouter.put(
    "/update-profile",
    protect,
    upload.fields([
        { name: "profile_picture", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    updateUserData
);

// =========================================================
// 3. Settings & Preferences
// =========================================================

userRouter.put("/update-privacy", protect, updatePrivacySettings);
userRouter.put("/update-settings", protect, updateNotificationSettings);

// =========================================================
// 4. Discovery & Search
// =========================================================

userRouter.get("/search", protect, discoverUsers);

// =========================================================
// 5. Social Actions (Follow System)
// =========================================================

userRouter.post("/follow/:id", protect, followUser);
userRouter.post("/unfollow/:id", protect, unfollowUser);

// --- Request Management ---
userRouter.post("/follow-request/accept/:id", protect, acceptFollowRequest);
userRouter.post("/follow-request/decline/:id", protect, declineFollowRequest);

// =========================================================
// 6. Moderation (Block & Mute)
// =========================================================

userRouter.put("/block/:id", protect, toggleBlockUser);
userRouter.put("/mute/:id", protect, toggleMuteUser);

// =========================================================
// 7. Public Data & Network
// =========================================================

/**
 * @route GET /api/user/:id
 * @desc Get specific user profile (Public view).
 */
userRouter.get("/:id", protect, getUserById);

/**
 * @route GET /api/user/:id/:type
 * @desc Get followers or following list.
 * @param type 'followers' | 'following'
 */
userRouter.get("/:id/:type", protect, getUserNetwork);

export default userRouter;