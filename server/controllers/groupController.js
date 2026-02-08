import expressAsyncHandler from "express-async-handler";
import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";
import User from "../models/User.js";
import imagekit from "../configs/imagekit.js";
import { connections } from "./messageController.js";
import { io, getReceiverSocketId } from "../socket/socket.js";
import { sendGroupPushNotification } from "../utils/sendNotification.js";

/**
 * @file groupController.js
 * @description Production-grade controller for Group Chat Management.
 * Handles creation, membership management, messaging, and real-time events.
 */

// --- Reusable Populate Configs ---

const POPULATE_USER_MINIMAL = {
    path: "user",
    select: "full_name profile_picture username clerkId"
};

const POPULATE_OWNER = {
    path: "owner",
    select: "full_name profile_picture clerkId"
};

const POPULATE_MESSAGE_SENDER = {
    path: "sender",
    select: "full_name profile_picture username clerkId"
};

const POPULATE_REPLY_TO = {
    path: "replyTo",
    select: "text sender message_type media_url",
    populate: {
        path: "sender",
        select: "full_name username"
    }
};

// --- Controllers ---

/**
 * @desc Create a new group chat
 * @route POST /api/group/create
 * @access Private
 */
export const createGroup = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    let { name, description, memberIds } = req.body;
    const file = req.file;

    // 1. Resolve Owner
    const ownerUser = await User.findOne({ clerkId: userId });
    if (!ownerUser) {
        res.status(404);
        throw new Error("User not found");
    }

    // 2. Parse Members (Handle FormData stringification)
    if (typeof memberIds === 'string') {
        try {
            memberIds = JSON.parse(memberIds);
        } catch (e) {
            memberIds = [];
        }
    }

    // 3. Image Upload (Parallelize if needed, here sequential is fine)
    let groupImageUrl = "";
    if (file) {
        const uploadResponse = await imagekit.upload({
            file: file.buffer,
            fileName: `group-${Date.now()}-${file.originalname}`,
            folder: "/groups"
        });
        groupImageUrl = imagekit.url({
            path: uploadResponse.filePath,
            transformation: [{ quality: "auto" }, { width: "500" }]
        });
    }

    // 4. Construct Member List
    const initialMembers = [{
        user: ownerUser._id,
        role: "admin",
        status: "accepted",
        joinedAt: Date.now()
    }];

    if (Array.isArray(memberIds)) {
        // Filter duplicates and self
        const uniqueIds = [...new Set(memberIds)];
        uniqueIds.forEach(friendId => {
            if (friendId !== ownerUser._id.toString()) {
                initialMembers.push({
                    user: friendId,
                    role: "member",
                    status: "accepted" // Or "pending" if using invite system
                });
            }
        });
    }

    // 5. Create Group
    let group = await Group.create({
        name,
        description: description || "",
        group_image: groupImageUrl,
        owner: ownerUser._id,
        members: initialMembers
    });

    // 6. Populate for Frontend
    group = await group.populate([
        { path: "members.user", select: "full_name profile_picture" }
    ]);

    // 7. Notify Members (Optional: Socket Event "newGroupAdded")
    // const io = req.app.get("io");
    // initialMembers.forEach(m => { ... emit socket event ... });

    res.status(201).json({
        success: true,
        message: "Group created successfully 🎉",
        group
    });
});

/**
 * @desc Get Groups the user belongs to
 * @route GET /api/group/my-groups
 * @access Private
 */
export const getAvailableGroups = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const currentUser = await User.findOne({ clerkId: userId });

    if (!currentUser) { res.status(404); throw new Error("User not found"); }

    const groups = await Group.find({
        $or: [
            { "members.user": currentUser._id },
            { "owner": currentUser._id }
        ]
    })
        .populate("members.user", "full_name profile_picture clerkId _id")
        .populate(POPULATE_OWNER)
        .sort({ updatedAt: -1 });

    res.status(200).json({
        success: true,
        count: groups.length,
        groups
    });
});

/**
 * @desc Discover Public Groups (Not joined yet)
 * @route GET /api/group/discovery
 * @access Private
 */
export const getDiscoveryGroups = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) { res.status(404); throw new Error("User not found"); }

    const groups = await Group.find({
        $and: [
            { "members.user": { $ne: currentUser._id } },
            { "owner": { $ne: currentUser._id } }
        ]
    })
        .select("name description group_image members owner")
        .populate(POPULATE_OWNER)
        .sort({ createdAt: -1 })
        .limit(50);

    res.status(200).json(groups);
});

/**
 * @desc Join a Group
 * @route POST /api/group/join/:groupId
 * @access Private
 */
export const joinGroup = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    const [currentUser, group] = await Promise.all([
        User.findOne({ clerkId: userId }),
        Group.findById(groupId)
    ]);

    if (!currentUser) { res.status(404); throw new Error("User not found"); }
    if (!group) { res.status(404); throw new Error("Group not found"); }

    // Check Membership
    const isAlreadyMember = group.members.some(
        m => m.user.toString() === currentUser._id.toString()
    );

    if (isAlreadyMember) {
        res.status(400);
        throw new Error("You are already a member of this group");
    }

    // Add Member
    group.members.push({
        user: currentUser._id,
        role: "member",
        status: "pending" // Or "accepted" for open groups
    });

    await group.save();

    // Populate and Return
    const populatedGroup = await group.populate("members.user", "full_name profile_picture");

    res.status(200).json({
        success: true,
        message: "Join request sent successfully",
        group: populatedGroup
    });
});

/**
 * @desc Get Pending Requests
 * @route GET /api/group/requests/:groupId
 * @access Private (Owner Only)
 */
export const getGroupRequests = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    const group = await Group.findById(groupId).populate("members.user", "full_name profile_picture username");

    if (!group) { res.status(404); throw new Error("Group not found"); }

    // Authorization Check
    if (group.owner.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("Not authorized");
    }

    const requests = group.members.filter(m => m.status === "pending");

    res.status(200).json({
        success: true,
        count: requests.length,
        requests
    });
});

/**
 * @desc Respond to Join Request
 * @route PUT /api/group/request/respond
 * @access Private (Owner Only)
 */
export const respondToJoinRequest = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId, memberId, action } = req.body;

    const currentUser = await User.findOne({ clerkId: userId });
    const group = await Group.findById(groupId);

    if (!group) {
        res.status(404);
        throw new Error("Group not found");
    }

    // Authorization Check: Only owner can respond
    if (group.owner.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("Not authorized");
    }

    // Find the pending member request
    // IMPORTANT: This prevents processing the same request twice (idempotency)
    const memberIndex = group.members.findIndex(
        m => m.user.toString() === memberId && m.status === "pending"
    );

    if (memberIndex === -1) {
        res.status(404);
        throw new Error("Request not found or already processed");
    }

    if (action === "accept") {
        // Update member status
        group.members[memberIndex].status = "accepted";
        group.members[memberIndex].joinedAt = Date.now();

        // Notify Group via System Message
        const newMemberUser = await User.findById(memberId);
        if (newMemberUser) {
            const sysMsg = await GroupMessage.create({
                group: groupId,
                sender: newMemberUser._id,
                text: `${newMemberUser.full_name} has joined the group`,
                message_type: "system"
            });

            const io = req.app.get("io");
            if (io) io.to(groupId).emit("receiveGroupMessage", sysMsg);
        }
    } else {
        // Reject: Remove member from the list
        group.members.splice(memberIndex, 1);
    }

    await group.save();

    res.status(200).json({
        success: true,
        message: action === "accept" ? "Accepted" : "Rejected",
        memberId
    });
});

/**
 * @desc Get Group Details
 * @route GET /api/group/:groupId
 * @access Private (Members Only)
 */
export const getGroupDetails = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    const group = await Group.findById(groupId)
        .populate("members.user", "full_name profile_picture username bio")
        .populate(POPULATE_OWNER || "owner");

    if (!group) {
        res.status(404);
        throw new Error("Group not found");
    }

    // This handles cases where a member's account was deleted from the database
    const isMember = group.members.some(
        m => m.user && m.user._id.toString() === currentUser._id.toString() && m.status === "accepted"
    );

    if (!isMember) {
        res.status(403);
        throw new Error("Not a member");
    }

    // Filter out deleted users from the response to prevent frontend issues
    group.members = group.members.filter(m => m.user !== null);

    res.status(200).json({ success: true, group });
});

/**
 * @desc Send Group Message
 * @route POST /api/group/send
 * @access Private
 */
export const sendGroupMessage = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId, text, replyTo } = req.body;
    const file = req.file;

    // 1. Validation & Setup
    const currentUser = await User.findOne({ clerkId: userId });
    const group = await Group.findById(groupId);

    if (!group) { res.status(404); throw new Error("Group not found"); }

    // --- Chat Lock Check ---
    if (group.isChatLocked && group.owner.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("Chat is locked by admin");
    }

    const isMember = group.members.some(
        m => m.user.toString() === currentUser._id.toString() && m.status === "accepted"
    );

    if (!isMember) { res.status(403); throw new Error("Not a member"); }

    // 2. Media Handling
    let mediaUrl = "";
    let messageType = "text";

    if (file) {
        const timestamp = Date.now();
        if (file.mimetype.startsWith("image/")) {
            messageType = "image";
            const upload = await imagekit.upload({
                file: file.buffer,
                fileName: `group-img-${timestamp}-${file.originalname}`,
                folder: "/group-messages/images"
            });
            mediaUrl = imagekit.url({
                path: upload.filePath,
                transformation: [{ quality: "auto" }, { width: "800" }]
            });
        } else if (file.mimetype.startsWith("audio/")) {
            messageType = "audio";
            const upload = await imagekit.upload({
                file: file.buffer,
                fileName: `group-voice-${timestamp}.webm`,
                folder: "/group-messages/voices"
            });
            mediaUrl = upload.url;
        }
    }

    // 3. Create Message
    let newMessage = await GroupMessage.create({
        group: groupId,
        sender: currentUser._id,
        text: text || "",
        message_type: messageType,
        media_url: mediaUrl,
        replyTo: replyTo || null,
        readBy: [currentUser._id]
    });

    // 4. Populate
    newMessage = await newMessage.populate([
        { path: "sender", select: "full_name username profile_picture" },
        { path: "replyTo", select: "text media_url message_type sender" }
    ]);

    // 5. SSE & Socket Emission
    // A. SSE
    const payload = JSON.stringify(newMessage);
    group.members.forEach(member => {
        const memberId = member.user.toString();
        if (memberId !== currentUser._id.toString() && global.connections && global.connections[memberId]) {
            global.connections[memberId].write(`data: ${payload}\n\n`);
        }
    });

    // B. Socket.io
    const io = req.app.get("io");
    if (io) {
        io.to(groupId).emit("receiveGroupMessage", newMessage);
    }

    // 🔥🔥🔥 6. Group Push Notification Logic (New) 🔥🔥🔥
    try {
        const recipientIds = group.members
            .filter(m => m.user.toString() !== currentUser._id.toString() && m.status === "accepted")
            .map(m => m.user);

        if (recipientIds.length > 0) {
            let notificationBody = text;
            if (messageType === 'image') notificationBody = `📷 ${currentUser.full_name} sent a photo`;
            else if (messageType === 'audio') notificationBody = `🎤 ${currentUser.full_name} sent a voice message`;
            else notificationBody = `${currentUser.full_name}: ${text}`;

            await sendGroupPushNotification(
                recipientIds,
                group.name,
                notificationBody,
                {
                    type: "group_chat",
                    groupId: groupId,
                    groupName: group.name
                }
            );
        }
    } catch (error) {
        console.error("⚠️ Failed to send group notification:", error);
    }

    res.status(201).json({ success: true, data: newMessage });
});

/**
 * @desc Get Group Chat History
 * @route GET /api/group/messages/:groupId
 * @access Private
 */
export const getGroupMessages = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    // 🟢 Pagination Parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const currentUser = await User.findOne({ clerkId: userId });
    const group = await Group.findById(groupId);

    if (!group) { res.status(404); throw new Error("Group not found"); }

    const isMember = group.members.some(
        m => m.user.toString() === currentUser._id.toString() && m.status === "accepted"
    );

    if (!isMember) { res.status(403); throw new Error("Not a member"); }

    // 🟢 Updated Query: Sort -1, Skip, Limit
    const messages = await GroupMessage.find({ group: groupId })
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limit)
        .populate(POPULATE_MESSAGE_SENDER)
        .populate(POPULATE_REPLY_TO)
        .populate("reactions.user", "full_name username profile_picture")
        .lean(); // Using lean for performance is recommended here too

    // 🟢 Re-order to chronological
    const sortedMessages = messages.reverse();

    res.status(200).json({
        success: true,
        count: sortedMessages.length,
        messages: sortedMessages,
        hasMore: messages.length === limit // 🟢 Helper flag
    });
});

/**
 * @desc Leave Group
 * @route PUT /api/group/leave/:groupId
 * @access Private
 */
export const leaveGroup = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    const group = await Group.findById(groupId);

    if (!group) { res.status(404); throw new Error("Group not found"); }

    if (group.owner.toString() === currentUser._id.toString()) {
        res.status(400);
        throw new Error("Owner cannot leave. Transfer ownership or delete group.");
    }

    const initialCount = group.members.length;
    group.members = group.members.filter(m => m.user.toString() !== currentUser._id.toString());

    if (group.members.length === initialCount) {
        res.status(400);
        throw new Error("You are not in this group");
    }

    await group.save();

    await GroupMessage.create({
        group: groupId,
        sender: currentUser._id,
        text: `${currentUser.full_name} left the group`,
        message_type: "system"
    });

    res.status(200).json({ success: true, message: "Left successfully" });
});

/**
 * @desc Kick Member
 * @route PUT /api/group/kick
 * @access Private (Owner Only)
 */
export const removeMember = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId, memberId } = req.body;

    const currentUser = await User.findOne({ clerkId: userId });
    const group = await Group.findById(groupId);

    if (!group) { res.status(404); throw new Error("Group not found"); }
    if (group.owner.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("Not authorized");
    }
    if (memberId === group.owner.toString()) {
        res.status(400);
        throw new Error("Cannot kick yourself");
    }

    const memberIndex = group.members.findIndex(m => m.user.toString() === memberId);
    if (memberIndex === -1) {
        res.status(404);
        throw new Error("Member not found");
    }

    group.members.splice(memberIndex, 1);
    await group.save();

    // System Message
    const kickedUser = await User.findById(memberId);
    if (kickedUser) {
        await GroupMessage.create({
            group: groupId,
            sender: currentUser._id,
            text: `${kickedUser.full_name} was removed`,
            message_type: "system"
        });
    }

    res.status(200).json({ success: true, message: "Removed successfully", memberId });
});

/**
 * @desc React to Message
 * @route PUT /api/group/react
 * @access Private
 */
export const reactToGroupMessage = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { messageId, emoji } = req.body;

    const currentUser = await User.findOne({ clerkId: userId });
    const message = await GroupMessage.findById(messageId);

    if (!message) { res.status(404); throw new Error("Message not found"); }

    const existingIndex = message.reactions.findIndex(
        r => r.user.toString() === currentUser._id.toString()
    );

    if (existingIndex > -1) {
        if (message.reactions[existingIndex].emoji === emoji) {
            message.reactions.splice(existingIndex, 1); // Remove
        } else {
            message.reactions[existingIndex].emoji = emoji; // Update
        }
    } else {
        message.reactions.push({ user: currentUser._id, emoji }); // Add
    }

    await message.save();

    const populatedMessage = await message.populate({
        path: "reactions.user",
        select: "full_name username profile_picture"
    });

    const io = req.app.get("io");
    if (io) {
        io.to(message.group.toString()).emit("groupMessageReaction", {
            messageId,
            reactions: populatedMessage.reactions
        });
    }

    res.status(200).json({ success: true, reactions: populatedMessage.reactions });
});

/**
 * @desc Mark All as Read
 * @route PUT /api/group/mark-read/:groupId
 * @access Private
 */
export const markGroupMessagesRead = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });

    // Efficiently update only if needed
    const result = await GroupMessage.updateMany(
        {
            group: groupId,
            sender: { $ne: currentUser._id },
            readBy: { $ne: currentUser._id }
        },
        { $addToSet: { readBy: currentUser._id } }
    );

    if (result.modifiedCount > 0) {
        const io = req.app.get("io");
        if (io) {
            io.to(groupId).emit("groupMessagesRead", {
                groupId,
                userId: currentUser._id
            });
        }
    }

    res.status(200).json({ success: true });
});

/**
 * @desc Toggle Group Lock
 * @route PUT /api/group/toggle-lock/:groupId
 * @access Private (Owner Only)
 */
export const toggleGroupLock = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth;
    const { groupId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found");
    }

    const group = await Group.findById(groupId);
    if (!group) {
        res.status(404);
        throw new Error("Group not found");
    }

    if (group.owner.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("Not authorized: Only the group owner can lock the chat");
    }

    group.isChatLocked = !group.isChatLocked;
    await group.save();

    const io = req.app.get("io");
    if (io) {
        io.to(groupId).emit("groupUpdated", {
            groupId,
            isChatLocked: group.isChatLocked
        });

        const systemMsg = await GroupMessage.create({
            group: groupId,
            sender: currentUser._id,
            text: group.isChatLocked ? "🔒 Group chat locked by admin" : "🔓 Group chat unlocked by admin",
            message_type: "system",
            readBy: [currentUser._id]
        });
        io.to(groupId).emit("receiveGroupMessage", systemMsg);
    }

    res.status(200).json({ success: true, isChatLocked: group.isChatLocked });
});

/**
 * @desc    Delete a group message (Soft Delete)
 * @route   DELETE /api/group/message/:id
 * @access  Private
 */
export const deleteGroupMessage = expressAsyncHandler(async (req, res) => {
    const { id: messageId } = req.params;
    const { userId: clerkId } = req.auth();

    const user = await User.findOne({ clerkId });
    if (!user) { res.status(404); throw new Error("User not found"); }

    const message = await GroupMessage.findById(messageId);
    if (!message) { res.status(404); throw new Error("Message not found"); }

    // Find the group to check permissions (Admin can delete anyone's msg)
    const group = await Group.findById(message.group); // Assuming message has 'group' field
    if (!group) { res.status(404); throw new Error("Group not found"); }

    const isSender = message.sender.toString() === user._id.toString();
    const isAdmin = group.owner.toString() === user._id.toString(); // Or check admins array

    if (!isSender && !isAdmin) {
        res.status(401);
        throw new Error("Not authorized to delete this message");
    }

    // Soft Delete
    message.text = "";
    message.media_url = null;
    message.isDeleted = true;
    await message.save();

    // 🟢 Socket Notification (Broadcast to Group Room)
    try {
        if (typeof io !== 'undefined') {
            io.to(message.group.toString()).emit("groupMessageDeleted", {
                messageId,
                groupId: message.group.toString()
            });
        }
    } catch (socketError) {
        console.error("Socket emit failed:", socketError);
    }

    res.status(200).json({ success: true, message: "Group message deleted" });
});

/**
 * @desc    Edit a group message
 * @route   PUT /api/group/message/:id
 * @access  Private
 */
export const editGroupMessage = expressAsyncHandler(async (req, res) => {
    const { id: messageId } = req.params;
    const { text } = req.body;
    const { userId: clerkId } = req.auth();

    if (!text || !text.trim()) { res.status(400); throw new Error("Text required"); }

    // 1. Find User
    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404); throw new Error("User not found");
    }

    // 2. Find Message (Using GroupMessage Model)
    const message = await GroupMessage.findById(messageId);

    if (!message) {
        res.status(404); throw new Error("Group Message not found");
    }

    // Only sender can edit
    if (message.sender.toString() !== user._id.toString()) {
        res.status(401);
        throw new Error("Not authorized");
    }

    if (message.isDeleted) { res.status(400); throw new Error("Cannot edit deleted message"); }

    message.text = text;
    message.isEdited = true;
    await message.save();

    // 🟢 Socket Notification
    try {
        if (typeof io !== 'undefined') {
            io.to(message.group.toString()).emit("groupMessageUpdated", {
                messageId,
                groupId: message.group.toString(),
                newText: text,
                isEdited: true
            });
        }
    } catch (socketError) { console.error("Socket emit failed:", socketError); }

    res.status(200).json({ success: true, data: message });
});

/**
 * @desc    Create a new Poll message
 * @route   POST /api/group/poll
 * @access  Private
 */
export const createPoll = expressAsyncHandler(async (req, res) => {
    const { groupId, question, options, allowMultipleAnswers } = req.body;
    const { userId: clerkId } = req.auth();

    // 1. Validation
    if (!groupId || !question || !options || !Array.isArray(options) || options.length < 2) {
        res.status(400);
        throw new Error("Invalid poll data. Must have question and at least 2 options.");
    }

    const user = await User.findOne({ clerkId });
    if (!user) { res.status(404); throw new Error("User not found"); }

    const group = await Group.findById(groupId);
    if (!group) { res.status(404); throw new Error("Group not found"); }

    // 2. Check Membership
    const isMember = group.members.some(m => m.user.toString() === user._id.toString() && m.status === "accepted");
    if (!isMember) { res.status(403); throw new Error("You are not a member of this group"); }

    // 3. Check Chat Lock (Optional - if you want polls to respect lock)
    if (group.isChatLocked && group.owner.toString() !== user._id.toString()) {
        res.status(403); throw new Error("Chat is locked");
    }

    // 4. Create Poll Message
    // Format options: Array of strings -> Array of Objects { text, votes: [] }
    const formattedOptions = options.map(opt => ({ text: opt, votes: [] }));

    const newPoll = await GroupMessage.create({
        group: groupId,
        sender: user._id,
        message_type: "poll",
        poll: {
            question,
            options: formattedOptions,
            allowMultipleAnswers: allowMultipleAnswers || false
        },
        readBy: [user._id]
    });

    // Populate sender details for frontend
    await newPoll.populate("sender", "full_name username profile_picture image");

    // 5. Socket Emit
    try {
        const io = req.app.get("io");
        if (io) {
            io.to(groupId).emit("receiveGroupMessage", newPoll);
        }
    } catch (error) { console.error("Socket emit failed:", error); }

    res.status(201).json({ success: true, message: newPoll });
});

/**
 * @desc    Vote on a Poll
 * @route   PUT /api/group/poll/vote
 * @access  Private
 */
export const votePoll = expressAsyncHandler(async (req, res) => {
    const { messageId, optionIndex } = req.body; // optionIndex (0, 1, 2...) is safer than ID sometimes, but ID is fine too
    const { userId: clerkId } = req.auth();

    const user = await User.findOne({ clerkId });
    if (!user) { res.status(404); throw new Error("User not found"); }

    const message = await GroupMessage.findById(messageId);
    if (!message || message.message_type !== "poll") {
        res.status(404); throw new Error("Poll not found");
    }

    // Validate Option
    if (optionIndex < 0 || optionIndex >= message.poll.options.length) {
        res.status(400); throw new Error("Invalid option index");
    }

    const userIdStr = user._id.toString();
    const poll = message.poll;
    const targetOption = poll.options[optionIndex];

    // --- Voting Logic ---

    // Check if user already voted for THIS option
    const alreadyVotedThis = targetOption.votes.some(id => id.toString() === userIdStr);

    if (alreadyVotedThis) {
        // Unvote (Toggle off) - Remove user from this option
        targetOption.votes = targetOption.votes.filter(id => id.toString() !== userIdStr);
    } else {
        // Logic for Single Choice vs Multiple Choice
        if (!poll.allowMultipleAnswers) {
            // Remove vote from ALL other options first
            poll.options.forEach(opt => {
                opt.votes = opt.votes.filter(id => id.toString() !== userIdStr);
            });
        }
        // Add vote to target option
        targetOption.votes.push(user._id);
    }

    // Save changes (Mongoose detects subdoc changes)
    await message.save();

    // 🟢 Socket Emit (Live Update for Progress Bars)
    try {
        const io = req.app.get("io");
        if (io) {
            io.to(message.group.toString()).emit("pollUpdated", {
                messageId: message._id,
                poll: message.poll // Send the whole updated poll object
            });
        }
    } catch (error) { console.error("Socket emit failed:", error); }

    res.status(200).json({ success: true, poll: message.poll });
});