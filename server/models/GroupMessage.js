import mongoose from "mongoose";

/**
 * @file GroupMessage.js
 * @description Schema for storing messages within a group context.
 * Updated to support Polls 📊
 */

// --- Reaction Sub-Schema ---
const reactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true }
}, { _id: false });

// --- Poll Sub-Schema (New Feature 🚀) ---
const pollOptionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }] // Array of user IDs who voted
});

const pollSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [pollOptionSchema],
    allowMultipleAnswers: { type: Boolean, default: false }
}, { _id: false }); // No separate ID for poll object, it's part of the message

// --- Main Message Schema ---
const groupMessageSchema = new mongoose.Schema({
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true,
        index: true
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
    // 🟢 Added "poll" to enum
    message_type: {
        type: String,
        enum: ["text", "image", "system", "audio", "video", "file", "shared_post", "story_reply", "poll"],
        default: "text"
    },
    media_url: {
        type: String,
        default: ""
    },
    // 🟢 Added Poll Field
    poll: {
        type: pollSchema,
        default: null
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
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    isDeleted: {
        type: Boolean,
        default: false
    },
    isEdited: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// --- Performance Indexes ---
groupMessageSchema.index({ group: 1, createdAt: -1 });

// ==========================================
// --- Middleware (Validation Logic) ---
// ==========================================
groupMessageSchema.pre("validate", function (next) {
    if (this.isDeleted) {
        return next();
    }

    // 1. Poll Validation
    if (this.message_type === "poll") {
        if (!this.poll || !this.poll.question || this.poll.options.length < 2) {
            return next(new Error("Poll must have a question and at least 2 options."));
        }
    }

    // 2. Text Messages check (Modified to ignore empty text if it's a Poll)
    if (this.message_type === "text" && !this.media_url) {
        if (!this.text || this.text.trim().length === 0) {
            return next(new Error("Text message cannot be empty without media."));
        }
    }

    next();
});

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
export default GroupMessage;