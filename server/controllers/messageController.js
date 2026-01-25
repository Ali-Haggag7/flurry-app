import mongoose from "mongoose";
import expressAsyncHandler from "express-async-handler";
import imagekit from "../configs/imagekit.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getReceiverSocketId, io } from "../socket/socket.js";

/**
 * @file messageController.js
 * @description Production-grade controller for managing real-time chat, media handling, and SSE streams.
 * Optimized for performance with reusable population logic and strict validation.
 */

// --- Constants & Config ---

/**
 * Global SSE Connection Registry.
 * Note: In a clustered environment (Kubernetes/PM2), use Redis for session management.
 */
export const connections = {};

/**
 * Reusable Mongoose Populate Options.
 * Centralized to ensure consistency across endpoints and reduce code duplication.
 */
const POPULATE_SENDER = {
    path: "sender",
    select: "full_name profile_picture clerkId username",
};

const POPULATE_STORY = {
    path: "replyToStoryId",
    select: "image mediaUrl content type background_color",
};

const POPULATE_REPLY_TO = {
    path: "replyTo",
    select: "text sender message_type media_url",
    populate: {
        path: "sender",
        select: "full_name username",
    },
};

const POPULATE_REACTIONS = {
    path: "reactions.user",
    select: "full_name username profile_picture",
};

// Combined populate array for full message details
const FULL_MESSAGE_POPULATE = [
    POPULATE_SENDER,
    POPULATE_STORY,
    POPULATE_REPLY_TO,
    POPULATE_REACTIONS
];

// --- Controllers ---

/**
 * @desc Initialize Server-Sent Events (SSE) Stream
 * @route GET /api/message/stream/:userId
 * @access Public/Private
 */
export const sseController = (req, res) => {
    const { userId } = req.params;

    // 1. Establish SSE Headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    // Security: Ensure CORS is handled at the middleware level or uncomment below
    // res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL);

    // 2. Register Active Connection
    connections[userId] = res;

    // 3. Send Heartbeat/Handshake
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    // 4. Cleanup on Client Disconnect
    req.on("close", () => {
        if (connections[userId] === res) {
            delete connections[userId];
        }
        console.log(`[SSE] Client ${userId} disconnected`);
    });
};

/**
 * @desc Send a new message (Text, Image, Audio, or Shared Post)
 * @route POST /api/message/send
 * @access Private
 */
export const sendMessage = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { receiverId, text, sharedPostId, storyId, replyTo } = req.body;
    const file = req.file;

    // 1. Validate Sender
    const senderUser = await User.findOne({ clerkId: userId });
    if (!senderUser) {
        res.status(404);
        throw new Error("Sender not found");
    }
    const senderMongoId = senderUser._id;

    // 2. Validate Receiver (Support Clerk ID or Mongo ID)
    let receiverUser = null;
    const isMongoId = mongoose.Types.ObjectId.isValid(receiverId);

    if (isMongoId) {
        receiverUser = await User.findById(receiverId);
    } else {
        receiverUser = await User.findOne({ clerkId: receiverId });
    }

    if (!receiverUser) {
        res.status(404);
        throw new Error("Receiver not found");
    }
    const finalReceiverId = receiverUser._id;

    // 3. Privacy & Block Checks
    const isSenderBlocked = senderUser.blockedUsers.includes(finalReceiverId);
    const isReceiverBlocked = receiverUser.blockedUsers.includes(senderMongoId);

    if (isSenderBlocked || isReceiverBlocked) {
        res.status(403);
        throw new Error("You cannot send messages to this user (Blocked).");
    }

    // 4. Connection Requirement Check
    // Ensure we cast to string for accurate comparison
    const isConnected = senderUser.connections.some(
        (id) => id.toString() === finalReceiverId.toString()
    );

    if (!isConnected) {
        res.status(403);
        throw new Error("You must be connected to send messages.");
    }

    // 5. Handle Media Uploads (ImageKit)
    let mediaUrl = "";
    let messageType = "text";

    if (file) {
        const timestamp = Date.now();
        try {
            if (file.mimetype.startsWith("image")) {
                messageType = "image";
                const { url } = await imagekit.upload({
                    file: file.buffer,
                    fileName: `msg-${timestamp}`,
                    folder: "/messages/images",
                });
                mediaUrl = url;
            } else if (file.mimetype.startsWith("audio")) {
                messageType = "audio";
                const { url } = await imagekit.upload({
                    file: file.buffer,
                    fileName: `voice-${timestamp}.webm`,
                    folder: "/messages/voices",
                });
                mediaUrl = url;
            }
        } catch (uploadError) {
            res.status(500);
            throw new Error("Media upload failed");
        }
    } else if (sharedPostId) {
        messageType = "shared_post";
    } else if (storyId) {
        messageType = "story_reply";
    }

    // 6. Determine Delivery Status
    const receiverSocketId = getReceiverSocketId(finalReceiverId.toString());
    const isDelivered = !!receiverSocketId;

    // 7. Create & Populate Message
    let newMessage = await Message.create({
        sender: senderMongoId,
        receiver: finalReceiverId,
        text: text || "",
        message_type: messageType,
        media_url: mediaUrl,
        sharedPostId: sharedPostId || null,
        replyToStoryId: storyId || null,
        replyTo: replyTo || null,
        delivered: isDelivered,
        read: false,
    });

    newMessage = await newMessage.populate(FULL_MESSAGE_POPULATE);

    // 8. Real-time Emission (Socket.io)
    if (receiverSocketId) {
        io.to(receiverSocketId).emit("receiveMessage", newMessage);

        // Notify sender of delivery
        const senderSocketId = getReceiverSocketId(senderMongoId.toString());
        if (senderSocketId) {
            io.to(senderSocketId).emit("messageDelivered", { toUserId: finalReceiverId });
        }
    }

    res.status(201).json({ success: true, data: newMessage });
});

/**
 * @desc Fetch Chat History with a specific user
 * @route GET /api/message/:withUserId
 * @access Private
 */
export const getChatMessages = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { withUserId } = req.params;

    // 1. Resolve Current User
    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    const myId = user._id;

    // 2. Resolve Partner ID
    let partnerId = withUserId;
    if (!mongoose.Types.ObjectId.isValid(withUserId)) {
        const partner = await User.findOne({ clerkId: withUserId });
        if (partner) {
            partnerId = partner._id;
        } else {
            // Graceful fallback for invalid/non-existent users
            return res.status(200).json({ success: true, data: [] });
        }
    }

    // 3. Query Messages
    // Logic: (Sender=Me & Receiver=Partner) OR (Sender=Partner & Receiver=Me) AND Not Deleted
    const messages = await Message.find({
        $and: [
            {
                $or: [
                    { sender: myId, receiver: partnerId },
                    { sender: partnerId, receiver: myId },
                ],
            },
            { deletedBy: { $ne: myId } },
        ],
    })
        .sort({ createdAt: 1 }) // Chronological order
        .populate(FULL_MESSAGE_POPULATE)
        .lean(); // Convert to plain JS objects for performance

    // 4. Mark Messages as Read (Batch Update)
    const unreadMessages = messages.some(
        (msg) => msg.sender.toString() === partnerId.toString() && !msg.read
    );

    if (unreadMessages) {
        await Message.updateMany(
            { sender: partnerId, receiver: myId, read: false },
            { $set: { read: true } }
        );

        // Notify partner that I have seen their messages
        const partnerSocketId = getReceiverSocketId(partnerId.toString());
        if (partnerSocketId) {
            io.to(partnerSocketId).emit("messagesSeen", { byUserId: myId });
        }
    }

    res.status(200).json({ success: true, data: messages });
});

/**
 * @desc Get List of Recent Conversations
 * @route GET /api/message/recent
 * @access Private
 */
export const getRecentMessages = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();

    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    const myId = user._id;

    // Aggregation Pipeline for efficient grouping
    const conversations = await Message.aggregate([
        // A. Filter relevant messages
        {
            $match: {
                $or: [{ sender: myId }, { receiver: myId }],
                deletedBy: { $ne: myId },
            },
        },
        // B. Sort by newest first
        { $sort: { createdAt: -1 } },
        // C. Group by "Conversation Partner"
        {
            $group: {
                _id: {
                    $cond: {
                        if: { $eq: ["$sender", myId] },
                        then: "$receiver",
                        else: "$sender",
                    },
                },
                lastMessage: { $first: "$$ROOT" },
                unreadCount: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$receiver", myId] },
                                    { $eq: ["$read", false] },
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
            },
        },
        // D. Join with User collection
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "partnerDetails",
            },
        },
        // E. Flatten User Details
        {
            $project: {
                lastMessage: 1,
                unreadCount: 1,
                partnerRaw: { $arrayElemAt: ["$partnerDetails", 0] },
            },
        },
        // F. Final Projection & Block Logic
        {
            $project: {
                lastMessage: 1,
                unreadCount: 1,
                partner: {
                    _id: "$partnerRaw._id",
                    full_name: "$partnerRaw.full_name",
                    username: "$partnerRaw.username",
                    profile_picture: "$partnerRaw.profile_picture",
                },
                isBlockedByMe: {
                    $in: ["$partnerRaw._id", user.blockedUsers || []],
                },
                isBlockedByPartner: {
                    $in: [myId, { $ifNull: ["$partnerRaw.blockedUsers", []] }],
                },
            },
        },
        // G. Final Sort (Most recent conversation top)
        { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    res.status(200).json({ success: true, conversations });
});

/**
 * @desc Mark all messages from a sender as read
 * @route PUT /api/message/read/:senderId
 * @access Private
 */
export const markMessagesAsRead = expressAsyncHandler(async (req, res) => {
    const { senderId } = req.params;
    const { userId: clerkId } = req.auth();

    const user = await User.findOne({ clerkId });
    const myId = user._id;

    // Resolve Sender ID
    let finalSenderId = senderId;
    if (!mongoose.Types.ObjectId.isValid(senderId)) {
        const senderUser = await User.findOne({ clerkId: senderId });
        if (senderUser) finalSenderId = senderUser._id;
    }

    // Update DB
    const result = await Message.updateMany(
        { sender: finalSenderId, receiver: myId, read: false },
        { $set: { read: true } }
    );

    // Real-time Notification
    if (result.modifiedCount > 0) {
        const senderSocketId = getReceiverSocketId(finalSenderId.toString());
        if (senderSocketId) {
            io.to(senderSocketId).emit("messagesSeen", { byUserId: myId });
        }
    }

    res.status(200).json({ success: true, message: "Messages marked as read" });
});

/**
 * @desc Clear Conversation (Soft Delete)
 * @route DELETE /api/message/conversation/:targetId
 * @access Private
 */
export const deleteConversation = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { targetId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    const myId = currentUser._id;

    await Message.updateMany(
        {
            $or: [
                { sender: myId, receiver: targetId },
                { sender: targetId, receiver: myId },
            ],
        },
        {
            $addToSet: { deletedBy: myId },
        }
    );

    res.status(200).json({ success: true, message: "Chat cleared for you only" });
});

/**
 * @desc Toggle Message Reaction (Add/Remove/Update)
 * @route POST /api/message/react
 * @access Private
 */
export const reactToMessage = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { messageId, emoji } = req.body;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found");
    }

    // Find Message (Standard or Group)
    let message = await Message.findById(messageId);
    let isGroupMsg = false;

    // Optional: Add GroupMessage support if schema exists
    // if (!message) { message = await GroupMessage.findById(messageId); isGroupMsg = true; }

    if (!message) {
        res.status(404);
        throw new Error("Message not found");
    }

    // Reaction Logic
    const existingReactionIndex = message.reactions.findIndex(
        (r) => r.user.toString() === currentUser._id.toString()
    );

    if (existingReactionIndex > -1) {
        // Toggle: Remove if same emoji, Update if different
        if (message.reactions[existingReactionIndex].emoji === emoji) {
            message.reactions.splice(existingReactionIndex, 1);
        } else {
            message.reactions[existingReactionIndex].emoji = emoji;
        }
    } else {
        // Add new reaction
        message.reactions.push({ user: currentUser._id, emoji });
    }

    await message.save();

    // Populate for frontend display
    const populatedMessage = await message.populate({
        path: "reactions.user",
        select: "full_name username profile_picture",
    });

    // Broadcast Update
    const socketPayload = {
        messageId,
        reactions: populatedMessage.reactions,
    };

    const ioInstance = req.app.get("io") || io;

    if (isGroupMsg) {
        ioInstance.to(message.group.toString()).emit("messageReaction", socketPayload);
    } else {
        const receiverSocket = getReceiverSocketId(message.receiver.toString());
        const senderSocket = getReceiverSocketId(message.sender.toString());

        if (receiverSocket) ioInstance.to(receiverSocket).emit("messageReaction", socketPayload);
        if (senderSocket) ioInstance.to(senderSocket).emit("messageReaction", socketPayload);
    }

    res.status(200).json({ success: true, reactions: message.reactions });
});