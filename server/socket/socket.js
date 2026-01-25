/**
 * @fileoverview Socket.io Server Configuration
 * Handles real-time connections, user presence (online/offline/hidden),
 * message delivery status updates, and typing indicators for both 1-on-1 and Group chats.
 * @version 1.2.0
 * @author Senior Backend Architect
 */

import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/Message.js";
import User from "../models/User.js";

// ==========================================
// --- Server & Socket Initialization ---
// ==========================================

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173", // Development
            "http://localhost:4173", // Preview Mode
        ],
        methods: ["GET", "POST"],
    },
});

// Bind io instance to the Express app for Controller access via req.app.get('io')
app.set("io", io);

// ==========================================
// --- State Management ---
// ==========================================

/**
 * Maps User IDs to their current Socket IDs.
 * Structure: { [userId: string]: socketId }
 */
export const userSocketMap = {};

/**
 * Set of User IDs who have enabled "Ghost Mode" (Hide Online Status).
 */
const hiddenUsers = new Set();

/**
 * Helper: Retrieve the active socket ID for a specific user.
 * @param {string} receiverId - The Database ID of the user.
 * @returns {string|undefined} The socket ID or undefined if offline.
 */
export const getReceiverSocketId = (receiverId) => {
    return userSocketMap[receiverId];
};

// ==========================================
// --- Connection Handler ---
// ==========================================

io.on("connection", async (socket) => {
    console.log(`🔌 User Connected: ${socket.id}`);

    // 1. Extract User ID from handshake query
    const userId = socket.handshake.query.userId;

    // 2. Validate & Register User
    if (userId && userId !== "undefined") {
        userSocketMap[userId] = socket.id;

        // --- Privacy Check (Ghost Mode) ---
        try {
            const user = await User.findById(userId).select("hideOnlineStatus");
            if (user && user.hideOnlineStatus) {
                hiddenUsers.add(userId);
            }
        } catch (error) {
            console.error(`Error fetching privacy settings for ${userId}:`, error);
        }

        // --- Message Delivery Logic (Mark pending messages as delivered) ---
        const markAsDelivered = async () => {
            try {
                // A. Update Database: Mark all unread messages for this user as delivered
                await Message.updateMany(
                    { receiver: userId, delivered: false },
                    { $set: { delivered: true } }
                );

                // B. Notify Senders: Inform active senders that their messages were delivered
                const senders = await Message.distinct("sender", { receiver: userId });

                senders.forEach((senderId) => {
                    const senderSocketId = userSocketMap[senderId.toString()];
                    if (senderSocketId) {
                        io.to(senderSocketId).emit("messagesDelivered", {
                            toUserId: userId,
                        });
                    }
                });
            } catch (err) {
                console.error(`Error syncing delivery status for ${userId}:`, err);
            }
        };

        // Execute delivery sync
        markAsDelivered();
    }

    // --- Broadcast Online Status ---
    const emitOnlineUsers = () => {
        const allOnlineUsers = Object.keys(userSocketMap);
        // Filter out users who are in hiddenUsers set
        const visibleOnlineUsers = allOnlineUsers.filter(
            (id) => !hiddenUsers.has(id)
        );
        io.emit("getOnlineUsers", visibleOnlineUsers);
    };

    // Initial broadcast upon connection
    emitOnlineUsers();

    // ==========================================
    // --- Event Listeners ---
    // ==========================================

    // 1. Real-time Delivery Confirmation (Feedback from Client)
    socket.on(
        "messageReceivedConfirm",
        ({ messageId, senderId, receiverId }) => {
            const senderSocket = userSocketMap[senderId];
            if (senderSocket) {
                io.to(senderSocket).emit("messageDelivered", {
                    messageId,
                    toUserId: receiverId,
                });
            }
        }
    );

    // 2. Group Chat: Join Room
    socket.on("joinGroup", (groupId) => {
        socket.join(groupId);
        console.log(`User ${userId || "Anon"} joined group: ${groupId}`);
    });

    // 3. Status Toggle (Online/Invisible)
    socket.on("toggleOnlineStatus", ({ isHidden }) => {
        if (isHidden) {
            hiddenUsers.add(userId);
        } else {
            hiddenUsers.delete(userId);
        }
        emitOnlineUsers(); // Refresh lists for everyone
    });

    // 4. Typing Indicators (1-on-1)
    socket.on("typing", (receiverId) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("typing");
        }
    });

    socket.on("stop typing", (receiverId) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("stop typing");
        }
    });

    // 5. Typing Indicators (Group)
    socket.on("typingGroup", ({ groupId, username, image }) => {
        socket.to(groupId).emit("typingGroup", { username, image });
    });

    socket.on("stop typingGroup", (groupId) => {
        socket.to(groupId).emit("stop typingGroup");
    });

    // 6. Disconnection Handler
    socket.on("disconnect", async () => {
        console.log(`❌ User Disconnected: ${socket.id}`);

        if (userId) {
            // Update Last Seen in DB
            try {
                await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
            } catch (error) {
                console.error(`Error updating lastSeen for ${userId}:`, error);
            }

            // Cleanup Maps
            delete userSocketMap[userId];
            hiddenUsers.delete(userId);

            // Broadcast new list
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
        }
    });
});

export { app, io, server };