import express from "express";

// 1. استيراد البوابين (الصارم والمتساهل)
// 👇👇 استوردنا verifyToken هنا 👇👇
import { protect, verifyToken } from "../middlewares/auth.js";

import upload from "../configs/multer.js";

import {
    getUserData,
    updateUserData,
    discoverUsers,
    followUser,
    unfollowUser,
    syncUser,
    getUserById,
    getUserNetwork,
    toggleBlockUser,
    toggleMuteUser,
    updatePrivacySettings,
    acceptFollowRequest,
    declineFollowRequest,
    updateNotificationSettings,
    sendTestEmail
} from "../controllers/userController.js";

const userRouter = express.Router();


// ============= (الروابط بتاعتنا) =============

// 2. (!! التعديل هنا !!)
// استخدمنا verifyToken بدل protect
// عشان يسمح لليوزر الجديد يدخل ويتسجل في الداتابيز
// POST /api/user/sync
userRouter.post("/sync", verifyToken, syncUser);  // 👈👈 التغيير هنا

// باقي الراوتات زي ما هي (تستخدم protect الصارم)
// GET /api/user/me
userRouter.get("/me", protect, getUserData);

// PUT /api/user/update-profile
userRouter.put(
    "/update-profile",
    protect,
    upload.fields([
        { name: "profile_picture", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    updateUserData
);

userRouter.put("/update-privacy", protect, updatePrivacySettings)

userRouter.put("/update-settings", protect, updateNotificationSettings);

// GET /api/user/search
userRouter.get("/search", protect, discoverUsers);

userRouter.post("/test-email", protect, sendTestEmail);

// POST /api/user/follow
userRouter.post("/follow/:id", protect, followUser);

// POST /api/user/unfollow
userRouter.post("/unfollow/:id", protect, unfollowUser);

userRouter.post("/follow-request/accept/:id", protect, acceptFollowRequest);

userRouter.post("/follow-request/decline/:id", protect, declineFollowRequest);

// GET /api/user/:id
userRouter.get("/:id", protect, getUserById);

// :id = آيدي اليوزر صاحب البروفايل
// :type = followers أو following
userRouter.get('/:id/:type', protect, getUserNetwork);

userRouter.put('/block/:id', protect, toggleBlockUser);

userRouter.put("/mute/:id", protect, toggleMuteUser);



export default userRouter;