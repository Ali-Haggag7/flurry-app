/**
 * @file connectionController.js
 * @description Controller for managing user relationships: requests, connections, blocks, and unfriending.
 * Integrates real-time Socket.io events and automated email notifications.
 * @module Controllers/Connection
 */

import mongoose from "mongoose";
import expressAsyncHandler from "express-async-handler";
import Connection from "../models/Connection.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import sendEmail from "../utils/sendEmail.js";
import { io, getReceiverSocketId } from "../socket/socket.js";

// --- Internal Helpers (Decomposition) ---

/**
 * Helper to emit socket notifications safely
 */
const emitSocketNotification = (receiverId, event, data) => {
    const socketId = getReceiverSocketId(receiverId);
    if (socketId) {
        io.to(socketId).emit(event, data);
        console.log(`📡 Socket event [${event}] sent to UID: ${receiverId}`);
    }
};

/**
 * Helper to handle connection emails
 */
const sendConnectionEmail = async (receiver, sender, type) => {
    if (!receiver.notificationSettings?.email) return;

    try {
        const profileUrl = `${process.env.CLIENT_URL}/profile/${sender.username}`;
        const subjects = {
            request: `New Connection Request from ${sender.full_name} 👥`,
            accept: `Connection Accepted: You are now connected with ${sender.full_name}! 🎉`
        };

        const htmlContent = type === 'request'
            ? `<h2>Hello ${receiver.full_name.split(" ")[0]}!</h2><p><strong>${sender.full_name}</strong> wants to connect with you on Flurry.</p><a href="${profileUrl}">View Profile</a>`
            : `<h2>Good News! 🥳</h2><p><strong>${sender.full_name}</strong> accepted your connection request.</p><a href="${profileUrl}">Visit Profile</a>`;

        sendEmail({
            to: receiver.email,
            subject: subjects[type],
            html: `<div style="font-family: Arial, sans-serif; padding: 20px;">${htmlContent}</div>`
        });
    } catch (error) {
        console.error("📧 Email dispatch failed:", error);
    }
};

// --- Controllers ---

/**
 * @desc Send Connection Request
 * @route /api/connection/send
 * @method POST
 */
export const sendConnectionRequest = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { receiverId } = req.body;

    if (userId === receiverId) throw new Error("You cannot send a request to yourself");

    const sender = await User.findOne({ clerkId: userId });
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
        res.status(404);
        throw new Error("User not found");
    }

    if (sender.connections.includes(receiver._id)) throw new Error("You are already connected");
    if (sender.sentRequests.includes(receiver._id)) throw new Error("Request already sent");

    // Atomic Updates for data integrity
    await Promise.all([
        User.findByIdAndUpdate(sender._id, { $addToSet: { sentRequests: receiver._id } }),
        User.findByIdAndUpdate(receiver._id, { $addToSet: { pendingRequests: sender._id } })
    ]);

    // Create persistent notification
    const notification = await Notification.create({
        recipient: receiver._id,
        sender: sender._id,
        type: "connection_request",
        status: "pending"
    });

    // Real-time Feedback
    emitSocketNotification(receiverId, "newNotification", {
        _id: notification._id,
        type: "connection_request",
        sender: {
            _id: sender._id,
            full_name: sender.full_name,
            profile_picture: sender.profile_picture,
            username: sender.username
        },
        message: "New connection request"
    });

    // Background Email Task
    sendConnectionEmail(receiver, sender, 'request');

    res.status(200).json({ success: true, message: "Connection request sent" });
});

/**
 * @desc Remove Connection Only (Unfriend)
 * @route /api/connection/remove/:userId
 * @method PUT
 */
export const removeConnection = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { userId: targetUserId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) throw new Error("User not found");

    // Execute pulls concurrently for performance
    await Promise.all([
        User.findByIdAndUpdate(currentUser._id, { $pull: { connections: targetUser._id } }),
        User.findByIdAndUpdate(targetUser._id, { $pull: { connections: currentUser._id } })
    ]);

    emitSocketNotification(targetUserId, "connectionRemoved", {
        removerId: currentUser._id,
        message: "Connection removed"
    });

    res.status(200).json({ success: true, message: "Connection removed successfully" });
});

/**
 * @desc Get User Connections & Requests
 * @route /api/connection
 * @method GET
 */
export const getUserConnections = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const publicFields = "full_name username profile_picture bio";

    const user = await User.findOne({ clerkId: userId })
        .populate("connections", publicFields)
        .populate("pendingRequests", publicFields)
        .populate("sentRequests", publicFields)
        .populate("followers", publicFields)
        .populate("following", publicFields)
        .populate("blockedUsers", publicFields);

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    res.status(200).json({
        success: true,
        data: {
            connections: user.connections || [],
            pendingRequests: user.pendingRequests || [],
            sentRequests: user.sentRequests || [],
            followers: user.followers || [],
            following: user.following || [],
            blockedUsers: user.blockedUsers || []
        }
    });
});

/**
 * @desc Accept Connection Request
 * @route /api/connection/accept/:requestId
 * @method POST
 */
export const acceptConnection = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { requestId: senderId } = req.params;

    const me = await User.findOne({ clerkId: userId });
    const sender = await User.findById(senderId);

    if (!me || !sender) throw new Error("User not found");

    // Atomic acceptance logic: Add to social sets and pull from pending/sent
    await Promise.all([
        User.findByIdAndUpdate(me._id, {
            $addToSet: { connections: sender._id, followers: sender._id, following: sender._id },
            $pull: { pendingRequests: sender._id }
        }),
        User.findByIdAndUpdate(sender._id, {
            $addToSet: { connections: me._id, followers: me._id, following: me._id },
            $pull: { sentRequests: me._id }
        })
    ]);

    // Update historical notification status
    await Notification.findOneAndUpdate(
        { recipient: me._id, sender: sender._id, type: "connection_request" },
        { status: "accepted" }
    );

    // Create success notification for the requester
    const newNotification = await Notification.create({
        recipient: sender._id,
        sender: me._id,
        type: "connection_accept",
        message: `${me.full_name} accepted your connection request`
    });

    emitSocketNotification(senderId, "newNotification", {
        _id: newNotification._id,
        type: "connection_accept",
        sender: {
            _id: me._id,
            full_name: me.full_name,
            profile_picture: me.profile_picture,
            username: me.username
        },
        message: "Connection accepted"
    });

    sendConnectionEmail(sender, me, 'accept');

    res.status(200).json({ success: true, message: "Connection accepted" });
});

/**
 * @desc Reject OR Cancel Connection Request
 * @route /api/connection/reject/:id
 * @method POST
 */
export const rejectConnectionRequest = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { id: targetUserId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) throw new Error("User not found");

    // Concurrent clean-up of all possible request states
    await Promise.all([
        User.findByIdAndUpdate(currentUser._id, {
            $pull: { pendingRequests: targetUser._id, sentRequests: targetUser._id, followRequests: targetUser._id }
        }),
        User.findByIdAndUpdate(targetUser._id, {
            $pull: { pendingRequests: currentUser._id, sentRequests: currentUser._id, followRequests: currentUser._id }
        }),
        Notification.findOneAndUpdate(
            {
                $or: [
                    { recipient: currentUser._id, sender: targetUser._id },
                    { recipient: targetUser._id, sender: currentUser._id }
                ],
                type: { $in: ["connection_request", "follow_request"] }
            },
            { status: "rejected" }
        )
    ]);

    res.status(200).json({ success: true, message: "Request removed/rejected successfully" });
});

/**
 * @desc Block User
 * @route /api/connection/block/:id
 * @method POST
 */
export const blockUser = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { id: targetUserId } = req.params;

    const currentUser = await User.findOne({ clerkId });
    if (!currentUser) throw new Error("User not found");

    const currentUserId = currentUser._id;
    if (currentUserId.toString() === targetUserId) {
        res.status(400);
        throw new Error("You cannot block yourself.");
    }

    // Comprehensive relationship termination
    await Promise.all([
        User.findByIdAndUpdate(currentUserId, {
            $addToSet: { blockedUsers: targetUserId },
            $pull: { following: targetUserId, followers: targetUserId, connections: targetUserId }
        }),
        User.findByIdAndUpdate(targetUserId, {
            $pull: { following: currentUserId, followers: currentUserId, connections: currentUserId }
        }),
        Connection.findOneAndDelete({
            $or: [
                { sender: currentUserId, receiver: targetUserId },
                { sender: targetUserId, receiver: currentUserId }
            ]
        })
    ]);

    res.status(200).json({ success: true, message: "User blocked successfully" });
});

/**
 * @desc Unblock User
 * @route /api/connection/unblock/:id
 * @method POST
 */
export const unblockUser = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { id: targetUserId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) throw new Error("User not found");

    await User.findByIdAndUpdate(currentUser._id, {
        $pull: { blockedUsers: targetUserId }
    });

    res.status(200).json({ success: true, message: "User unblocked successfully" });
});