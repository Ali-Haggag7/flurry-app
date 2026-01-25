/**
 * @fileoverview Story Routes - API endpoints for ephemeral content management.
 * Handles creation, retrieval, viewing logic, and interactions (reactions).
 * @version 1.1.0
 * @module routes/storyRouter
 */

import express from "express";
import { protect } from "../middlewares/auth.js";
import upload from "../configs/multer.js";
import {
    addStory,
    getStoriesFeed,
    getUserStories,
    deleteStory,
    viewStory,
    handleStoriesEnd,
    toggleReaction,
} from "../controllers/storyController.js";

const storyRouter = express.Router();

// ==========================================
// --- Core Features (Creation & Feed) ---
// ==========================================

/**
 * @route   POST /api/story/add
 * @desc    Upload and create a new story (Image/Video/Text).
 * Expects multipart/form-data with field name 'media'.
 * @access  Private
 */
storyRouter.post("/add", protect, upload.single("media"), addStory);

/**
 * @route   GET /api/story/feed
 * @desc    Retrieve the aggregated stories feed (grouped by user, sorted by unseen).
 * @access  Private
 */
storyRouter.get("/feed", protect, getStoriesFeed);

// ==========================================
// --- Viewing & Interactions ---
// ==========================================

/**
 * @route   PUT /api/story/:id/view
 * @desc    Mark a specific individual story as viewed.
 * @access  Private
 */
storyRouter.put("/:id/view", protect, viewStory);

/**
 * @route   PUT /api/story/mark-all-seen/:targetUserId
 * @desc    Bulk mark all active stories of a specific user as seen.
 * Triggered when a user closes the story player or finishes the stack.
 * @access  Private
 */
storyRouter.put("/mark-all-seen/:targetUserId", protect, handleStoriesEnd);

/**
 * @route   POST /api/story/:storyId/react
 * @desc    Toggle an emoji reaction on a story.
 * @access  Private
 */
storyRouter.post("/:storyId/react", protect, toggleReaction);

// ==========================================
// --- User Specific & Management ---
// ==========================================

/**
 * @route   GET /api/story/user/:userId
 * @desc    Get active stories for a specific user (Profile/Player View).
 * @access  Private
 */
storyRouter.get("/user/:userId", protect, getUserStories);

/**
 * @route   DELETE /api/story/:id
 * @desc    Delete a story manually before expiration.
 * @access  Private
 */
storyRouter.delete("/:id", protect, deleteStory);

export default storyRouter;