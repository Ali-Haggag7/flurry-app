import express from "express";
import { protect } from "../middlewares/auth.js";
import {
    sendConnectionRequest,
    getUserConnections,
    acceptConnection,
    rejectConnectionRequest,
    blockUser,
    unblockUser,
    removeConnection
} from "../controllers/connectionController.js";
import { followUser, unfollowUser } from "../controllers/userController.js";
// (ملحوظة: لو لسه معملتش نقل لـ follow/unfollow للكنترولر ده، استوردهم من userController مؤقتاً)

const connectionRouter = express.Router();

// ============= (الروابط بتاعتنا) =============

// 1. Send Request
connectionRouter.post("/send", protect, sendConnectionRequest);

// 2. 👇👇 التعديل هنا: شيلنا "/get" وخليناها "/" بس 👇👇
// عشان الفرونت بينادي على /api/connection علطول
connectionRouter.get("/", protect, getUserConnections);

// 3. Accept Request
connectionRouter.post("/accept/:requestId", protect, acceptConnection);

// 4. Reject Request
connectionRouter.post("/reject/:id", protect, rejectConnectionRequest);

connectionRouter.put("/remove/:userId", protect, removeConnection)


// 5. Block / Unblock
connectionRouter.post("/block/:id", protect, blockUser);
connectionRouter.post("/unblock/:id", protect, unblockUser);

// 6. 👇👇 (مهم جداً) ضيفنا دول عشان الفرونت بيستخدمهم هنا 👇👇
// لو لسه منقلتهمش، لازم تعملهم import وتضيفهم هنا
connectionRouter.post("/follow/:id", protect, followUser);
connectionRouter.post("/unfollow/:id", protect, unfollowUser);

export default connectionRouter;