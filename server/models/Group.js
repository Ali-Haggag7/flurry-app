import mongoose from "mongoose";

/**
 * @file Group.js
 * @description Mongoose model for Chat Groups.
 * Optimized with Multikey Indexes for fast membership lookups.
 */

// --- Member Sub-Schema ---
const memberSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true, // ⚡ Optimized for "My Groups" queries
        },
        role: {
            type: String,
            enum: ["admin", "member"],
            default: "member",
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "accepted",
        },
        joinedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false } // Lightweight sub-documents (no individual ID)
);

// --- Main Group Schema ---
const groupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Group name is required"],
            trim: true,
            maxlength: [100, "Group name cannot exceed 100 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, "Description cannot exceed 500 characters"],
            default: "",
        },
        group_image: {
            type: String,
            default: "",
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true, // ⚡ Optimized for ownership checks
        },
        members: {
            type: [memberSchema],
            default: [], // Ensure it's always an array
            validate: [
                {
                    validator: function (val) {
                        return val.length <= 1000; // Hard limit example for performance
                    },
                    message: "Group cannot exceed 1000 members",
                },
            ],
        },
        isChatLocked: {
            type: Boolean,
            default: false
        },
    },
    {
        timestamps: true, // Auto-manage createdAt / updatedAt
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// --- Indexes ---
// Composite index for sorting or frequent combined queries if needed
// groupSchema.index({ updatedAt: -1 }); 

const Group = mongoose.model("Group", groupSchema);

export default Group;