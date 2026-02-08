import express from "express";
import { protect } from "../middlewares/auth.js";
import { summarizeChat, moderateContent } from "../controllers/gemeniController.js";

const gemeniRouter = express.Router();

// =========================================================
// 1. Chat Summarization 
// =========================================================
// POST /api/ai/summarize
// Body: { chatId: "...", isGroup: true/false }
gemeniRouter.post("/summarize", protect, summarizeChat);

// =========================================================
// 2. Content Moderation 
// =========================================================
// POST /api/ai/moderate
// Body: { text: "..." }
gemeniRouter.post("/moderate", protect, moderateContent);

export default gemeniRouter;