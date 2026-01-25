import mongoose from "mongoose";

/**
 * @file GroupMessage.js
 * @description Schema for storing messages within a group context.
 * Optimized with compound indexes for high-performance history retrieval.
 */

// --- Reaction Sub-Schema ---
// Defined separately to disable _id generation for lightweight storage
const reactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    emoji: {
        type: String,
        required: true
    }
}, { _id: false });

// --- Main Message Schema ---
const groupMessageSchema = new mongoose.Schema({
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true,
        index: true // Base index for counting/lookup
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    text: {
        type: String,
        trim: true,
        default: ""
    },
    message_type: {
        type: String,
        enum: ["text", "image", "system", "audio"],
        default: "text"
    },
    media_url: {
        type: String,
        default: ""
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMessage",
        default: null
    },
    reactions: {
        type: [reactionSchema],
        default: []
    },
    // Array of users who have seen the message
    // Note: In very large groups (10k+), consider moving this to a separate "MessageReadStatus" collection
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
}, {
    timestamps: true
});

// --- Performance Indexes ---

// 1. Compound Index: Fetch messages for a specific group sorted by time (Most common query)
groupMessageSchema.index({ group: 1, createdAt: 1 });

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
export default GroupMessage;