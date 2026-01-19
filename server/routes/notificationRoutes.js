import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
    getUserNotifications,
    getUnreadCount,
    deleteNotification,
    markOneAsRead,
    markAllAsRead,
    getNetworkCounts,
    markNetworkAsRead
} from '../controllers/notificationController.js';

const notificationRouter = express.Router();

// 1. العدادات (لازم تيجي في الأول)
notificationRouter.get('/unread-count', protect, getUnreadCount);
notificationRouter.get('/network-counts', protect, getNetworkCounts); // 👈 للشبكة (النقطة الحمراء)

// 2. جلب وتعديل القوائم
notificationRouter.get('/', protect, getUserNotifications); // بتقبل ?filter=...
notificationRouter.put('/read-all', protect, markAllAsRead);
notificationRouter.put("/mark-network-read", protect, markNetworkAsRead);

// 3. العمليات على إشعار محدد (بالـ ID)
notificationRouter.delete('/:id', protect, deleteNotification);
notificationRouter.put('/:id/read', protect, markOneAsRead);

export default notificationRouter;