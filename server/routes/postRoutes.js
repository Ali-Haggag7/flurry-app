import express from 'express';
import { protect } from '../middlewares/auth.js';
import upload from '../configs/multer.js';
import {
    addPost,
    getPostsFeed,
    getSavedPosts,
    getUserById,
    getPostById,
    updatePost,
    deletePost,
    likeUnlikePost,
    sharePost,
    togglePostSave,
    reportPost,
    addComment,
    updateComment,
    deleteComment,
    toggleCommentLike
} from '../controllers/postController.js';

const postRouter = express.Router();

// ==================================================
// 1. Core Feed & Creation (Static Routes)
// ==================================================

/**
 * @route POST /api/post/add
 * @desc Create new post with up to 5 images
 */
postRouter.post('/add', protect, upload.array('images', 5), addPost);

/**
 * @route GET /api/post/feed
 * @desc Get main news feed
 */
postRouter.get('/feed', protect, getPostsFeed);

/**
 * @route GET /api/post/saved
 * @desc Get user's saved bookmarks
 */
postRouter.get("/saved", protect, getSavedPosts);

// ==================================================
// 2. User Context
// ==================================================

/**
 * @route GET /api/post/user/:userId
 * @desc Get all posts by specific user
 */
postRouter.get("/user/:userId", protect, getUserById);

// ==================================================
// 3. Post Interactions (Like, Share, Save)
// ==================================================

postRouter.put("/like/:id", protect, likeUnlikePost);
postRouter.put("/share/:id", protect, sharePost);
postRouter.put("/save/:id", protect, togglePostSave);
postRouter.post("/report/:id", protect, reportPost);

// ==================================================
// 4. Comment Management
// ==================================================

/**
 * @route POST /api/post/comment/:postId
 * @desc Add comment to a post
 */
postRouter.post("/comment/:postId", protect, addComment);

/**
 * @route POST /api/post/comment/like/:commentId
 * @desc Like a specific comment
 */
postRouter.post("/comment/like/:commentId", protect, toggleCommentLike);

/**
 * @route PUT/DELETE /api/post/comment/:commentId
 * @desc Modify or remove comments
 */
postRouter.put("/comment/:commentId", protect, updateComment);
postRouter.delete("/comment/:commentId", protect, deleteComment);

// ==================================================
// 5. Single Post CRUD (Dynamic ID - MUST BE LAST)
// ==================================================

/**
 * @route GET /api/post/:id
 * @desc Get single post details
 */
postRouter.get("/:id", protect, getPostById);

/**
 * @route PUT /api/post/:id
 * @desc Update post content
 */
postRouter.put("/:id", protect, updatePost);

/**
 * @route DELETE /api/post/:id
 * @desc Delete post
 */
postRouter.delete("/:id", protect, deletePost);

export default postRouter;