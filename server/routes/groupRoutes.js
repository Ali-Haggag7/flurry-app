import express from 'express';
import { protect } from '../middlewares/auth.js';
import upload from '../configs/multer.js';
import {
    createGroup,
    getAvailableGroups,
    getDiscoveryGroups,
    getGroupDetails,
    joinGroup,
    leaveGroup,
    removeMember,
    getGroupRequests,
    respondToJoinRequest,
    sendGroupMessage,
    getGroupMessages,
    markGroupMessagesRead,
    reactToGroupMessage,
    toggleGroupLock,
    deleteGroupMessage,
    editGroupMessage,
    createPoll,
    votePoll
} from '../controllers/groupController.js';

const groupRouter = express.Router();

// =========================================================
// 1. Group Management & Discovery
// =========================================================

/**
 * @route POST /api/group/create
 * @desc Create a new group (with optional image)
 */
groupRouter.post('/create', protect, upload.single('image'), createGroup);

/**
 * @route GET /api/group/my-groups
 * @desc Get groups the user belongs to or owns
 */
groupRouter.get('/my-groups', protect, getAvailableGroups);

/**
 * @route GET /api/group/discovery
 * @desc Get public groups to join
 */
groupRouter.get('/discovery', protect, getDiscoveryGroups);

// =========================================================
// 2. Chat & Real-time Messaging
// =========================================================

/**
 * @route POST /api/group/send
 * @desc Send text or media message to a group
 */
groupRouter.post('/send', protect, upload.single('file'), sendGroupMessage);

/**
 * @route POST /api/group/poll
 * @desc Create a new Poll message
 */
groupRouter.post("/poll", protect, createPoll);

/**
 * @route PUT /api/group/poll/vote
 * @desc Vote on a Poll
 */
groupRouter.put("/poll/vote", protect, votePoll);

/**
 * @route GET /api/group/messages/:groupId
 * @desc Fetch chat history
 */
groupRouter.get('/messages/:groupId', protect, getGroupMessages);

/**
 * @route PUT /api/group/read/:groupId
 * @desc Mark messages as read
 */
groupRouter.put("/read/:groupId", protect, markGroupMessagesRead);

/**
 * @route POST /api/group/react
 * @desc Add/Remove reaction to a message
 */
groupRouter.post("/react", protect, reactToGroupMessage);

/**
 * @route DELETE /api/group/message/:id
 * @desc Delete a message
 */
groupRouter.delete("/message/:id", protect, deleteGroupMessage);

/**
 * @route PUT /api/group/message/:id
 * @desc Edit a message
 */
groupRouter.put("/message/:id", protect, editGroupMessage);

// =========================================================
// 3. Membership Actions (Join/Leave)
// =========================================================

groupRouter.post('/join/:groupId', protect, joinGroup);
groupRouter.put('/leave/:groupId', protect, leaveGroup);

// =========================================================
// 4. Administration (Owner/Admin Only)
// =========================================================

groupRouter.put('/kick', protect, removeMember);
groupRouter.get('/requests/:groupId', protect, getGroupRequests);
groupRouter.put('/request/respond', protect, respondToJoinRequest);
groupRouter.put('/toggle-lock/:groupId', protect, toggleGroupLock);

// =========================================================
// 5. General Details (Dynamic Route)
// =========================================================

/**
 * @route GET /api/group/:groupId
 * @desc Get single group info
 * @note MUST be placed last to avoid conflicts with specific routes
 */
groupRouter.get('/:groupId', protect, getGroupDetails);

export default groupRouter;