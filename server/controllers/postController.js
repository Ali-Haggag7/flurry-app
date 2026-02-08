/**
 * @fileoverview Post Controller - Manages feed generation, post CRUD, and social interactions.
 * Includes complex logic for privacy, blocking, story injection, and recursive comment deletion.
 * @version 1.2.0
 * @author Senior Backend Architect
 */

import expressAsyncHandler from "express-async-handler";
import imagekit from "../configs/imagekit.js";

// --- Models ---
import Post from "../models/Post.js";
import User from "../models/User.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import Story from "../models/Story.js";
import Report from "../models/Report.js";

// ==========================================
// --- Helpers & Utilities ---
// ==========================================

const UNKNOWN_USER = {
    _id: null,
    full_name: "Unknown User",
    username: "unknown",
    profile_picture: "default_avatar_url.png",
};

/**
 * Manually populates post data to prevent N+1 queries, specifically for nested replies.
 * @param {Object} post - The raw post document.
 * @returns {Promise<Object>} The fully populated post object.
 */
const populatePostData = async (post) => {
    // 1. Collect all unique User IDs (Post Author + Comment Authors + Reply Authors)
    const userIds = new Set();
    userIds.add(post.user.toString());

    if (post.comments) {
        post.comments.forEach((c) => {
            userIds.add(c.user.toString());
            if (c.replies) {
                c.replies.forEach((r) => userIds.add(r.user.toString()));
            }
        });
    }

    // 2. Batch Fetch Users (Single DB Call)
    const users = await User.find({ _id: { $in: [...userIds] } })
        .select("_id full_name username profile_picture")
        .lean();

    // 3. Create O(1) Lookup Map
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const populatedUser = userMap.get(post.user.toString()) || UNKNOWN_USER;

    // 4. Map Data back to structure
    const populatedComments = post.comments
        ? post.comments.map((c) => {
            const commentUser = userMap.get(c.user.toString()) || UNKNOWN_USER;

            const populatedReplies = c.replies
                ? c.replies.map((r) => {
                    const replyUser = userMap.get(r.user.toString()) || UNKNOWN_USER;
                    const replyData = r.toObject ? r.toObject() : r;
                    return { ...replyData, user: replyUser };
                })
                : [];

            const commentData = c.toObject ? c.toObject() : c;
            return {
                ...commentData,
                user: commentUser,
                replies: populatedReplies,
            };
        })
        : [];

    const postData = post.toObject ? post.toObject() : post;
    return {
        ...postData,
        user: populatedUser,
        comments: populatedComments,
    };
};

/**
 * Recursively fetches IDs of a comment and all its descendants.
 * @param {string} commentId - The root comment ID.
 * @returns {Promise<string[]>} Array of ObjectId strings.
 */
const getRecursiveCommentIds = async (commentId) => {
    const children = await Comment.find({ parentId: commentId });
    let ids = [];

    for (const child of children) {
        ids.push(child._id);
        const grandChildrenIds = await getRecursiveCommentIds(child._id);
        ids = [...ids, ...grandChildrenIds];
    }
    return ids;
};

// ==========================================
// --- Feed & Retrieval Controllers ---
// ==========================================

/**
 * @desc Get Feed Posts (Unified Logic For You & Following)
 * @route GET /api/post/feed
 * @access Private
 */
export const getPostsFeed = expressAsyncHandler(async (req, res) => {
    const currentUser = req.user; // Assumes middleware attaches full user
    const { type } = req.query; // "for-you" | "following"
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // --- 1. Block Logic ---
    const blockedByMe = currentUser.blockedUsers?.map((id) => id.toString()) || [];

    // Optimized: Fetch blocking users and hidden private users in parallel if needed
    const usersWhoBlockedMe = await User.find({ blockedUsers: currentUser._id }).distinct("_id");
    const blockedByThem = usersWhoBlockedMe.map((id) => id.toString());
    const baseExcludeList = [...blockedByMe, ...blockedByThem];

    // --- 2. Query Construction ---
    const isHiddenCondition = {
        $or: [{ isHidden: false }, { isHidden: { $exists: false } }],
    };

    let query = {};

    if (type === "following") {
        query = {
            $and: [
                {
                    user: {
                        $in: currentUser.following,
                        $nin: baseExcludeList,
                    },
                },
                isHiddenCondition,
            ],
        };
    } else {
        // "For You" Logic
        const myCircle = [...currentUser.following, currentUser._id];

        // Fetch private accounts outside my circle
        const hiddenPrivateUsers = await User.find({
            isPrivate: true,
            _id: { $nin: myCircle },
        }).distinct("_id");

        const finalExcludeList = [...baseExcludeList, ...hiddenPrivateUsers];

        query = {
            $and: [
                { user: { $nin: finalExcludeList } },
                isHiddenCondition,
            ],
        };
    }

    // --- 3. Execution & Story Injection ---
    let posts = await Post.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "full_name username profile_picture isPrivate isVerified")
        .populate("comments.user", "full_name username profile_picture isVerified")
        .lean();

    // Optimized Story Fetching (Map-based O(N))
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userIdsInFeed = posts.map((p) => p.user._id);

    const activeStories = await Story.find({
        user: { $in: userIdsInFeed },
        createdAt: { $gte: twentyFourHoursAgo },
    }).lean();

    // Group stories by User ID for fast lookup
    const storiesMap = new Map();
    activeStories.forEach((story) => {
        const uid = story.user.toString();
        if (!storiesMap.has(uid)) storiesMap.set(uid, []);
        storiesMap.get(uid).push(story);
    });

    // Inject Stories into Posts
    posts = posts.map((post) => {
        const userStories = storiesMap.get(post.user._id.toString()) || [];

        const storiesWithSeenStatus = userStories.map((s) => ({
            ...s,
            seen: s.viewers
                ? s.viewers.some((v) => {
                    const viewerId = v.user ? v.user.toString() : v.toString();
                    return viewerId === currentUser._id.toString();
                })
                : false,
        }));

        return {
            ...post,
            user: {
                ...post.user,
                stories: storiesWithSeenStatus,
                hasActiveStory: userStories.length > 0,
            },
        };
    });

    const totalPosts = await Post.countDocuments(query);

    res.status(200).json({
        success: true,
        posts,
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        hasMore: totalPosts > skip + posts.length,
    });
});

/**
 * @desc Get Single Post by ID
 * @route GET /api/post/:id
 * @access Public/Private
 */
export const getPostById = expressAsyncHandler(async (req, res) => {
    const { id } = req.params;

    // Determine Viewer
    let viewerMongoId = null;
    if (req.auth) {
        const { userId: clerkId } = req.auth();
        const viewer = await User.findOne({ clerkId });
        viewerMongoId = viewer?._id;
    }

    let post = await Post.findById(id)
        .populate("user", "full_name username profile_picture isPrivate isVerified blockedUsers")
        .populate({
            path: "comments",
            populate: { path: "user", select: "full_name username profile_picture isVerified" },
        })
        .lean();

    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    // --- Deduplication Logic (Key Fix) ---
    if (post.comments && Array.isArray(post.comments)) {
        const seenIds = new Set();
        post.comments = post.comments.filter((comment) => {
            if (comment && comment._id) {
                const idStr = comment._id.toString();
                if (seenIds.has(idStr)) return false;
                seenIds.add(idStr);
                return true;
            }
            return false;
        });
    }

    // --- Privacy Check ---
    if (post.user && post.user.isPrivate) {
        const isOwner = viewerMongoId && post.user._id.toString() === viewerMongoId.toString();

        if (!isOwner && viewerMongoId) {
            // Check following status (Simplified for performance, ideally explicit query)
            const viewerData = await User.findById(viewerMongoId).select("following");
            const isFollowing = viewerData?.following?.some(
                (id) => id.toString() === post.user._id.toString()
            );

            if (!isFollowing) {
                res.status(403);
                throw new Error("This post is from a private account.");
            }
        }
    }

    // --- Story Injection ---
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stories = await Story.find({
        user: post.user._id,
        createdAt: { $gte: twentyFourHoursAgo },
    })
        .populate("user", "full_name username profile_picture isVerified")
        .lean();

    if (post.user) {
        post.user.stories = stories.map((s) => ({
            ...s,
            seen: s.viewers
                ? s.viewers.some((v) => {
                    const viewerId = v.user ? v.user.toString() : v.toString();
                    return viewerMongoId && viewerId === viewerMongoId.toString();
                })
                : false,
        }));
    }

    res.status(200).json({ success: true, post });
});

/**
 * @desc Get User Profile by ID (With Logic for Block, Follow, Connection)
 * @route GET /api/post/user/:userId
 * @access Public/Private
 */
export const getUserById = expressAsyncHandler(async (req, res) => {
    const { userId } = req.params;
    let { userId: myClerkId } = req.auth();

    // 1. Fetch Target and Viewer in Parallel
    const [targetUser, viewer] = await Promise.all([
        User.findById(userId).select("-password -email").lean(),
        User.findOne({ clerkId: myClerkId }).select(
            "connections pendingRequests sentRequests blockedUsers following followRequests"
        ),
    ]);

    if (!targetUser) {
        res.status(404);
        throw new Error("User not found.");
    }

    const targetUserIdStr = targetUser._id.toString();
    const viewerMongoId = viewer?._id.toString();

    // --- Block Logic ---
    if (viewer && viewerMongoId !== targetUserIdStr) {
        const isBlockedByMe = viewer.blockedUsers?.some((id) => id.toString() === targetUserIdStr);
        const isBlockedByTarget = targetUser.blockedUsers?.some(
            (id) => id.toString() === viewerMongoId
        );

        if (isBlockedByMe || isBlockedByTarget) {
            return res.status(200).json({
                success: true,
                user: {
                    _id: targetUser._id,
                    full_name: isBlockedByMe ? targetUser.full_name : "User Unavailable",
                    username: isBlockedByMe ? targetUser.username : "unavailable",
                    profile_picture: isBlockedByMe
                        ? targetUser.profile_picture
                        : "/avatar-placeholder.png",
                    bio: null,
                    followers: [],
                    following: [],
                    isBlockedByMe,
                    isBlockedByTarget,
                },
                posts: [],
                connectionStatus: "none",
                hasMore: false,
            });
        }
    }

    // --- Connection Status ---
    let connectionStatus = "none";
    if (viewer) {
        if (viewerMongoId === targetUserIdStr) {
            connectionStatus = "self";
        } else if (viewer.connections?.some((id) => id.toString() === targetUserIdStr)) {
            connectionStatus = "connected";
        } else if (viewer.pendingRequests?.some((id) => id.toString() === targetUserIdStr)) {
            connectionStatus = "received";
        } else if (targetUser.pendingRequests?.some((id) => id.toString() === viewerMongoId)) {
            connectionStatus = "sent";
        }
    }

    // --- Follow Status ---
    let followStatus = "none";
    if (viewer && viewerMongoId !== targetUserIdStr) {
        if (viewer.following?.some((id) => id.toString() === targetUserIdStr)) {
            followStatus = "following";
        } else if (targetUser.followRequests?.some((id) => id.toString() === viewerMongoId)) {
            followStatus = "requested";
        }
    }

    // --- Active Stories ---
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeStories = await Story.find({
        user: targetUser._id,
        createdAt: { $gte: twentyFourHoursAgo },
    })
        .populate("user", "full_name username profile_picture isVerified")
        .lean();

    targetUser.stories = activeStories.map((story) => {
        if (!viewer) return { ...story, seen: false };
        const isSeen = story.viewers?.some((v) => {
            const viewerId = v.user ? v.user.toString() : v.toString();
            return viewerId === viewerMongoId;
        });
        return { ...story, seen: isSeen };
    });

    targetUser.hasActiveStory = activeStories.length > 0;

    // --- User Posts ---
    const isOwner = viewerMongoId === targetUserIdStr;
    let postQuery = { user: targetUser._id };

    if (!isOwner) {
        postQuery.$or = [{ isHidden: false }, { isHidden: { $exists: false } }];
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find(postQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "full_name username profile_picture isVerified isPrivate")
        .populate("comments.user", "full_name username profile_picture isVerified")
        .lean();

    res.status(200).json({
        success: true,
        user: { ...targetUser, isBlockedByMe: false, isBlockedByTarget: false },
        posts,
        connectionStatus,
        followStatus,
        hasMore: posts.length === limit,
    });
});

// ==========================================
// --- CRUD Controllers ---
// ==========================================

/**
 * @desc Create New Post with Optional Images
 * @route POST /api/post/add
 * @access Private
 */
export const addPost = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { content, postType } = req.body;
    const files = req.files;

    // Retrieve Real User ID
    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }

    const hasContent = content && content.trim().length > 0;
    const hasFiles = files && files.length > 0;

    if (!hasContent && !hasFiles) {
        res.status(400);
        throw new Error("Post cannot be empty.");
    }

    // Handle Image Uploads
    let image_urls = [];
    if (hasFiles) {
        image_urls = await Promise.all(
            files.map(async (file) => {
                const response = await imagekit.upload({
                    file: file.buffer,
                    fileName: file.originalname,
                    folder: "posts",
                });
                return response.url;
            })
        );
    }

    const newPost = await Post.create({
        user: user._id,
        content: content || "",
        post_type: postType,
        image_urls,
    });

    const populatedPost = await populatePostData(newPost);

    res.status(201).json({
        success: true,
        message: "Post added successfully",
        post: populatedPost,
    });
});

/**
 * @desc Update Existing Post
 * @route PUT /api/post/:id
 * @access Private
 */
export const updatePost = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { id } = req.params;
    const { content } = req.body;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(401);
        throw new Error("User not found in database");
    }

    const post = await Post.findById(id);
    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    // Authorization Check
    if (post.user.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("You are not authorized to update this post.");
    }

    post.content = content || post.content;
    const updatedPost = await post.save();

    res.status(200).json({
        success: true,
        message: "Post updated successfully.",
        post: updatedPost,
    });
});

/**
 * @desc Delete Post
 * @route DELETE /api/post/:id
 * @access Private
 */
export const deletePost = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { id } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found.");
    }

    const post = await Post.findById(id);
    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    if (post.user.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("You are not authorized to delete this post.");
    }

    // Note: Consider deleting images from ImageKit here for full cleanup
    await Post.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: "Post deleted successfully.",
    });
});

// ==========================================
// --- Interaction Controllers ---
// ==========================================

/**
 * @desc Toggle Like on Post
 * @route POST /api/post/like/:postId
 * @access Private
 */
export const likeUnlikePost = expressAsyncHandler(async (req, res) => {
    const userId = req.user._id; // Assumes middleware attaches user
    const { id: postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    if (!post.likes) post.likes = [];

    const userIdStr = userId.toString();
    const isLiked = post.likes.some((id) => id.toString() === userIdStr);

    if (isLiked) {
        // Unlike
        post.likes = post.likes.filter((id) => id.toString() !== userIdStr);

        await Notification.findOneAndDelete({
            from_user: userId,
            post: post._id,
            type: "like",
        });
    } else {
        // Like
        post.likes.push(userId);

        // Notify if not self-like
        if (post.user.toString() !== userIdStr) {
            try {
                await Notification.create({
                    recipient: post.user,
                    sender: userId,
                    post: post._id,
                    type: "like",
                });
            } catch (error) {
                console.warn("Notification Error (Like):", error.message);
            }
        }
    }

    await post.save();

    res.status(200).json({
        success: true,
        message: isLiked ? "Post unliked" : "Post liked",
        likes: post.likes,
        likes_count: post.likes.length,
    });
});

/**
 * @desc Add Comment or Reply
 * @route POST /api/post/comment/:postId
 * @access Private
 */
export const addComment = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { postId } = req.params;
    const { text, parentId } = req.body;

    if (!text || text.trim().length === 0) {
        res.status(400);
        throw new Error("Comment text is required.");
    }

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found.");
    }

    const post = await Post.findById(postId);
    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    let newComment = await Comment.create({
        user: currentUser._id,
        post: postId,
        text,
        parentId: parentId || null,
    });

    newComment = await newComment.populate("user", "username full_name profile_picture");
    await Post.findByIdAndUpdate(postId, { $push: { comments: newComment._id } });

    // Notification
    if (post.user.toString() !== currentUser._id.toString()) {
        try {
            await Notification.create({
                recipient: post.user,
                sender: currentUser._id,
                type: parentId ? "reply" : "comment",
                post: post._id,
                commentId: newComment._id,
            });
        } catch (error) {
            console.warn("Notification Error (Comment):", error.message);
        }
    }

    res.status(201).json({
        success: true,
        message: parentId ? "Reply added successfully" : "Comment added successfully",
        comment: newComment,
    });
});

/**
 * @desc Update Comment
 * @route PUT /api/post/comment/:commentId
 * @access Private
 */
export const updateComment = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { commentId } = req.params;
    const { text } = req.body;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }

    if (!text || text.trim().length === 0) {
        res.status(400);
        throw new Error("Comment text is required.");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        res.status(404);
        throw new Error("Comment not found.");
    }

    if (comment.user.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("You are not authorized to update this comment.");
    }

    comment.text = text;
    comment.isEdited = true;
    await comment.save();

    res.status(200).json({
        success: true,
        message: "Comment updated successfully.",
        comment: comment,
    });
});

/**
 * @desc Delete Comment (Cascade Delete for Replies)
 * @route DELETE /api/post/comment/:commentId
 * @access Private
 */
export const deleteComment = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { commentId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found.");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        res.status(404);
        throw new Error("Comment not found.");
    }

    const post = await Post.findById(comment.post);
    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    const isCommentOwner = comment.user.toString() === currentUser._id.toString();
    const isPostOwner = post.user.toString() === currentUser._id.toString();

    if (!isCommentOwner && !isPostOwner) {
        res.status(403);
        throw new Error("You are not authorized to delete this comment.");
    }

    // --- Cascade Delete Logic ---
    const childrenIds = await getRecursiveCommentIds(commentId);
    const allIdsToDelete = [comment._id, ...childrenIds];

    // Batch delete from Comment Collection
    await Comment.deleteMany({ _id: { $in: allIdsToDelete } });

    // Update Post Reference
    await Post.findByIdAndUpdate(comment.post, {
        $pull: { comments: { $in: allIdsToDelete } },
    });

    res.status(200).json({
        success: true,
        message: `Comment and ${childrenIds.length} replies deleted successfully.`,
        deletedCount: allIdsToDelete.length,
    });
});

/**
 * @desc Toggle Like on Comment
 * @route POST /api/post/comment/like/:commentId
 * @access Private
 */
export const toggleCommentLike = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { commentId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        res.status(404);
        throw new Error("Comment not found.");
    }

    if (!comment.likes) comment.likes = [];

    const userIdStr = currentUser._id.toString();
    const isLiked = comment.likes.some((id) => id.toString() === userIdStr);

    if (isLiked) {
        comment.likes = comment.likes.filter((id) => id.toString() !== userIdStr);
    } else {
        comment.likes.push(currentUser._id);
    }

    await comment.save();

    res.status(200).json({
        success: true,
        message: isLiked ? "Comment unliked" : "Comment liked",
        likes_count: comment.likes.length,
    });
});

/**
 * @desc Share Post
 * @route POST /api/post/share/:id
 * @access Private
 */
export const sharePost = expressAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.auth();

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }

    const post = await Post.findById(id);
    if (!post) {
        res.status(404);
        throw new Error("Post not found");
    }

    const updatedPost = await Post.findByIdAndUpdate(
        id,
        { $push: { shares: currentUser._id } },
        { new: true }
    );

    if (post.user.toString() !== currentUser._id.toString()) {
        try {
            await Notification.create({
                recipient: post.user,
                sender: currentUser._id,
                type: "share",
                post: post._id,
            });
        } catch (error) {
            console.warn("Notification Error (Share):", error.message);
        }
    }

    res.status(200).json(updatedPost);
});

/**
 * @desc Toggle Save Post
 * @route PUT /api/post/save/:id
 * @access Private
 */
export const togglePostSave = expressAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.auth();

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }

    const post = await Post.findById(id);
    if (!post) {
        res.status(404);
        throw new Error("Post not found");
    }

    const isSaved = post.saves.includes(currentUser._id);

    if (isSaved) {
        post.saves.pull(currentUser._id);
    } else {
        post.saves.push(currentUser._id);
    }

    await post.save();

    res.status(200).json({
        success: true,
        message: isSaved ? "Post unsaved successfully" : "Post saved successfully",
        saves: post.saves,
        saves_count: post.saves.length,
    });
});

/**
 * @desc Get Saved Posts
 * @route GET /api/post/saved
 * @access Private
 */
export const getSavedPosts = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found.");
    }

    const query = {
        saves: currentUser._id,
        $or: [{ isHidden: false }, { isHidden: { $exists: false } }],
    };

    let posts = await Post.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "full_name username profile_picture isPrivate isVerified")
        .populate("comments.user", "full_name username profile_picture")
        .lean();

    // Consistent Story Injection Logic
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userIdsInFeed = posts.map((p) => p.user._id);

    const activeStories = await Story.find({
        user: { $in: userIdsInFeed },
        createdAt: { $gte: twentyFourHoursAgo },
    }).lean();

    // Map optimized lookup
    const storiesMap = new Map();
    activeStories.forEach(story => {
        const uid = story.user.toString();
        if (!storiesMap.has(uid)) storiesMap.set(uid, []);
        storiesMap.get(uid).push(story);
    });

    posts = posts.map((post) => {
        const userStories = storiesMap.get(post.user._id.toString()) || [];
        const storiesWithSeenStatus = userStories.map((s) => ({
            ...s,
            seen: s.viewers
                ? s.viewers.some((v) => v.toString() === currentUser._id.toString())
                : false,
        }));

        return {
            ...post,
            user: {
                ...post.user,
                stories: storiesWithSeenStatus,
                hasActiveStory: userStories.length > 0,
            },
        };
    });

    const totalPosts = await Post.countDocuments(query);

    res.status(200).json({
        success: true,
        posts,
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        hasMore: totalPosts > skip + posts.length,
    });
});

/**
 * @desc Report a Post
 * @route POST /api/post/report/:id
 * @access Private
 */
export const reportPost = expressAsyncHandler(async (req, res) => {
    const { id: postId } = req.params;
    const { userId } = req.auth(); // Clerk ID
    const { reason } = req.body;

    // 1. a map of reasons to their translated versions
    const REASON_MAP = {
        "spam": "Spam",
        "harassment": "Harassment",
        "hateSpeech": "Hate Speech",
        "violence": "Violence",
        "nudity": "Nudity",
        "other": "Other"
    };

    const formattedReason = REASON_MAP[reason] || "Other";

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }

    const post = await Post.findById(postId);
    if (!post) {
        res.status(404);
        throw new Error("Post not found");
    }

    const isAlreadyReported = post.reports.includes(currentUser._id);

    if (isAlreadyReported) {
        res.status(400);
        throw new Error("You have already reported this post");
    }

    await Report.create({
        reporter: currentUser._id,
        targetPost: postId,
        reason: formattedReason,
    });

    const updatedPost = await Post.findByIdAndUpdate(
        postId,
        {
            $addToSet: { reports: currentUser._id }
        },
        { new: true }
    );

    const REPORT_THRESHOLD = 5;

    if (updatedPost.reports.length >= REPORT_THRESHOLD) {
        updatedPost.isHidden = true;
        await updatedPost.save();
        console.log(`🚨 Auto-Moderation: Post ${postId} hidden due to high reports.`);
    }

    res.status(201).json({
        success: true,
        message: "Report submitted successfully.",
    });
});