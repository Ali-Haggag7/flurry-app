import expressAsyncHandler from "express-async-handler";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import imagekit from "../configs/imagekit.js";
import sendEmail from "../utils/sendEmail.js";
import { io, getReceiverSocketId } from "../socket/socket.js";
import { clerkClient } from "@clerk/clerk-sdk-node";

/**
 * @file userController.js
 * @description Controller for User Profile, Social Graph (Follow/Block), and Settings.
 */

// =========================================================
// 1. User Synchronization & Retrieval
// =========================================================

/**
 * @desc Sync User from Clerk (Login/Signup)
 * @route POST /api/user/sync
 * @access Private
 */
export const syncUser = expressAsyncHandler(async (req, res) => {
    const { id, emailAddresses, firstName, lastName, imageUrl, image_url, username } = req.body;
    const clerkUserId = id || (req.auth?.userId);

    if (!clerkUserId) {
        res.status(400);
        throw new Error("Clerk User ID is missing");
    }

    const email = emailAddresses?.[0]?.emailAddress || req.body.email;
    const fullName = (firstName && lastName) ? `${firstName} ${lastName}` : (req.body.fullName || "User");
    const imageFromClerk = imageUrl || image_url || req.body.profile_image_url || "";
    const userNameData = username || req.body.username || email?.split("@")[0] || `user_${Date.now()}`;

    let user = await User.findOne({ clerkId: clerkUserId });

    if (user) {
        user.email = email;
        user.full_name = fullName;
        if (!user.profile_picture || user.profile_picture === "") {
            user.profile_picture = imageFromClerk;
        }
        user.username = userNameData;
        await user.save();
        return res.status(200).json({ success: true, user });
    }

    user = await User.create({
        clerkId: clerkUserId,
        email,
        full_name: fullName,
        username: userNameData,
        profile_picture: imageFromClerk
    });

    // Send Welcome Email (Background Task)
    sendEmail({
        to: email,
        subject: "Welcome to Flurry! 🚀",
        html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px; background-color: #f9fafb; border-eadius: 10px;">
                <h1 style="color: #2563eb;">Welcome ${fullName}! 👋</h1>
                <p>We are thrilled to have you on board.</p>
                <hr style="margin: 20px 0;" />
                <p style="font-size: 12px; color: #9ca3af;">Flurry Team</p>
            </div>
        `
    }).catch(console.error);

    res.status(201).json({ success: true, user });
});

/**
 * @desc Get Logged-In User Profile
 * @route GET /api/user/me
 * @access Private
 */
export const getUserData = expressAsyncHandler(async (req, res) => {
    const userId = req.user.id; // From middleware

    const user = await User.findById(userId)
        .select("-password")
        .populate("followers following connections pendingRequests sentRequests followRequests", "full_name username profile_picture isVerified");

    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: user });
});

/**
 * @desc Update User Profile
 * @route PUT /api/user/update-profile
 * @access Private
 */
export const updateUserData = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();  // Clerk ID
    let { username, bio, location, full_name } = req.body;

    // 1. Prepare Data for MongoDB
    const updatedData = {
        ...(bio && { bio }),
        ...(location && { location }),
        ...(full_name && { full_name }),
    };

    // 2. Handle Profile Picture Upload
    if (req.files?.profile_picture?.[0]) {
        const file = req.files.profile_picture[0];

        // Optimization: Append timestamp to filename to prevent browser caching issues
        const fileName = `${Date.now()}_${file.originalname}`;

        const result = await imagekit.upload({
            file: file.buffer,
            fileName: fileName
        });

        updatedData.profile_picture = imagekit.url({
            path: result.filePath,
            transformation: [{ format: "webp" }, { width: 512 }, { quality: "auto" }]
        });
    }

    // 3. Handle Cover Photo Upload
    if (req.files?.cover?.[0]) {
        const file = req.files.cover[0];

        // Optimization: Append timestamp to filename
        const fileName = `${Date.now()}_${file.originalname}`;

        const result = await imagekit.upload({
            file: file.buffer,
            fileName: fileName
        });

        updatedData.cover_photo = imagekit.url({
            path: result.filePath,
            transformation: [{ format: "webp" }, { width: 1280 }, { quality: "auto" }]
        });
    }

    // 4. Update Clerk Profile
    try {
        const clerkUpdateData = {};

        if (username) {
            const userExists = await User.findOne({ username });
            if (userExists && userExists.clerkId !== userId) {
                res.status(400);
                throw new Error("Username is already taken (Local DB check)");
            }

            clerkUpdateData.username = username;
            updatedData.username = username;
        }

        if (full_name) {
            const nameParts = full_name.trim().split(" ");
            clerkUpdateData.firstName = nameParts[0];
            clerkUpdateData.lastName = nameParts.slice(1).join(" ") || ""; // the rest as last name
        }

        if (Object.keys(clerkUpdateData).length > 0) {
            await clerkClient.users.updateUser(userId, clerkUpdateData);
        }

    } catch (error) {
        console.error("❌ Clerk Update Failed:", error);

        // if Clerk provides specific error messages, forward them
        if (error.errors && error.errors[0]?.message) {
            res.status(400);
            throw new Error(`Clerk Error: ${error.errors[0].message}`);
        } else if (error.message.includes("Username is already taken")) {
            res.status(400);
            throw new Error("Username is already taken");
        } else {
            res.status(500);
            throw new Error("Failed to update user identity in Clerk");
        }
    }

    // 5. Update Database & Return New User
    const user = await User.findOneAndUpdate(
        { clerkId: userId },
        updatedData,
        { new: true } // Important: Returns the modified document
    ).select("-password");

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    res.status(200).json({
        success: true,
        data: user, // This user object contains the NEW image URLs
        message: "Profile updated successfully"
    });
});

// =========================================================
// 2. Search & Discovery
// =========================================================

/**
 * @desc Search Users
 * @route GET /api/user/search
 * @access Private
 */
export const discoverUsers = expressAsyncHandler(async (req, res) => {
    const { query } = req.query;
    if (!query || !query.trim()) return res.json({ success: true, users: [] });

    const { userId: clerkId } = req.auth();
    const currentUser = await User.findOne({ clerkId }).select("_id blockedUsers");

    if (!currentUser) return res.json({ success: true, users: [] });

    // Escape regex characters to prevent ReDoS
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(safeQuery, "i");

    const users = await User.find({
        $and: [
            {
                $or: [
                    { username: searchRegex },
                    { full_name: searchRegex },
                    { bio: searchRegex },
                    { location: searchRegex }
                ]
            },
            { _id: { $ne: currentUser._id } },
            { _id: { $nin: currentUser.blockedUsers || [] } },
            { blockedUsers: { $ne: currentUser._id } }
        ]
    })
        .select("_id full_name username profile_picture bio isVerified location")
        .limit(20)
        .lean(); // Faster for read-only

    res.status(200).json({ success: true, users });
});

/**
 * @desc Get Public Profile
 * @route GET /api/user/:id
 * @access Public/Private
 */
export const getUserById = expressAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id).select("-password -email -clerkId -blockedUsers -mutedUsers");

    if (!user) { res.status(404); throw new Error("User not found"); }

    res.status(200).json({ success: true, user });
});

/**
 * @desc Get Followers/Following List
 * @route GET /api/user/:id/:type
 * @access Private
 */
export const getUserNetwork = expressAsyncHandler(async (req, res) => {
    const { id, type } = req.params;
    if (!['followers', 'following'].includes(type)) {
        res.status(400); throw new Error("Invalid type");
    }

    const user = await User.findById(id).populate(type, "full_name username profile_picture bio location isVerified");
    if (!user) { res.status(404); throw new Error("User not found"); }

    res.status(200).json({ success: true, users: user[type] });
});

// =========================================================
// 3. Social Graph (Follow/Unfollow)
// =========================================================

/**
 * @desc Follow User
 * @route POST /api/user/follow/:id
 * @access Private
 */
export const followUser = expressAsyncHandler(async (req, res) => {
    const { id: targetUserId } = req.params;

    // Efficient User Fetch
    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) { res.status(404); throw new Error("User not found"); }
    if (currentUser._id.equals(targetUser._id)) { res.status(400); throw new Error("Cannot follow yourself"); }

    // Case 1: Private Account (Send Request)
    if (targetUser.isPrivate) {
        if (targetUser.followRequests.includes(currentUser._id)) {
            return res.status(200).json({ success: true, status: "requested", message: "Request already sent" });
        }

        await targetUser.updateOne({ $addToSet: { followRequests: currentUser._id } });

        // Trigger Notification
        const notif = await Notification.create({
            recipient: targetUser._id,
            sender: currentUser._id,
            type: "follow_request",
            status: "pending"
        });

        // Socket Event
        const socketId = getReceiverSocketId(targetUser._id);
        if (socketId) {
            const populatedNotif = await notif.populate("sender", "full_name username profile_picture");
            io.to(socketId).emit("newNotification", populatedNotif);
        }

        return res.status(200).json({ success: true, status: "requested", message: "Follow request sent" });
    }

    // Case 2: Public Account (Direct Follow)
    await currentUser.updateOne({ $addToSet: { following: targetUser._id } });
    await targetUser.updateOne({ $addToSet: { followers: currentUser._id } });

    // Trigger Notification
    const notif = await Notification.create({
        recipient: targetUser._id,
        sender: currentUser._id,
        type: "follow"
    });

    // Socket Event
    const socketId = getReceiverSocketId(targetUser._id);
    if (socketId) {
        const populatedNotif = await notif.populate("sender", "full_name username profile_picture");
        io.to(socketId).emit("newNotification", populatedNotif);
    }

    res.status(200).json({ success: true, status: "following", message: `You are now following ${targetUser.full_name}` });
});

/**
 * @desc Unfollow User / Cancel Request
 * @route POST /api/user/unfollow/:id
 * @access Private
 */
export const unfollowUser = expressAsyncHandler(async (req, res) => {
    const { id: targetUserId } = req.params;
    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) { res.status(404); throw new Error("User not found"); }

    if (currentUser.following.includes(targetUser._id)) {
        await currentUser.updateOne({ $pull: { following: targetUser._id } });
        await targetUser.updateOne({ $pull: { followers: currentUser._id } });
        return res.status(200).json({ success: true, status: "none", message: "Unfollowed" });
    }

    if (targetUser.followRequests.includes(currentUser._id)) {
        await targetUser.updateOne({ $pull: { followRequests: currentUser._id } });
        // Also remove associated notification
        await Notification.deleteOne({ recipient: targetUser._id, sender: currentUser._id, type: "follow_request" });
        return res.status(200).json({ success: true, status: "none", message: "Request cancelled" });
    }

    res.status(400); throw new Error("You don't follow this user");
});

// =========================================================
// 4. Request Management (Accept/Decline)
// =========================================================

/**
 * @desc Accept Follow Request
 * @route POST /api/user/follow-request/accept/:id
 * @access Private
 */
export const acceptFollowRequest = expressAsyncHandler(async (req, res) => {
    const { id: requesterId } = req.params;
    const currentUser = await User.findById(req.user.id);
    const requester = await User.findById(requesterId);

    if (!currentUser || !requester) { res.status(404); throw new Error("User not found"); }

    if (!currentUser.followRequests.includes(requesterId)) {
        res.status(400); throw new Error("No request found");
    }

    // Atomic Update
    await currentUser.updateOne({
        $push: { followers: requesterId },
        $pull: { followRequests: requesterId }
    });
    await requester.updateOne({ $push: { following: currentUser._id } });

    // Create "Accept" Notification
    const notif = await Notification.create({
        recipient: requester._id,
        sender: currentUser._id,
        type: "follow_accept"
    });

    // Update Original Request Notification status
    await Notification.updateMany(
        { recipient: currentUser._id, sender: requesterId, type: "follow_request" },
        { status: "accepted" }
    );

    // Socket Event
    const socketId = getReceiverSocketId(requester._id);
    if (socketId) {
        const populatedNotif = await notif.populate("sender", "full_name username profile_picture");
        io.to(socketId).emit("newNotification", populatedNotif);
    }

    res.status(200).json({ success: true, message: "Request accepted" });
});

/**
 * @desc Decline Follow Request
 * @route POST /api/user/follow-request/decline/:id
 * @access Private
 */
export const declineFollowRequest = expressAsyncHandler(async (req, res) => {
    const { id: requesterId } = req.params;
    const currentUser = await User.findById(req.user.id);

    await currentUser.updateOne({ $pull: { followRequests: requesterId } });

    // Update Notification Status
    await Notification.updateMany(
        { recipient: currentUser._id, sender: requesterId, type: "follow_request" },
        { status: "rejected" }
    );

    res.status(200).json({ success: true, message: "Request declined" });
});

// =========================================================
// 5. Moderation (Block/Mute)
// =========================================================

/**
 * @desc Toggle Block User
 * @route PUT /api/user/block/:id
 * @access Private
 */
export const toggleBlockUser = expressAsyncHandler(async (req, res) => {
    const { id: targetId } = req.params;
    const currentUser = await User.findOne({ clerkId: req.auth().userId });

    if (!currentUser) { res.status(404); throw new Error("User not found"); }

    if (currentUser.blockedUsers.includes(targetId)) {
        await currentUser.updateOne({ $pull: { blockedUsers: targetId } });
        res.status(200).json({ success: true, message: "User unblocked", isBlocked: false });
    } else {
        await currentUser.updateOne({
            $push: { blockedUsers: targetId },
            // Optional: Unfollow on block
            $pull: { following: targetId, followers: targetId }
        });
        res.status(200).json({ success: true, message: "User blocked", isBlocked: true });
    }
});

/**
 * @desc Toggle Mute User
 * @route PUT /api/user/mute/:id
 * @access Private
 */
export const toggleMuteUser = expressAsyncHandler(async (req, res) => {
    const { id: targetId } = req.params;
    const currentUser = await User.findOne({ clerkId: req.auth().userId });

    if (currentUser.mutedUsers.includes(targetId)) {
        await currentUser.updateOne({ $pull: { mutedUsers: targetId } });
        res.status(200).json({ success: true, message: "Notifications unmuted", isMuted: false });
    } else {
        await currentUser.updateOne({ $push: { mutedUsers: targetId } });
        res.status(200).json({ success: true, message: "Notifications muted", isMuted: true });
    }
});

// =========================================================
// 6. Settings (Privacy/Notifications)
// =========================================================

/**
 * @desc Update Privacy Settings
 * @route PUT /api/user/update-privacy
 * @access Private
 */
export const updatePrivacySettings = expressAsyncHandler(async (req, res) => {
    const { isPrivate, hideOnlineStatus } = req.body;
    const user = await User.findOne({ clerkId: req.auth().userId });

    if (isPrivate !== undefined) user.isPrivate = isPrivate;
    if (hideOnlineStatus !== undefined) user.hideOnlineStatus = hideOnlineStatus;

    await user.save();
    res.status(200).json({ success: true, user: { isPrivate: user.isPrivate, hideOnlineStatus: user.hideOnlineStatus } });
});

/**
 * @desc Update Notification Settings
 * @route PUT /api/user/update-settings
 * @access Private
 */
export const updateNotificationSettings = expressAsyncHandler(async (req, res) => {
    const { email, push } = req.body;
    const user = await User.findOne({ clerkId: req.auth().userId });

    if (!user.notificationSettings) user.notificationSettings = {};
    if (email !== undefined) user.notificationSettings.email = email;
    if (push !== undefined) user.notificationSettings.push = push;

    await user.save();
    res.status(200).json({ success: true, settings: user.notificationSettings });
});


// @desc    Save FCM Token for Push Notifications
// @route   POST /api/user/fcm-token
// @access  Private
export const saveFcmToken = expressAsyncHandler(async (req, res) => {
    const { token } = req.body;
    const { userId } = req.auth();

    if (!token) {
        res.status(400);
        throw new Error("Token is required");
    }

    const user = await User.findOneAndUpdate(
        { clerkId: userId },
        { $addToSet: { fcmTokens: token } },
        { new: true }
    );

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    res.status(200).json({ success: true, message: "Token saved successfully" });
});