/**
 * @fileoverview Post Schema - Core model for user-generated content.
 * Handles text, media, and social interactions (likes, comments, shares).
 * Includes optimized indexing for feed generation and validation hooks.
 * @version 1.1.0
 * @author Senior Backend Architect
 */

import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
    {
        // --- Ownership ---
        /**
         * The user who created the post.
         * Indexed for fast retrieval of specific user profiles/timelines.
         */
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // --- Content ---
        content: {
            type: String,
            trim: true,
            default: "",
        },

        /**
         * Array of image URLs hosted on external service (e.g., ImageKit/Cloudinary).
         */
        image_urls: [
            {
                type: String,
            },
        ],

        post_type: {
            type: String,
            enum: ["text", "image", "video"],
            default: "text",
        },

        // --- Visibility ---
        isHidden: {
            type: Boolean,
            default: false,
        },

        // --- Social Interactions (Arrays of References) ---
        // Note: arrays store user IDs. For massive scale, consider separate collections.

        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        comments: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Comment",
            },
        ],

        shares: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        saves: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
    },
    {
        timestamps: true, // Automatically manages createdAt and updatedAt
    }
);

// ==========================================
// --- Indexes (Performance Optimization) ---
// ==========================================

// 1. Compound Index for User Timelines
// Optimizes queries like: "Get all posts by User X, sorted by newest."
postSchema.index({ user: 1, createdAt: -1 });

// 2. Global Feed Index
// Optimizes "Get all posts" queries for the general discovery feed.
postSchema.index({ createdAt: -1 });

// ==========================================
// --- Middleware (Validation Logic) ---
// ==========================================

/**
 * Pre-validate Hook
 * Ensures a post is not empty (must contain either text content OR images).
 */
postSchema.pre("validate", function (next) {
    const hasContent = this.content && this.content.trim().length > 0;
    const hasImages = this.image_urls && this.image_urls.length > 0;

    if (!hasContent && !hasImages) {
        next(new Error("Post cannot be empty. Must have content or images."));
    } else {
        next();
    }
});

const Post = mongoose.model("Post", postSchema);
export default Post;