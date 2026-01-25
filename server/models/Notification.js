import mongoose from "mongoose";

/**
 * @file Notification.js
 * @description Schema for User Notifications.
 * Optimized with compound indexes for high-performance feeds and unread counts.
 */

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true // Base index
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: [
            "like", "comment", "reply", "share",       // Interactions
            "follow",                                  // Standard Follow
            "follow_request",                          // Private Account Request
            "connection_request",                      // Friend Request
            "connection_accept",                       // Friend Request Accepted
            "follow_accept"                            // Private Follow Accepted
        ],
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post"
    },
    commentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
    },
    read: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending" // Default state for request-based notifications
    }
}, {
    timestamps: true
});

// --- Performance Indexes ---

// 1. Feed Optimization: Fetch user's notifications sorted by newest first
notificationSchema.index({ recipient: 1, createdAt: -1 });

// 2. UI Optimization: Quickly count unread notifications for badges
notificationSchema.index({ recipient: 1, read: 1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;