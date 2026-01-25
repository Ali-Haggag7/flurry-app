import express from "express";

// --- Middlewares ---
import { protect } from "../middlewares/auth.js";

// --- Controllers ---
import {
    sendConnectionRequest,
    getUserConnections,
    acceptConnection,
    rejectConnectionRequest,
    blockUser,
    unblockUser,
    removeConnection,
} from "../controllers/connectionController.js";

import {
    followUser,
    unfollowUser,
} from "../controllers/userController.js";

/**
 * Connection Router
 * -----------------
 * Manages the social graph edges:
 * 1. Friend Requests (Send/Accept/Reject)
 * 2. Relationship Management (Get List/Remove Friend)
 * 3. Safety (Block/Unblock)
 * 4. Graph Actions (Follow/Unfollow)
 *
 * @basePath /api/connection
 */
const connectionRouter = express.Router();

// ========================================================
// 🤝 Request Lifecycle (Send, Accept, Reject)
// ========================================================

/**
 * @route POST /api/connection/send
 * @desc Initiate a friend request
 */
connectionRouter.post("/send", protect, sendConnectionRequest);

/**
 * @route POST /api/connection/accept/:requestId
 * @desc Accept an incoming friend request
 */
connectionRouter.post("/accept/:requestId", protect, acceptConnection);

/**
 * @route POST /api/connection/reject/:id
 * @desc Reject/Ignore an incoming friend request
 */
connectionRouter.post("/reject/:id", protect, rejectConnectionRequest);

// ========================================================
// 📋 Connection Management (List & Cleanup)
// ========================================================

/**
 * @route GET /api/connection/
 * @desc Get all connections (Friends/Pending Requests)
 * @note Optimized to "/" based on frontend requirement.
 */
connectionRouter.get("/", protect, getUserConnections);

/**
 * @route PUT /api/connection/remove/:userId
 * @desc Unfriend a user (Remove existing connection)
 */
connectionRouter.put("/remove/:userId", protect, removeConnection);

// ========================================================
// 🛡️ Safety & Blocking
// ========================================================

/**
 * @route POST /api/connection/block/:id
 * @desc Block a user (prevents interaction)
 */
connectionRouter.post("/block/:id", protect, blockUser);

/**
 * @route POST /api/connection/unblock/:id
 * @desc Unblock a previously blocked user
 */
connectionRouter.post("/unblock/:id", protect, unblockUser);

// ========================================================
// 👣 Social Graph (Follow System)
// ========================================================

/**
 * @route POST /api/connection/follow/:id
 * @desc Follow a user (One-way relationship)
 * @note Imported from userController as per current architecture.
 */
connectionRouter.post("/follow/:id", protect, followUser);

/**
 * @route POST /api/connection/unfollow/:id
 * @desc Unfollow a user
 */
connectionRouter.post("/unfollow/:id", protect, unfollowUser);

export default connectionRouter;