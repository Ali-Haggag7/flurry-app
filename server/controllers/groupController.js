import expressAsyncHandler from "express-async-handler";
import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";
import User from "../models/User.js";
import imagekit from "../configs/imagekit.js";
import { connections } from "./messageController.js";

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

    // System Message
    await GroupMessage.create({
        group: groupId,
        sender: currentUser._id,
        text: `${currentUser.full_name} has joined the group`,
        message_type: "system"
    });

    // Populate and Return
    const populatedGroup = await group.populate("members.user", "full_name profile_picture");

    res.status(200).json({
        success: true,
        message: "Joined successfully",
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
            await GroupMessage.create({
                group: groupId,
                sender: newMemberUser._id,
                text: `${newMemberUser.full_name} has joined the group`,
                message_type: "system"
            });
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
        .populate(POPULATE_OWNER);

    if (!group) { res.status(404); throw new Error("Group not found"); }

    const isMember = group.members.some(
        m => m.user._id.toString() === currentUser._id.toString() && m.status === "accepted"
    );

    if (!isMember) {
        res.status(403);
        throw new Error("Not a member");
    }

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
        POPULATE_MESSAGE_SENDER,
        POPULATE_REPLY_TO
    ]);

    // 5. SSE & Socket Emission
    // A. SSE (Direct connections)
    const payload = JSON.stringify(newMessage);
    group.members.forEach(member => {
        const memberId = member.user.toString();
        if (memberId !== currentUser._id.toString() && connections[memberId]) {
            connections[memberId].write(`data: ${payload}\n\n`);
        }
    });

    // B. Socket.io (Room based)
    const io = req.app.get("io");
    if (io) {
        io.to(groupId).emit("receiveGroupMessage", newMessage);
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

    const currentUser = await User.findOne({ clerkId: userId });
    const group = await Group.findById(groupId);

    if (!group) { res.status(404); throw new Error("Group not found"); }

    const isMember = group.members.some(
        m => m.user.toString() === currentUser._id.toString() && m.status === "accepted"
    );

    if (!isMember) { res.status(403); throw new Error("Not a member"); }

    const messages = await GroupMessage.find({ group: groupId })
        .populate(POPULATE_MESSAGE_SENDER)
        .populate(POPULATE_REPLY_TO)
        .populate("reactions.user", "full_name username profile_picture")
        .sort({ createdAt: 1 }); // Ensure consistent ordering

    res.status(200).json({
        success: true,
        count: messages.length,
        messages
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