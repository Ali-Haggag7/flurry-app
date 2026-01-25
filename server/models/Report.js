import mongoose from "mongoose";

/**
 * Report Schema
 * -------------
 * Handles content moderation by allowing users to report posts.
 * Critical for platform safety and community standard enforcement.
 *
 * @module models/Report
 */

const reportSchema = new mongoose.Schema(
    {
        // --- Associations ---

        /**
         * The user submitting the report.
         * Reference to the 'User' collection.
         */
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        /**
         * The content being reported.
         * Reference to the 'Post' collection.
         */
        targetPost: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            required: true,
        },

        // --- Report Details ---

        /**
         * Categorization of the violation.
         * Restricted to specific enum values for analytics and filtering.
         */
        reason: {
            type: String,
            required: true,
            enum: [
                "Spam",
                "Harassment",
                "Hate Speech",
                "Violence",
                "Nudity",
                "Other",
            ],
        },

        // --- Moderation State ---

        /**
         * The lifecycle of the report.
         * Used by admin dashboards to track resolution.
         */
        status: {
            type: String,
            enum: ["pending", "reviewed", "resolved"],
            default: "pending",
        },
    },
    {
        // Automatically adds 'createdAt' (submission time) and 'updatedAt'
        timestamps: true,
    }
);

// --- Database Optimizations (Indexes) ---

/**
 * 1. Admin Dashboard Performance
 * Optimization: Speeds up the query "Show me all Pending reports".
 * This is the most frequent query run by moderators.
 */
reportSchema.index({ status: 1 });

/**
 * 2. Content Safety Aggregation
 * Optimization: Allows quick counting of how many reports a specific post has.
 * Useful for auto-hiding posts that exceed a certain report threshold.
 */
reportSchema.index({ targetPost: 1 });

/**
 * 3. User Activity & Spam Prevention
 * Optimization: quickly checks if a specific user has already reported a specific post.
 * Helps the UI/Backend prevent duplicate report submissions.
 */
reportSchema.index({ reporter: 1, targetPost: 1 });

// --- Model Export ---

/**
 * Export Logic:
 * Prevents "OverwriteModelError" in serverless/hot-reload environments (e.g., Next.js).
 */
const Report = mongoose.models.Report || mongoose.model("Report", reportSchema);

export default Report;