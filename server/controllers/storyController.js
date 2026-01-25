/**
 * @fileoverview Story Controller - Manages ephemeral content (Stories).
 * Handles uploading, feed generation, viewing logic, and cleanup tasks via Inngest.
 * @version 1.2.0
 * @author Senior Backend Architect
 */

import expressAsyncHandler from "express-async-handler";
import { inngest } from "../inngest/index.js";
import imagekit from "../configs/imagekit.js";

// --- Models ---
import Story from "../models/Story.js";
import User from "../models/User.js";

// ==========================================
// --- Helpers & Utilities ---
// ==========================================

/**
 * Calculates the timestamp for 24 hours ago.
 * @returns {Date}
 */
const getTwentyFourHoursAgo = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

/**
 * cleans the viewers array by removing nulls and duplicates.
 * @param {Array} viewers - The raw viewers array from the DB.
 * @returns {Array} Cleaned array of viewer objects.
 */
const cleanViewersList = (viewers) => {
    if (!viewers || viewers.length === 0) return [];

    const uniqueViewers = [];
    const seenIds = new Set();

    for (const v of viewers) {
        // validation: ensure object and user exist
        if (!v || !v.user) continue;

        const vId = v.user.toString();
        if (!seenIds.has(vId)) {
            seenIds.add(vId);
            uniqueViewers.push(v);
        }
    }
    return uniqueViewers;
};

// ==========================================
// --- Controllers ---
// ==========================================

/**
 * @desc Add a new story (Text or Media)
 * @route POST /api/story/add
 * @access Private
 */
export const addStory = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { content, type, backgroundColor, caption } = req.body;
    const file = req.file;

    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found. Please sync account.");
    }

    // --- Validation ---
    if (type === "text" && (!content || content.trim().length === 0)) {
        res.status(400);
        throw new Error("Text story must have content.");
    }
    if (type !== "text" && !file) {
        res.status(400);
        throw new Error("Media file is required for image/video stories.");
    }

    // --- Media Upload ---
    let mediaUrl = "";



    if (file) {
        const uploadResponse = await imagekit.upload({
            file: file.buffer,
            fileName: file.originalname,
            folder: "/stories/",
        });

        // Conditional Transformation
        let transformationOptions = [];
        if (file.mimetype.startsWith("image/")) {
            transformationOptions = [{ quality: "auto" }];
        }

        mediaUrl = imagekit.url({
            path: uploadResponse.filePath,
            transformation: transformationOptions,
        });
    }

    // --- DB Creation ---
    const story = await Story.create({
        user: user._id,
        content: content || "",
        image: mediaUrl,
        type: type || "text",
        background_color: backgroundColor,
        caption,
    });

    // --- Background Job (Auto-Delete) ---
    await inngest.send({
        name: "app/story.created",
        data: {
            storyId: story._id,
        },
    });

    res.status(201).json({
        success: true,
        message: "Story added successfully",
        story,
    });
});

/**
 * @desc Get Stories Feed (Grouped by User, Sorted by Unseen)
 * @route GET /api/story/feed
 * @access Private
 */
export const getStoriesFeed = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const user = await User.findOne({ clerkId });

    if (!user) {
        res.status(404);
        throw new Error("User not found.");
    }

    const blockedList = user.blockedUsers || [];
    const blockedIdsSet = new Set(blockedList.map((id) => id.toString()));

    // Filter connections: Remove blocked users
    const relevantUserIds = [
        user._id,
        ...(user.following || []),
        ...(user.connections || []),
    ].filter((id) => !blockedIdsSet.has(id.toString()));

    const rawStories = await Story.find({
        user: {
            $in: relevantUserIds,
            $nin: blockedList,
        },
        createdAt: { $gt: getTwentyFourHoursAgo() },
    })
        .populate("user", "username full_name profile_picture isVerified")
        .populate({
            path: "viewers.user",
            select: "username full_name profile_picture",
        })
        .sort({ createdAt: 1 })
        .lean();

    // --- Grouping Logic ---
    const groupedStories = {};
    const currentUserIdStr = user._id.toString();

    rawStories.forEach((story) => {
        if (!story.user) return; // Safety check

        const storyOwnerIdStr = story.user._id.toString();
        const isOwner = storyOwnerIdStr === currentUserIdStr;

        // Determine "Viewed" Status
        const isViewedByMe = isOwner
            ? !!story.openedByOwnerAt
            : story.viewers.some(
                (v) => v.user && v.user._id.toString() === currentUserIdStr
            );

        story.isViewed = isViewedByMe;

        // Initialize Group
        if (!groupedStories[storyOwnerIdStr]) {
            groupedStories[storyOwnerIdStr] = {
                user: story.user,
                stories: [],
                hasUnseen: false,
                lastStoryTime: story.createdAt,
            };
        }

        groupedStories[storyOwnerIdStr].stories.push(story);

        // Update Group Metadata
        if (new Date(story.createdAt) > new Date(groupedStories[storyOwnerIdStr].lastStoryTime)) {
            groupedStories[storyOwnerIdStr].lastStoryTime = story.createdAt;
        }

        if (!story.isViewed) {
            groupedStories[storyOwnerIdStr].hasUnseen = true;
        }
    });

    // --- Sorting (Unseen First, Recent First) ---
    const formattedStories = Object.values(groupedStories).sort((a, b) => {
        if (a.hasUnseen !== b.hasUnseen) {
            return a.hasUnseen ? -1 : 1; // Unseen first
        }
        // Then sort by latest story time
        return new Date(b.lastStoryTime) - new Date(a.lastStoryTime);
    });

    res.status(200).json({
        success: true,
        stories: formattedStories,
    });
});

/**
 * @desc Get Active Stories for a Specific User
 * @route GET /api/story/user/:userId
 * @access Private
 */
export const getUserStories = expressAsyncHandler(async (req, res) => {
    const { userId: targetUserId } = req.params;
    let viewerId = null;

    if (req.auth) {
        const { userId: clerkId } = req.auth();
        const viewer = await User.findOne({ clerkId });
        viewerId = viewer?._id.toString();
    }

    const user = await User.findById(targetUserId).select(
        "_id full_name username profile_picture isVerified"
    );
    if (!user) {
        res.status(404);
        throw new Error("User not found.");
    }

    let stories = await Story.find({
        user: targetUserId,
        createdAt: { $gt: getTwentyFourHoursAgo() },
    })
        .populate("user", "username full_name profile_picture isVerified")
        .sort({ createdAt: 1 })
        .lean();

    // --- Calculate Seen Status ---
    stories = stories.map((story) => {
        let isSeen = false;

        if (viewerId) {
            if (story.user._id.toString() === viewerId) {
                // Viewer is Owner
                isSeen = !!story.openedByOwnerAt;
            } else {
                // Viewer is Guest
                isSeen =
                    story.viewers &&
                    story.viewers.some((v) => {
                        if (!v) return false;
                        const idToCheck = v.user ? v.user : v;
                        return idToCheck?.toString() === viewerId;
                    });
            }
        }

        return {
            ...story,
            seen: isSeen,
            isViewed: isSeen,
        };
    });

    res.status(200).json({
        success: true,
        user,
        stories,
    });
});

/**
 * @desc Mark Story as Viewed (Includes Deduplication Cleaning)
 * @route PUT /api/story/:id/view
 * @access Private
 */
export const viewStory = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { id } = req.params;

    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    const story = await Story.findById(id);
    if (!story) {
        res.status(404);
        throw new Error("Story not found");
    }

    const currentUserIdStr = user._id.toString();

    // 1. Clean Existing Viewers (Fixes Validation Errors)
    let uniqueViewers = cleanViewersList(story.viewers);

    // 2. Add New View
    const isOwner = story.user.toString() === currentUserIdStr;

    if (!isOwner) {
        // Check if I already viewed it
        const alreadyViewed = uniqueViewers.some(
            (v) => v.user.toString() === currentUserIdStr
        );

        if (!alreadyViewed) {
            uniqueViewers.push({
                user: user._id,
                viewedAt: new Date(),
                reaction: null,
            });
        }
    } else {
        // If owner, just update opened time
        if (!story.openedByOwnerAt) {
            story.openedByOwnerAt = new Date();
        }
    }

    story.viewers = uniqueViewers;
    await story.save();

    res.status(200).json({ success: true });
});

/**
 * @desc Delete Story (Manual Deletion)
 * @route DELETE /api/story/:id
 * @access Private
 */
export const deleteStory = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { id } = req.params;

    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found.");
    }

    const story = await Story.findById(id);
    if (!story) {
        res.status(404);
        throw new Error("Story not found.");
    }

    // Auth Check
    if (story.user.toString() !== user._id.toString()) {
        res.status(403);
        throw new Error("You are not authorized to delete this story.");
    }

    await Story.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: "Story deleted successfully.",
    });
});

/**
 * @desc Bulk Mark All Stories of User as Seen
 * @route PUT /api/story/mark-all-seen
 * @access Private
 */
export const handleStoriesEnd = expressAsyncHandler(async (req, res) => {
    const { targetUserId } = req.params;
    const { userId: viewerClerkId } = req.auth();

    const viewer = await User.findOne({ clerkId: viewerClerkId });
    if (!viewer) {
        res.status(404);
        throw new Error("Viewer not found");
    }

    // Update logic: Only update active stories where I am NOT the owner and haven't viewed yet
    await Story.updateMany(
        {
            user: targetUserId,
            createdAt: { $gte: getTwentyFourHoursAgo() },
            viewers: { $ne: viewer._id },
            user: { $ne: viewer._id }, // Don't mark my own as "viewed" in the viewers array
        },
        {
            $addToSet: { viewers: viewer._id },
        }
    );

    res.status(200).json({
        success: true,
        message: "All stories marked as seen successfully",
    });
});

/**
 * @desc Toggle Story Reaction
 * @route POST /api/story/:storyId/react
 * @access Private
 */
export const toggleReaction = expressAsyncHandler(async (req, res) => {
    const { storyId } = req.params;
    const { emoji } = req.body;
    const { userId: clerkId } = req.auth();

    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    const story = await Story.findById(storyId);
    if (!story) {
        res.status(404);
        throw new Error("Story not found");
    }

    // 1. Clean Data First
    story.viewers = cleanViewersList(story.viewers);

    // 2. Update/Add Reaction
    const userIdStr = user._id.toString();
    const viewerIndex = story.viewers.findIndex(
        (v) => v.user.toString() === userIdStr
    );

    if (viewerIndex > -1) {
        // Update existing
        story.viewers[viewerIndex].reaction = emoji;
        story.markModified("viewers");
    } else {
        // Create new
        story.viewers.push({
            user: user._id,
            viewedAt: new Date(),
            reaction: emoji,
        });
    }

    await story.save();

    res.status(200).json({ success: true, reaction: emoji });
});