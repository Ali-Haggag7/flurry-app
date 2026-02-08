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
// import mongoSanitize from "express-mongo-sanitize";
// import hpp from "hpp";

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
import gemeniRouter from "./routes/gemeniRoutes.js";

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
        "https://flurry-app.vercel.app",
        "https://flurry-fobctrqrq-ali-haggags-projects.vercel.app",
        process.env.CLIENT_URL
    ].filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Rate Limiting: Prevent DDoS/Spam (1000 req / 15 min)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { success: false, message: "Too many requests, slow down!" },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api", limiter);

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

// URL Encoded Body Parser
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Data Sanitization against NoSQL query injection
// app.use(mongoSanitize());

// Prevent Parameter Pollution
// app.use(hpp());

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
app.use("/api/gemeni", gemeniRouter);

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