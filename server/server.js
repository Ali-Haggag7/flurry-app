/**
 * @file server.js
 * @description Main entry point for the Backend Server.
 * Handles Express configuration, Middleware setup, API Routes,
 * Database connection, and Serverless deployment logic for Vercel.
 * @author Ali Haggag
 */

import dotenv from "dotenv";
dotenv.config(); // Load environment variables immediately

// =========================================================
// 📦 Imports: Third Party Libraries
// =========================================================
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";

// =========================================================
// 📂 Imports: Internal Modules
// =========================================================
import connectDB from "./configs/db.js";
import { app, server } from "./socket/socket.js"; // Express 'app' is initialized in socket.js
import { inngest, functions } from "./inngest/index.js";

// =========================================================
// 🛣️ Imports: API Routes
// =========================================================
import connectionRouter from "./routes/connectionRoutes.js";
import postRouter from "./routes/postRoutes.js";
import userRouter from "./routes/userRoutes.js";
import storyRouter from "./routes/storyRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import groupRouter from "./routes/groupRoutes.js";
import gemeniRouter from "./routes/gemeniRoutes.js";

// =========================================================
// 1️⃣ Server Configuration & Security Middlewares
// =========================================================

// Trust Proxy: Required for correct IP resolution behind Load Balancers (e.g., Vercel, Nginx)
app.set("trust proxy", 1);

// Compression: Gzip response bodies to improve transfer speed
app.use(compression());

// Helmet: Sets various HTTP headers to enhance security
// configured to allow cross-origin resource loading (essential for images/media)
app.use(helmet({
    crossOriginResourcePolicy: false,
}));

// CORS Configuration: Controls access to resources from different domains
app.use(cors({
    origin: true, // Dynamically allows requests from any origin (Useful for Vercel Preview URLs)
    credentials: true, // Allows cookies and authorization headers
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Rate Limiting: Protects against DDoS and brute-force attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    message: { success: false, message: "Too many requests, please try again later." },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all API routes
app.use("/api", limiter);

// =========================================================
// 2️⃣ Webhook Handlers (Must precede body parsers)
// =========================================================

// Inngest Endpoint: Handles background jobs and event-driven functions.
// Note: This must be mounted before express.json() to handle raw request streams correctly.
app.use("/api/inngest", serve({ client: inngest, functions }));

// =========================================================
// 3️⃣ Standard Middlewares & Authentication
// =========================================================

// Body Parser: Parse incoming JSON payloads (with size limit to prevent overflow attacks)
app.use(express.json({ limit: "10mb" }));

// URL Encoded Parser: Parse URL-encoded data
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Clerk Authentication Middleware
// Secures the application by verifying session tokens.
app.use(clerkMiddleware({
    secretKey: process.env.CLERK_SECRET_KEY,
    // Explicitly define public routes that do not require authentication
    skipRoutes: ["/api/inngest", "/", "/api/gemeni"]
}));

// =========================================================
// 4️⃣ API Route Definitions
// =========================================================

// Health Check Endpoint
app.get("/", (req, res) => res.status(200).send("✅ Flurry Server is running correctly."));

// Mount Routes
app.use("/api/user", userRouter);
app.use("/api/connection", connectionRouter);
app.use("/api/post", postRouter);
app.use("/api/story", storyRouter);
app.use("/api/message", messageRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/group", groupRouter);
app.use("/api/gemeni", gemeniRouter);

// =========================================================
// 5️⃣ Global Error Handling Strategy
// =========================================================

// 404 Not Found Handler: Catches requests to undefined routes
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: `Route Not Found - ${req.originalUrl}` });
});

// Global Error Handler: Centralized error processing
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    // Log error for debugging (only in development)
    if (process.env.NODE_ENV !== "production") {
        console.error(err.stack);
    }

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        // Hide stack trace in production environment for security
        stack: process.env.NODE_ENV === "production" ? null : err.stack,
    });
});

// =========================================================
// 6️⃣ Database Connection & Server Initialization
// =========================================================

const PORT = process.env.PORT || 4000;

// Establish Database Connection (Singleton pattern recommended for Serverless)
connectDB();

/**
 * Server Startup Logic:
 * - In Development: We manually listen on the port to start the server.
 * - In Production (Vercel): We export the app. Vercel's serverless environment
 * manages the process and port binding automatically.
 */
if (process.env.NODE_ENV !== "production") {
    server.listen(PORT, () => {
        console.log(`🚀 Local Server running in ${process.env.NODE_ENV} mode on port: ${PORT}`);
    });
}

// Export the app for Vercel Serverless Functions
export default app;