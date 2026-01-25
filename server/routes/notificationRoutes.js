/**
 * @fileoverview Notification Routes - API endpoints for managing user alerts.
 * Handles fetching counts (badges), retrieving lists, and updating read statuses.
 * @version 1.1.0
 * @module routes/notificationRouter
 */

import express from "express";
import { protect } from "../middlewares/auth.js";
import {
    getUserNotifications,
    getUnreadCount,
    deleteNotification,
    markOneAsRead,
    markAllAsRead,
    getNetworkCounts,
    markNetworkAsRead,
} from "../controllers/notificationController.js";

const notificationRouter = express.Router();

// ==========================================
// --- Counts & Metrics (High Priority) ---
// ==========================================

/**
 * @route   GET /api/notification/unread-count
 * @desc    Get the total count of unread general notifications.
 * Used for the badge on the bell icon.
 * @access  Private
 */
notificationRouter.get("/unread-count", protect, getUnreadCount);

/**
 * @route   GET /api/notification/network-counts
 * @desc    Get counts for connection requests and pending network actions.
 * Used for the red dot on the "My Network" tab.
 * @access  Private
 */
notificationRouter.get("/network-counts", protect, getNetworkCounts);

// ==========================================
// --- Lists & Bulk Operations ---
// ==========================================

/**
 * @route   GET /api/notification
 * @desc    Get user notifications with pagination and filtering.
 * Query Params: ?filter=all|mentions|comments
 * @access  Private
 */
notificationRouter.get("/", protect, getUserNotifications);

/**
 * @route   PUT /api/notification/read-all
 * @desc    Mark all general notifications as read.
 * @access  Private
 */
notificationRouter.put("/read-all", protect, markAllAsRead);

/**
 * @route   PUT /api/notification/mark-network-read
 * @desc    Clear the "My Network" badge (mark requests as seen).
 * @access  Private
 */
notificationRouter.put("/mark-network-read", protect, markNetworkAsRead);

// ==========================================
// --- Individual Item Operations ---
// ==========================================

/**
 * @route   PUT /api/notification/:id/read
 * @desc    Mark a single notification as read (e.g., when clicked).
 * @access  Private
 */
notificationRouter.put("/:id/read", protect, markOneAsRead);

/**
 * @route   DELETE /api/notification/:id
 * @desc    Permanently delete a notification.
 * @access  Private
 */
notificationRouter.delete("/:id", protect, deleteNotification);

export default notificationRouter;