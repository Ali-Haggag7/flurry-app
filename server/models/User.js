import mongoose from "mongoose";

/**
 * @file User.js
 * @description Core User Schema for Flurry.
 * Includes auth mapping (Clerk), profile data, privacy settings, and social graph.
 */

const userSchema = new mongoose.Schema({
    // --- Authentication & Identity ---
    clerkId: {
        type: String,
        required: true,
        unique: true,
        index: true // ⚡ Fast lookup for auth middleware
    },
    email: {
        type: String,
        trim: true,
        unique: true,
        required: true,
        lowercase: true, // 🛡️ Normalize email to lowercase
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.']
    },
    username: {
        type: String,
        trim: true,
        required: true,
        unique: true,
        lowercase: true, // 🛡️ Normalize username for search/URLs
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [30, 'Username cannot exceed 30 characters']
    },
    full_name: {
        type: String,
        trim: true,
        required: true
    },

    // --- Profile Details ---
    bio: {
        type: String,
        default: "Hey there! I'm using Flurry!",
        maxlength: [160, 'Bio cannot exceed 160 characters']
    },
    location: {
        type: String,
        default: "",
        trim: true
    },
    profile_picture: {
        type: String,
        default: "",
    },
    cover_photo: {
        type: String,
        default: ""
    },
    isVerified: {
        type: Boolean,
        default: false
    },

    // --- Privacy & Visibility ---
    isPrivate: {
        type: Boolean,
        default: false
    },
    hideOnlineStatus: {
        type: Boolean,
        default: false
    },

    // --- Notification Preferences ---
    notificationSettings: {
        email: {
            type: Boolean,
            default: true
        },
        push: {
            type: Boolean,
            default: true
        }
    },

    // --- Social Graph (Connections) ---
    // 1. Friends/Connections
    connections: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
    }],

    // 2. Connection Requests
    pendingRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
    }],
    sentRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
    }],

    // 3. Follow System
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
    }],
    followRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
    }],

    // 4. Moderation (Block/Mute)
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
    }],
    mutedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
    }],

    // --- Status ---
    lastSeen: {
        type: Date,
        default: Date.now
    },

    // (Notifications)
    fcmTokens: {
        type: [String], // Array of FCM tokens
        default: [],
    },
    isPushEnabled: {
        type: Boolean,
        default: true
    },

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// --- Performance Indexes ---

// 1. Search Optimization: Allow finding users by name or username efficiently
userSchema.index({ full_name: "text", username: "text" });

const User = mongoose.model("User", userSchema);

export default User;