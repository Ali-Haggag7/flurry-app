import express from 'express';
import { protect } from '../middlewares/auth.js';
import upload from '../configs/multer.js';
import {
    sendMessage,
    getChatMessages,
    getRecentMessages,
    sseController,
    markMessagesAsRead,
    deleteConversation,
    reactToMessage
} from '../controllers/messageController.js';

const messageRouter = express.Router();

// ==================================================
// 1. الروابط الثابتة والـ Stream (لازم تيجي في الأول) ⚠️
// ==================================================

// SSE Stream
messageRouter.get("/stream/:userId", sseController);

// آخر الرسايل (Recent) - لازم قبل الـ ID عشان ميفهمش كلمة recent إنها ID
messageRouter.get('/recent', protect, getRecentMessages);

// إرسال رسالة
messageRouter.post('/send', protect, upload.single('image'), sendMessage);

// إضافة/تعديل/حذف ردة فعل على رسالة
messageRouter.post("/react", protect, reactToMessage);

// قراءة الرسايل (Read)
messageRouter.put('/read/:senderId', protect, markMessagesAsRead);

// ==================================================
// 2. الروابط المتغيرة (Dynamic Routes) - لازم في الآخر ⚠️
// ==================================================

// 👇 التعديل هنا: شيلنا كلمة /chat وبقت /:withUserId علطول
// عشان تطابق الفرونت إند: api.get(`/message/${id}`)
messageRouter.get('/:withUserId', protect, getChatMessages);

messageRouter.delete("/conversation/:targetId", protect, deleteConversation);


export default messageRouter;