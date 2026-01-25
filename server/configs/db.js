/**
 * @fileoverview Database Connection Module
 * Establishes a robust connection to MongoDB using Mongoose.
 * Includes event listeners for connection status and handles graceful shutdowns.
 * @version 1.2.0
 * @author Senior Backend Architect
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
    // 1. Environmental Variable Validation
    if (!process.env.MONGO_URL) {
        console.error("❌ Fatal Error: MONGO_URL is not defined in .env file.");
        process.exit(1);
    }

    try {
        // 2. Connection Options (Optimized for Production)
        // Mongoose 6+ defaults are usually good, but these ensure stability.
        const conn = await mongoose.connect(process.env.MONGO_URL, {
            // prevents connection errors on heavy loads
            serverSelectionTimeoutMS: 5000,
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host} 🚀`);

    } catch (error) {
        console.error(`❌ Error connecting to MongoDB: ${error.message}`);
        // Exit process with failure (1) to let orchestration tools (like Docker/PM2) restart it
        process.exit(1);
    }

    // 3. Connection Event Listeners (Observability)
    mongoose.connection.on("disconnected", () => {
        console.warn("⚠️ MongoDB disconnected! Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
        console.log("✅ MongoDB reconnected!");
    });

    mongoose.connection.on("error", (err) => {
        console.error(`❌ MongoDB connection error: ${err}`);
    });

    // 4. Graceful Shutdown (Clean up on Ctrl+C)
    // Ensures the connection closes properly when you stop the server
    process.on("SIGINT", async () => {
        await mongoose.connection.close();
        console.log("🛑 MongoDB connection closed due to app termination");
        process.exit(0);
    });
};

export default connectDB;