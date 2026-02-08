import { GoogleGenerativeAI } from "@google/generative-ai";
import expressAsyncHandler from "express-async-handler";
import Message from "../models/Message.js";
import GroupMessage from "../models/GroupMessage.js";

// --- Configuration & Initialization ---

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is missing in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Using 'gemini-1.5-flash' is often more stable, but adhering to your specific model choice:
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

/**
 * Utility: List available Gemini models on startup for debugging.
 * Non-blocking operation.
 */
async function listAvailableModels() {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
        );
        const data = await response.json();
        console.log("📋 Available Models:", data.models?.map((m) => m.name));
    } catch (error) {
        console.warn("⚠️ Failed to list models:", error.message);
    }
}
// Execute on load
listAvailableModels();

// --- Controllers ---

/**
 * @desc    Summarize chat history using Google Gemini
 * @route   POST /api/ai/summarize
 * @access  Private
 */
export const summarizeChat = expressAsyncHandler(async (req, res) => {
    const { chatId, isGroup } = req.body;

    // 1. Fetch Messages
    let messages = [];
    const limit = 50;

    try {
        if (isGroup) {
            messages = await GroupMessage.find({ group: chatId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate("sender", "full_name");
        } else {
            // Fetch 1-on-1 messages strictly adhering to original logic
            messages = await Message.find({
                $or: [{ sender: chatId }, { receiver: chatId }],
            })
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate("sender", "full_name");
        }
    } catch (dbError) {
        res.status(500);
        throw new Error("حدث خطأ أثناء جلب الرسائل من قاعدة البيانات.");
    }

    // 2. Validate Content Availability
    if (!messages || messages.length < 3) {
        res.status(400);
        throw new Error("الرسايل قليلة أوي عشان تتلخص!");
    }

    // 3. Prepare Context for AI
    // Reverse to chronological order (Oldest -> Newest) for the LLM context
    const conversationText = messages
        .reverse()
        .map((msg) => {
            const senderName = msg.sender?.full_name || "Unknown";
            const textContent = msg.text || "[Media/Deleted]";
            return `${senderName}: ${textContent}`;
        })
        .join("\n");

    // 4. Generate Summary
    try {
        const prompt = `
            أنت مساعد ذكي في تطبيق شات مصري.
            دي محادثة بين مجموعة أشخاص:
            
            ${conversationText}
            
            المطلوب: لخص اللي حصل في المحادثة دي في شكل نقاط بسيطة (Bullets) باللهجة المصرية العامية.
            ركز على القرارات اللي خدوها أو المواعيد أو المشاكل اللي اتحلت.
            متزودش كلام من عندك، خليك في المفيد.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();

        res.status(200).json({ success: true, summary });

    } catch (error) {
        console.error("Gemini Summarization Error:", error);
        res.status(500);
        throw new Error("فشل في التلخيص، تأكد من المفتاح أو الاتصال");
    }
});

/**
 * @desc    Check content safety (Moderation) using Gemini
 * @route   POST /api/ai/moderate
 * @access  Private
 */
export const moderateContent = expressAsyncHandler(async (req, res) => {
    const { text } = req.body;

    // Fail-safe: If no text, consider it safe to avoid blocking empty states
    if (!text || typeof text !== 'string') {
        return res.status(200).json({ safe: true });
    }

    try {
        const prompt = `
            هل النص التالي يحتوي على عنف شديد، كراهية، تنمر قاسي، أو ألفاظ بذيئة جداً؟
            النص: "${text}"
            
            جاوب بكلمة واحدة فقط: "SAFE" أو "UNSAFE".
            لو النص عادي أو هزار بسيط قول SAFE.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        // Normalize response to ensure robust checking
        const decision = response.text().trim().toUpperCase();
        const isSafe = decision.includes("SAFE");

        res.status(200).json({
            safe: isSafe,
            categories: isSafe ? {} : { flag: "content_policy_violation" },
        });

    } catch (error) {
        console.error("Gemini Moderation Error:", error);
        // Fail-open strategy: In case of AI downtime, do not block user messages
        res.status(200).json({ safe: true });
    }
});