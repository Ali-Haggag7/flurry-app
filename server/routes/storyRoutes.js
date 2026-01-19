import express from 'express';
import { protect } from '../middlewares/auth.js'; // (تأكد من المسار ده عندك)
import upload from '../configs/multer.js';        // (تأكد من المسار ده عندك)
import {
    addStory,
    getStoriesFeed,
    getUserStories,
    deleteStory,
    viewStory,
    handleStoriesEnd,
    toggleReaction
} from '../controllers/storyController.js';

const storyRouter = express.Router();

// ==================================================
// 1. إضافة وعرض (Core Features)
// ==================================================

// إضافة استوري جديدة (صورة أو فيديو أو نص)
// (مهم: اسم الحقل في الفورم داتا لازم يكون 'media')
storyRouter.post('/add', protect, upload.single('media'), addStory);

// عرض شريط الاستوريهات (Feed)
// (ده اللي بيعمل التجميعة والدوائر)
storyRouter.get('/feed', protect, getStoriesFeed);

// مشاهدة استوري
storyRouter.put("/:id/view", protect, viewStory);

// مشاهده كل استوريهات اليوزر
storyRouter.put('/mark-all-seen/:targetUserId', protect, handleStoriesEnd);

// ==================================================
// 2. إدارة الاستوري (Management)
// ==================================================

//عرض استوريهات يوزر معين (زي الواتساب)
storyRouter.get('/user/:userId', protect, getUserStories);

//مسح استوري
storyRouter.delete('/:id', protect, deleteStory);

storyRouter.post('/:storyId/react', protect, toggleReaction);

// 3. التصدير
export default storyRouter;