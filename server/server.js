import dotenv from "dotenv";
dotenv.config(); // Must be the very first line

// --- Imports: Third Party ---
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";

// --- Imports: Internal ---
import connectDB from "./configs/db.js";
import { app, server } from "./socket/socket.js"; // Express app instance created here
import { inngest, functions } from "./inngest/index.js";

// --- Imports: Routes ---
import connectionRouter from "./routes/connectionRoutes.js";
import postRouter from "./routes/postRoutes.js";
import userRouter from "./routes/userRoutes.js";
import storyRouter from "./routes/storyRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import groupRouter from "./routes/groupRoutes.js";

// =========================================================
// 1. Server Configuration & Security
// =========================================================

// Trust Proxy: Essential for Rate Limiting behind Load Balancers (Vercel/Render/Heroku)
app.set("trust proxy", 1);

// Compression: Gzip response bodies for faster speed
app.use(compression());

// Helmet: Secure HTTP headers
app.use(helmet());

// CORS: Cross-Origin Resource Sharing
app.use(cors({
    origin: [
        "http://localhost:5173", // Local Frontend
        "http://localhost:4173", // Local Preview
        "https://flurry-app.vercel.app", // 🚨 الدومين الأساسي (مهم جداً)
        "https://flurry-fobctrqrq-ali-haggags-projects.vercel.app", // الدومين الفرعي اللي كان ضارب
        process.env.CLIENT_URL // لو حاطط قيمة في ملف .env
    ].filter(Boolean), // عشان يمسح أي قيمة فاضية لو الـ env مش موجود
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Rate Limiting: Prevent DDoS/Spam (1000 req / 15 min)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { success: false, message: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// =========================================================
// 2. Webhooks (MUST be before Body Parser)
// =========================================================

// Inngest Endpoint
// We mount this BEFORE express.json() because webhooks need raw body for signature verification.
app.use("/api/inngest", serve({ client: inngest, functions }));

// =========================================================
// 3. Middlewares & Auth
// =========================================================

// Body Parser
app.use(express.json({ limit: "10mb" })); // Added limit to prevent large payload attacks

// Clerk Authentication Middleware
app.use(clerkMiddleware({
    secretKey: process.env.CLERK_SECRET_KEY,
    // Explicitly skip public routes or webhooks handled above
    skipRoutes: ["/api/inngest", "/"]
}));

// =========================================================
// 4. API Routes
// =========================================================

app.get("/", (req, res) => res.status(200).send("Flurry Server is running 🚀"));

app.use("/api/user", userRouter);
app.use("/api/connection", connectionRouter);
app.use("/api/post", postRouter);
app.use("/api/story", storyRouter);
app.use("/api/message", messageRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/group", groupRouter);

// =========================================================
// 5. Error Handling Strategy
// =========================================================

// 404 - Not Found Handler
app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.stack);

    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        // Hide stack trace in production for security
        stack: process.env.NODE_ENV === "production" ? null : err.stack,
    });
});

// =========================================================
// 6. Server Initialization
// =========================================================

const PORT = process.env.PORT || 4000;

const startServer = async () => {
    try {
        // 1. Establish Database Connection
        await connectDB();

        // 2. Start HTTP/Socket Server
        server.listen(PORT, () => {
            console.log(`✅ Server running in ${process.env.NODE_ENV || "development"} mode on port: ${PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to connect to Database. Server shutting down.");
        console.error(error);
        process.exit(1);
    }
};

startServer();