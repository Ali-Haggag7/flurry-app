/**
 * @file messageRouter.js
 * @description Defines API endpoints for the Messaging System.
 * Handles real-time streams (SSE), message CRUD operations, and conversation management.
 *
 * @path /api/message
 */

import express from "express";

// --- Middleware & Config ---
import { protect } from "../middlewares/auth.js";
import upload from "../configs/multer.js";

// --- Controllers ---
import {
    sendMessage,
    getChatMessages,
    getRecentMessages,
    sseController,
    markMessagesAsRead,
    deleteConversation,
    reactToMessage,
    deleteMessage,
    editMessage
} from "../controllers/messageController.js";

const messageRouter = express.Router();

// ==============================================================================
// 1. Static Routes & Streams (High Priority)
// ==============================================================================
// ⚠️ ARCHITECTURE NOTE: These routes must be defined BEFORE dynamic routes (/:id)
// to prevent the server from interpreting "recent" or "stream" as a user ID.

/**
 * @route GET /api/message/stream/:userId
 * @desc Initialize Server-Sent Events (SSE) connection
 */
messageRouter.get("/stream/:userId", sseController);

/**
 * @route GET /api/message/recent
 * @desc Get list of recent conversations
 * @access Private
 */
messageRouter.get("/recent", protect, getRecentMessages);

// ==============================================================================
// 2. Message Actions (Write Operations)
// ==============================================================================

/**
 * @route POST /api/message/send
 * @desc Send a new message (Text and/or Image)
 * @middleware upload.single('image') - Handles multipart/form-data
 * @access Private
 */
messageRouter.post("/send", protect, upload.single("image"), sendMessage);

/**
 * @route POST /api/message/react
 * @desc Add, update, or remove a reaction
 * @access Private
 */
messageRouter.post("/react", protect, reactToMessage);

/**
 * @route PUT /api/message/read/:senderId
 * @desc Mark all messages from a specific sender as read
 * @access Private
 */
messageRouter.put("/read/:senderId", protect, markMessagesAsRead);

/**
 * @route DELETE /api/message/conversation/:targetId
 * @desc Delete an entire conversation history
 * @access Private
 */
messageRouter.delete("/conversation/:targetId", protect, deleteConversation);

/**
 * @route DELETE /api/message/:id
 * @desc Delete a specific message
 * @access Private
 */
messageRouter.delete("/:id", protect, deleteMessage);

/**
 * @route PUT /api/message/:id
 * @desc Edit a specific message
 * @access Private
 */
messageRouter.put("/:id", protect, editMessage);

// ==============================================================================
// 3. Dynamic Routes (Low Priority)
// ==============================================================================

/**
 * @route GET /api/message/:withUserId
 * @desc Get chat history with a specific user
 * @access Private
 *
 * ⚠️ NOTE: This acts as a catch-all for GET requests.
 * Do not place specific GET routes below this line.
 */
messageRouter.get("/:withUserId", protect, getChatMessages);

export default messageRouter;