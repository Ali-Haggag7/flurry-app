import expressAsyncHandler from "express-async-handler";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { io, userSocketMap } from "../socket/socket.js";

/**
 * @file notificationController.js
 * @description Controller for managing user notifications, unread counts, and real-time alerts.
 */

// --- Constants ---
const INTERACTION_TYPES = ["like", "comment", "reply", "share", "follow", "connection_accept", "follow_accept"];
const REQUEST_TYPES = ["connection_request", "follow_request"];

// =========================================================
// 1. Fetching Notifications
// =========================================================

/**
 * @desc Get User Notifications (Paginated & Filtered)
 * @route GET /api/notifications
 * @access Private
 */
export const getUserNotifications = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { filter, page = 1, limit = 15 } = req.query;

    const user = await User.findOne({ clerkId });
    if (!user) { res.status(404); throw new Error("User not found"); }

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    // Base Query
    let query = { recipient: user._id };

    if (filter === 'requests') {
        // Filter: Connection/Follow Requests (Pending only)
        query.type = { $in: REQUEST_TYPES };
        query.status = "pending";
    } else {
        // Filter: Standard Interactions (Bell Icon)
        query.type = { $in: INTERACTION_TYPES };
    }

    // Execute Query
    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate("sender", "full_name username profile_picture")
        .populate("post", "content image")
        .populate("commentId", "text")
        .lean();

    // Pagination Metadata
    const totalCount = await Notification.countDocuments(query);
    const hasMore = totalCount > skip + notifications.length;

    res.status(200).json({ success: true, notifications, hasMore });
});

/**
 * @desc Get Unread Count (For Bell Icon 🔔)
 * @route GET /api/notifications/unread-count
 * @access Private
 */
export const getUnreadCount = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const user = await User.findOne({ clerkId });

    if (!user) {
        return res.status(200).json({ success: true, count: 0 });
    }

    // Only count interactions, excluding connection requests (which have their own counter)
    const count = await Notification.countDocuments({
        recipient: user._id,
        read: false,
        type: { $in: INTERACTION_TYPES }
    });

    res.status(200).json({ success: true, count });
});

/**
 * @desc Get Network Request Counts (For Red Dot 🔴)
 * @route GET /api/notifications/network-counts
 * @access Private
 */
export const getNetworkCounts = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const user = await User.findOne({ clerkId });

    if (!user) { return res.status(404).json({ message: "User not found" }); }

    const count = await Notification.countDocuments({
        recipient: user._id,
        type: { $in: REQUEST_TYPES },
        read: false
    });

    res.status(200).json({ count });
});

// =========================================================
// 2. Notification Management (Read/Delete)
// =========================================================

/**
 * @desc Delete a specific notification
 * @route DELETE /api/notifications/:id
 * @access Private
 */
export const deleteNotification = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { id } = req.params;

    const user = await User.findOne({ clerkId });
    const notification = await Notification.findById(id);

    if (!notification) {
        res.status(404);
        throw new Error("Notification not found");
    }

    // Authorization Check: Ensure user owns the notification
    if (notification.recipient.toString() !== user._id.toString()) {
        res.status(403);
        throw new Error("Not authorized");
    }

    await Notification.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Notification deleted" });
});

/**
 * @desc Mark a single notification as read
 * @route PUT /api/notifications/:id/read
 * @access Private
 */
export const markOneAsRead = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { id } = req.params;

    const user = await User.findOne({ clerkId });
    if (!user) { res.status(404); throw new Error("User not found"); }

    const notification = await Notification.findOneAndUpdate(
        { _id: id, recipient: user._id },
        { read: true },
        { new: true }
    );

    if (!notification) {
        res.status(404);
        throw new Error("Notification not found");
    }

    res.status(200).json({ success: true, notification });
});

/**
 * @desc Mark All (or filtered type) as Read
 * @route PUT /api/notifications/read-all
 * @access Private
 */
export const markAllAsRead = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { type } = req.query;

    const user = await User.findOne({ clerkId });
    if (!user) { res.status(404); throw new Error("User not found"); }

    let filter = { recipient: user._id, read: false };

    if (type && type !== "all") {
        filter.type = type;
    }

    await Notification.updateMany(filter, { $set: { read: true } });

    res.status(200).json({ success: true, message: "Notifications marked as read" });
});

/**
 * @desc Mark Network Requests as Read (Clears Red Dot)
 * @route PUT /api/notifications/mark-network-read
 * @access Private
 */
export const markNetworkAsRead = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const user = await User.findOne({ clerkId });

    if (!user) { res.status(404); throw new Error("User not found"); }

    await Notification.updateMany(
        {
            recipient: user._id,
            type: { $in: REQUEST_TYPES },
            read: false
        },
        { $set: { read: true } }
    );

    res.status(200).json({ success: true, message: "Network requests marked as read" });
});

// =========================================================
// 3. Helper Functions (Internal)
// =========================================================

/**
 * Internal Helper: Creates a notification and triggers real-time socket event.
 */
export const createNotification = async ({ recipient, sender, type, post, commentId, status }) => {
    try {
        // 1. Self-Action Check
        if (recipient.toString() === sender.toString()) return;

        // 2. Duplicate Check (Debounce logic, except for comments)
        if (type !== 'comment' && type !== 'reply') {
            const existing = await Notification.findOne({ recipient, sender, type, post, commentId });
            if (existing) return;
        }

        // 3. Database Creation
        const newNotification = await Notification.create({
            recipient,
            sender,
            type,
            post,
            commentId,
            status: status || "pending"
        });

        // 4. Real-time Socket Emission
        const receiverSocketId = userSocketMap[recipient.toString()];

        if (receiverSocketId) {
            const populatedNotif = await newNotification.populate("sender", "full_name username profile_picture");
            io.to(receiverSocketId).emit("newNotification", populatedNotif);
        }

    } catch (error) {
        console.error("[Notification Service Error]:", error);
    }
};