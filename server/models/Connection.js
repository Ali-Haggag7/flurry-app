import mongoose from "mongoose";

/**
 * Connection Schema
 * -----------------
 * Manages the relationship status between two users (Sender & Receiver).
 * Handles friend requests lifecycle: Pending -> Accepted/Rejected.
 *
 * @module models/Connection
 */

const connectionSchema = new mongoose.Schema(
    {
        // --- Relationships ---

        /**
         * The user initiating the connection request.
         * Note: Strictly uses ObjectId to reference the 'User' collection.
         */
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        /**
         * The user receiving the connection request.
         * Note: Strictly uses ObjectId to reference the 'User' collection.
         */
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // --- State Management ---

        /**
         * Current status of the connection request.
         * Limits values to specific enum for data integrity.
         */
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
        },
    },
    {
        // Automatically manages 'createdAt' and 'updatedAt'
        timestamps: true,
    }
);

// --- Database Optimizations (Indexes) ---

/**
 * 1. Data Integrity & Uniqueness
 * Constraint: A sender cannot send multiple requests to the same receiver.
 * Ensures { sender, receiver } pair is unique across the collection.
 */
connectionSchema.index({ sender: 1, receiver: 1 }, { unique: true });

/**
 * 2. Query Performance
 * Optimization: Speeds up fetching incoming requests filtered by status.
 * Target Query: "Find all pending requests for a specific receiver."
 */
connectionSchema.index({ receiver: 1, status: 1 });

// --- Model Export ---

/**
 * Export Logic:
 * Checks 'mongoose.models' first to prevent OverwriteModelError in
 * hot-reloading environments (Next.js/Serverless), otherwise compiles the model.
 */
const Connection =
    mongoose.models.Connection || mongoose.model("Connection", connectionSchema);

export default Connection;