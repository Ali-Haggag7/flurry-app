/**
 * @fileoverview Comment Schema - Manages post comments and nested replies.
 * Implements an Adjacency List pattern for threading (single-level or multi-level nesting)
 * via the `parentId` self-reference.
 * @version 1.0.0
 * @author Senior Backend Architect
 */

import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
    {
        // --- Associations ---

        /**
         * The Post this comment belongs to.
         * Indexed for fast retrieval of all comments for a specific post.
         */
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            required: true,
            index: true,
        },

        /**
         * The User who authored the comment.
         */
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // --- Content ---

        text: {
            type: String,
            required: true,
            trim: true,
        },

        // --- Threading (Adjacency List Pattern) ---

        /**
         * Reference to the parent comment if this is a reply.
         * - If `null`: This is a top-level root comment.
         * - If `ObjectId`: This is a reply to that specific comment.
         * Indexed to efficiently fetch replies for a specific parent.
         */
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
            default: null,
            index: true,
        },

        // --- Interaction & Status ---

        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        isEdited: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// --- Virtuals ---

/**
 * Virtual Populate: 'replies'
 * Allows populating immediate children of a comment without storing an array of IDs.
 * Usage: .populate('replies')
 */
commentSchema.virtual("replies", {
    ref: "Comment",
    localField: "_id",
    foreignField: "parentId",
});

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;