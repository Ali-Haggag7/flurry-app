/**
 * @fileoverview Socket.io Server Configuration
 * ------------------------------------------------------------------
 * Architect: Senior Backend Architect
 * Purpose: centralized real-time gateway handling:
 * 1. Connection Lifecycle & Authentication
 * 2. Personalized Presence System (Ghost Mode + Block Logic)
 * 3. WebRTC Signaling (1:1 Video/Audio Calls)
 * 4. Messaging & Group Events
 * * @version 1.4.0
 */

import { Server } from "socket.io";
import http from "http";
import express from "express";
import cors from "cors";

// Models
import Message from "../models/Message.js";
import User from "../models/User.js";

// ==========================================
// --- Server Configuration ---
// ==========================================

const app = express();
const server = http.createServer(app);

// Environment & CORS Config
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://flurry-app.vercel.app",
    /\.vercel\.app$/ // Regex to allow Vercel preview deployments
];

const corsConfig = {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsConfig));

const io = new Server(server, {
    cors: corsConfig,
    pingTimeout: 60000, // Close connection after 60s of inactivity
});

app.set("io", io);

// ==========================================
// --- State Management ---
// ==========================================

/**
 * Maps User IDs to their current active Socket ID.
 * @type {Object.<string, string>}
 */
export const userSocketMap = {};

/**
 * Tracks users who have enabled "Ghost Mode" (Hidden Status).
 * @type {Set<string>}
 */
const hiddenUsers = new Set();

/**
 * Retrieves the socket ID for a given user ID.
 * @param {string} receiverId 
 * @returns {string|undefined}
 */
export const getReceiverSocketId = (receiverId) => {
    return userSocketMap[receiverId];
};

// ==========================================
// --- Core Logic: Presence System ---
// ==========================================

/**
 * Emits a personalized list of online users to each connected client.
 * filtering out users based on Block Lists and Privacy Settings.
 */
const emitOnlineUsers = async () => {
    try {
        const onlineIds = Object.keys(userSocketMap);
        if (onlineIds.length === 0) return;

        // Optimization: Fetch blocking/privacy data for ALL online users in one query
        const onlineUsersData = await User.find({ _id: { $in: onlineIds } })
            .select('_id blockedUsers hideOnlineStatus')
            .lean(); // Use lean() for faster execution

        // Create a fast Lookup Map O(1)
        const privacyMap = new Map();
        onlineUsersData.forEach(u => {
            privacyMap.set(u._id.toString(), {
                blockedUsers: new Set(u.blockedUsers.map(id => id.toString())),
                hideOnlineStatus: u.hideOnlineStatus
            });
        });

        // Iterate connected sockets to send personalized views
        const sockets = await io.fetchSockets();

        for (const socket of sockets) {
            const recipientId = socket.handshake.query.userId;
            if (!recipientId) continue;

            const personalizedList = onlineIds.filter(targetId => {
                if (targetId === recipientId) return true; // Always see self

                const targetData = privacyMap.get(targetId);
                if (!targetData) return false;

                // Rule 1: Ghost Mode
                if (targetData.hideOnlineStatus || hiddenUsers.has(targetId)) return false;

                // Rule 2: Blocking Logic (Target blocks Recipient)
                if (targetData.blockedUsers.has(recipientId)) return false;

                return true;
            });

            io.to(socket.id).emit("getOnlineUsers", personalizedList);
        }
    } catch (error) {
        console.error("[Socket] Error emitting online users:", error);
    }
};

// ==========================================
// --- Connection Handler ---
// ==========================================

io.on("connection", async (socket) => {
    const userId = socket.handshake.query.userId;

    // 1. Validation & Initialization
    if (!userId || userId === "undefined") {
        console.warn(`[Socket] Connection rejected: Invalid userId (${socket.id})`);
        socket.disconnect();
        return;
    }

    console.log(`🔌 User Connected: ${userId} (${socket.id})`);
    userSocketMap[userId] = socket.id;

    // 2. Initial State Sync (DB -> Memory)
    try {
        const user = await User.findById(userId).select("hideOnlineStatus").lean();
        if (user?.hideOnlineStatus) {
            hiddenUsers.add(userId);
        }

        // Mark pending messages as delivered
        await Message.updateMany(
            { receiver: userId, delivered: false },
            { $set: { delivered: true } }
        );

        // Notify senders that messages were delivered
        const pendingSenders = await Message.distinct("sender", { receiver: userId, delivered: true }); // Optimized query
        pendingSenders.forEach((senderId) => {
            const senderSocketId = userSocketMap[senderId.toString()];
            if (senderSocketId) {
                io.to(senderSocketId).emit("messagesDelivered", { toUserId: userId });
            }
        });

    } catch (error) {
        console.error(`[Socket] Error initializing user ${userId}:`, error);
    }

    // Broadcast updated presence
    await emitOnlineUsers();


    // ==========================================
    // --- FEATURE: WebRTC Signaling (Calls) ---
    // ==========================================

    /**
     * INITIATE CALL
     * Payload: { userToCall, signalData, from, name, isVideoCall }
     */
    socket.on("callUser", ({ userToCall, signalData, from, name, isVideoCall }) => {
        const socketIdToCall = userSocketMap[userToCall];
        if (socketIdToCall) {
            io.to(socketIdToCall).emit("callUser", {
                signal: signalData,
                from,
                name,
                isVideoCall
            });
        } else {
            // Optional: Emit 'userOffline' to caller if needed
            // io.to(from).emit("callFailed", { reason: "offline" }); 
        }
    });

    /**
     * ANSWER CALL
     * Payload: { signal, to } 
     * Note: 'to' here is the socket ID of the caller (from handshake)
     */
    socket.on("answerCall", (data) => {
        io.to(data.to).emit("callAccepted", data.signal);
    });

    /**
     * END CALL
     * Payload: { id } (Can be userId or socketId)
     */
    socket.on("endCall", ({ id }) => {
        // Smart Check: Resolve socket ID whether user sent DB ID or Socket ID
        const socketIdToEnd = userSocketMap[id] || id;
        if (socketIdToEnd) {
            io.to(socketIdToEnd).emit("callEnded");
        }
    });


    // ==========================================
    // --- FEATURE: Messaging & Status ---
    // ==========================================

    socket.on("messageReceivedConfirm", ({ messageId, senderId, receiverId }) => {
        const senderSocket = userSocketMap[senderId];
        if (senderSocket) {
            io.to(senderSocket).emit("messageDelivered", { messageId, toUserId: receiverId });
        }
    });

    socket.on("typing", (receiverId) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) io.to(receiverSocketId).emit("typing");
    });

    socket.on("stop typing", (receiverId) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) io.to(receiverSocketId).emit("stop typing");
    });

    socket.on("toggleOnlineStatus", async ({ isHidden }) => {
        if (isHidden) hiddenUsers.add(userId);
        else hiddenUsers.delete(userId);

        await emitOnlineUsers();
    });


    // ==========================================
    // --- FEATURE: Group Chats ---
    // ==========================================

    socket.on("joinGroup", (groupId) => {
        if (!groupId) return;
        socket.join(groupId);
        // console.debug(`[Group] ${userId} joined ${groupId}`);
    });

    socket.on("leaveGroup", (groupId) => {
        if (!groupId) return;
        socket.leave(groupId);
    });

    socket.on("typingGroup", ({ groupId, username, image }) => {
        socket.to(groupId).emit("typingGroup", { username, image });
    });

    socket.on("stop typingGroup", (groupId) => {
        socket.to(groupId).emit("stop typingGroup");
    });


    // ==========================================
    // --- Disconnect Handler ---
    // ==========================================

    socket.on("disconnect", async () => {
        console.log(`❌ User Disconnected: ${userId}`);

        if (userId) {
            // Update Last Seen in DB
            try {
                await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
            } catch (error) {
                console.error("[Socket] Error updating lastSeen:", error);
            }

            // Cleanup Memory
            delete userSocketMap[userId];
            hiddenUsers.delete(userId);

            // Broadcast updated list
            await emitOnlineUsers();
        }
    });
});

export { app, io, server };