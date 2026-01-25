/**
 * @file Story.js
 * @description Mongoose model representing User Stories.
 * Handles media types (text, image, video), viewer analytics, and interactions.
 * Includes automatic expiration (TTL) and validation middleware.
 */

import mongoose from "mongoose";

// --- Schema Definition ---
const storySchema = new mongoose.Schema(
    {
        // Author Reference
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // Media & Content
        content: {
            type: String,
            trim: true,
            default: "",
        },
        image: {
            type: String,
            default: "",
        },
        type: {
            type: String,
            enum: ["text", "image", "video"],
            default: "text",
            required: true,
        },
        background_color: {
            type: String,
            default: "#000000",
        },
        caption: {
            type: String,
            default: "",
        },

        /**
         * Viewers & Interactions
         * Consolidated array to track both views and reactions in a single entry per user.
         * Logic: Merges 'seen' and 'reacted' states to prevent data duplication.
         */
        viewers: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                viewedAt: {
                    type: Date,
                    default: Date.now,
                },
                reaction: {
                    type: String,
                    default: null, // null indicates viewed but not reacted
                },
            },
        ],

        // Analytics
        openedByOwnerAt: {
            type: Date,
            default: null,
        },

        // Metadata & TTL
        createdAt: {
            type: Date,
            default: Date.now,
            expires: 86400, // Automatically deletes document after 24 hours
        },
    },
    {
        timestamps: true,
    }
);

// --- Middleware & Validation ---

/**
 * Pre-validate hook to ensure data integrity based on Story type.
 * - Text stories must have content.
 * - Media stories must have a file path.
 */
storySchema.pre("validate", function (next) {
    // Validate Text Stories
    if (
        this.type === "text" &&
        (!this.content || this.content.trim().length === 0)
    ) {
        return next(new Error("Text story must have content."));
    }

    // Validate Media Stories
    if (
        (this.type === "image" || this.type === "video") &&
        (!this.image || this.image.trim().length === 0)
    ) {
        return next(new Error("Image/Video story must have a media file."));
    }

    next();
});

// --- Model Export ---
const Story = mongoose.model("Story", storySchema);
export default Story;