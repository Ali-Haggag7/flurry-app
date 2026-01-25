import expressAsyncHandler from "express-async-handler";
import User from "../models/User.js";

// ========================================================
// 🔐 Authentication Middleware
// ========================================================

/**
 * Middleware: protect
 * -------------------
 * The "Strict Guard".
 * 1. Verifies a valid Clerk session exists.
 * 2. Ensures the user is fully synced and exists in MongoDB.
 * 3. Attaches the full User document to `req.user` for downstream use.
 *
 * @description Use for core application routes (Posting, Commenting, etc).
 */
export const protect = expressAsyncHandler(async (req, res, next) => {
    // 1. Extract User ID from Clerk Auth context
    const { userId } = req.auth();

    if (!userId) {
        res.status(401);
        throw new Error("Unauthorized, no token");
    }

    // 2. Verify User existence in MongoDB
    // Note: Ensure 'clerkId' is indexed in your User Schema for performance.
    const user = await User.findOne({ clerkId: userId });

    if (!user) {
        res.status(401);
        // Critical: Indicates a desync between Auth Provider (Clerk) and Database
        throw new Error("User not found in database (Sync Error)");
    }

    // 3. Attach user to request context
    req.user = user;
    next();
});

/**
 * Middleware: verifyToken
 * -----------------------
 * The "Lenient Guard".
 * 1. Verifies a valid Clerk session exists.
 * 2. DOES NOT check the database.
 *
 * @description Use for Synchronization logic or Onboarding where the DB record might not exist yet.
 */
export const verifyToken = expressAsyncHandler(async (req, res, next) => {
    // 1. Extract User ID
    const { userId } = req.auth();

    // 2. Validate Token presence
    if (!userId) {
        res.status(401);
        throw new Error("Unauthorized, no Clerk token");
    }

    // 3. Pass control to controller (No DB lookup performed)
    next();
});