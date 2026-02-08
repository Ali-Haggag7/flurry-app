/**
 * @fileoverview Message Schema - Defines the structure for Direct Messages (1-on-1).
 * Includes robust validation for different message types and optimized indexing for chat history.
 * @version 1.2.0
 * @author Senior Backend Architect
 */

import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        // --- Participants ---
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // --- Content ---
        text: {
            type: String,
            trim: true,
            default: "", // Default to empty string to prevent null errors
        },
        message_type: {
            type: String,
            enum: [
                "text",
                "image",
                "audio",
                "video",
                "file",
                "shared_post",
                "story_reply",
            ],
            required: true,
            default: "text",
        },
        media_url: {
            type: String,
            default: "",
        },

        // --- References (Context) ---
        sharedPostId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            default: null,
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message", // Self-referencing for threading/replies
            default: null,
        },
        replyToStoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Story",
            default: null,
        },

        // --- Delivery Status ---
        delivered: {
            type: Boolean,
            default: false,
        },
        read: {
            type: Boolean,
            default: false,
            index: true, // Optimized for "Unread Count" queries
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        isEdited: {
            type: Boolean,
            default: false
        },

        // --- Privacy & Visibility ---
        // Soft Delete: Contains IDs of users who deleted this message for themselves
        deletedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        // --- Interactions ---
        reactions: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                emoji: {
                    type: String,
                    required: true,
                },
            },
        ],
    },
    {
        timestamps: true, // Automatically manages createdAt / updatedAt
    }
);

// ==========================================
// --- Indexes (Performance Optimization) ---
// ==========================================

// 1. Compound Index for Fetching Chat History
// Allows efficiently finding messages between two specific users sorted by time.
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, sender: 1, createdAt: -1 });

// 2. Index for Pagination
// Crucial for loading messages in chunks (infinite scroll)
messageSchema.index({ createdAt: -1 });

// ==========================================
// --- Middleware (Validation Logic) ---
// ==========================================

/**
 * Pre-validate Hook
 * Ensures data integrity based on message_type before saving to DB.
 */
messageSchema.pre("validate", function (next) {
    // 🟢 1. (FIX) Skip validation if the message is deleted
    if (this.isDeleted) {
        return next();
    }

    // 2. Text Messages: Must have content if no media is attached
    if (this.message_type === "text" && !this.media_url) {
        if (!this.text || this.text.trim().length === 0) {
            return next(new Error("Text message cannot be empty without media."));
        }
    }

    // 3. Media Messages: Must have a URL
    const mediaTypes = ["image", "audio", "video", "file"];
    if (mediaTypes.includes(this.message_type)) {
        if (!this.media_url) {
            return next(
                new Error(`${this.message_type} message must have a valid media_url.`)
            );
        }
    }

    // 4. Shared Post: Must have a post ID
    if (this.message_type === "shared_post" && !this.sharedPostId) {
        return next(new Error("Shared post message must include a sharedPostId."));
    }

    // 5. Story Reply: Must have a story ID
    if (this.message_type === "story_reply" && !this.replyToStoryId) {
        return next(
            new Error("Story reply message must include a replyToStoryId.")
        );
    }

    next();
});

const Message = mongoose.model("Message", messageSchema);

export default Message;