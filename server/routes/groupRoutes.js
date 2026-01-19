import express from 'express';
import { protect } from '../middlewares/auth.js';
import upload from '../configs/multer.js'; // 👈 لازم يكون عندك الملف ده (Multer config)

import {
    createGroup,
    getAvailableGroups,
    getDiscoveryGroups,
    joinGroup,
    getGroupRequests,
    respondToJoinRequest,
    getGroupMessages,
    getGroupDetails,
    sendGroupMessage,
    leaveGroup,
    removeMember,
    reactToGroupMessage,
    markGroupMessagesRead,
} from '../controllers/groupController.js';

const groupRouter = express.Router();

// 1️⃣ إدارة الجروبات (إنشاء - عرض - تفاصيل)
// بنستخدم upload.single('image') عشان صورة الجروب
groupRouter.post('/create', protect, upload.single('image'), createGroup);
groupRouter.get('/my-groups', protect, getAvailableGroups);
groupRouter.get('/discovery', protect, getDiscoveryGroups);
groupRouter.post("/react", protect, reactToGroupMessage);
// ملحوظة: الراوت اللي فيه :id يفضل يكون في الآخر عشان ميتعارضش مع اللي قبله
groupRouter.get('/:groupId', protect, getGroupDetails);

// 2️⃣ العضوية (انضمام - خروج - طرد)
groupRouter.post('/join/:groupId', protect, joinGroup);
groupRouter.put('/leave/:groupId', protect, leaveGroup);
groupRouter.put('/kick', protect, removeMember);

// 3️⃣ إدارة الطلبات (للأدمن)
groupRouter.get('/requests/:groupId', protect, getGroupRequests);
groupRouter.put('/request/respond', protect, respondToJoinRequest);

// 4️⃣ الرسايل (عرض - إرسال)
groupRouter.get('/messages/:groupId', protect, getGroupMessages);

// 5️⃣ تعليم الرسايل كمقروءة
groupRouter.put("/read/:groupId", protect, markGroupMessagesRead);

// بنستخدم upload.single('image') هنا عشان الصور والفويس نوتس
groupRouter.post('/send', protect, upload.single('file'), sendGroupMessage);

export default groupRouter;