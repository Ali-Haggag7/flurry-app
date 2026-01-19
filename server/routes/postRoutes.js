import express from 'express';
import { protect } from '../middlewares/auth.js';
import upload from '../configs/multer.js';
import {
    addComment,
    addPost,
    deletePost,      // (جديد)
    updatePost,      // (جديد)
    getPostById,
    getPostsFeed,
    getUserById,
    likeUnlikePost,
    deleteComment,   // (جديد)
    toggleCommentLike, // (جديد)
    sharePost,
    togglePostSave,
    reportPost,
    updateComment,
    getSavedPosts
} from '../controllers/postController.js';

const postRouter = express.Router();

// ==================================================
// 1. الروابط الثابتة (Static Routes) - لازم في الأول ⚠️
// ==================================================

// إضافة بوست جديد (صور + كلام)
postRouter.post('/add', protect, upload.array('images', 5), addPost);

// جلب الـ Feed (الصفحة الرئيسية)
postRouter.get('/feed', protect, getPostsFeed);

postRouter.get("/saved", protect, getSavedPosts);

// ==================================================
// 2. روابط التفاعل (Interactions)
// ==================================================

// لايك / ديسلايك للبوست
// 1. غيرنا .post لـ .put عشان تطابق الفرونت إند
// 2. غيرنا :postId لـ :id عشان تطابق الكنترولر
postRouter.put("/like/:id", protect, likeUnlikePost);

// إضافة كومنت
postRouter.post("/comment/:postId", protect, addComment);

// تعديل كومنت
postRouter.put("/comment/:commentId", protect, updateComment);

// مسح كومنت
// (الرابط ده بيحتاج ID الكومنت نفسه)
postRouter.delete("/comment/:commentId", protect, deleteComment);

// لايك للكومنت
postRouter.post("/comment/like/:commentId", protect, toggleCommentLike);


// ==================================================
// 3. روابط اليوزر والبوستات (Dynamic Routes)
// ==================================================

// بروفايل يوزر معين وبوستاته
// (صلحنا الاسم لـ :userId عشان يطابق الكنترولر)
postRouter.get("/user/:userId", protect, getUserById); // خليناها protect للأمان، لو عايزها public شيل الـ protect

// --- عمليات البوست الواحد (CRUD) ---

// شارك بوست
postRouter.put("/share/:id", protect, sharePost);

// حفظ بوست
postRouter.put("/save/:id", protect, togglePostSave);

// جلب بوست واحد (للتفاصيل)
postRouter.get("/:id", protect, getPostById);

// تعديل بوست
postRouter.put("/:id", protect, updatePost);

postRouter.post("/report/:id", protect, reportPost);

// مسح بوست
postRouter.delete("/:id", protect, deletePost);


// 4. التصدير
export default postRouter;