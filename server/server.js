// (!! التعديل 1: dotenv.config() لازم تكون أول حاجة !!)
import dotenv from "dotenv";
dotenv.config();

// --- باقي الاستدعاءات ---
import { app, server } from "./socket/socket.js";
import express from "express";
import cors from "cors";
import connectDB from "./configs/db.js";
import { inngest, functions } from "./inngest/index.js";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";
import connectionRouter from "./routes/connectionRoutes.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import postRouter from "./routes/postRoutes.js";
import userRouter from "./routes/userRoutes.js";
import storyRouter from "./routes/storyRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import groupRouter from "./routes/groupRoutes.js";


// ----------------------- Middlewares (الترتيب هنا مهم) -----------------------



// 1. CORS: عشان نسمح للمواقع الخارجية (الفرونت إند) تكلمنا
app.use(cors({
    origin: "http://localhost:5173", // 👈 لازم يكون رابط الفرونت بالظبط (بدون / في الآخر)
    credentials: true, // 👈 دي اللي سببت المشكلة مع النجمة، بس احنا محتاجينها
    methods: ["GET", "POST", "PUT", "DELETE"], // حدد الميثودز المسموحة
}));

// 2. JSON Parser: عشان السيرفر يفهم req.body
app.use(express.json());

// 3. (!! التعديل 2: Clerk Middleware مع استثناء !!)
// ده "البواب" بتاعنا. هيشتغل على "كل" الروابط اللي جاية
app.use(clerkMiddleware({
    secretKey: process.env.CLERK_SECRET_KEY,

    // (!! الأهم !!)
    // لازم نقوله "يتجاهل" الروت بتاع Inngest
    // لإن ده سيرفر بيكلم سيرفر (Webhook) ومعهوش توكن يوزر
    skipRoutes: ["/api/inngest", "/"] // تجاهل Inngest والروت العام
}));

app.use(helmet()); // حماية الهيدرز

// حماية من الـ Spam (مثلاً 100 طلب كل 15 دقيقة كحد أقصى لكل IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: "Too many requests from this IP, please try again later."
});
app.use(limiter);


// ----------------------- Routes (الروابط) -----------------------

// 4. رابط Inngest (سليم)
app.use("/api/inngest", serve({ client: inngest, functions }));

// 5. (سليم، وبقى محمي بـ Clerk أوتوماتيك)
app.use("/api/user", userRouter);
app.use("/api/connection", connectionRouter);
app.use("/api/post", postRouter);
app.use("/api/story", storyRouter);
app.use("/api/message", messageRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/group", groupRouter);

// 6. رابط تجريبي عام (سليم)
app.get("/", (req, res) => {
    res.send("Server is running");
});

// (!! الإضافة الجديدة: معالج أخطاء 404 - Not Found !!)
// (ده لازم يكون "قبل" الماسك العام)
// ده بيشتغل لو اليوزر طلب رابط مش موجود في كل الروابط اللي فوق
// (زي /api/users أو /api/blahblah)
// بيمسك الطلب ده وبيحوله لـ "إيرور" عشان الماسك العام يمسكه
app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error); // بنبعت الإيرور للماسك اللي تحت
});

// 7. (إضافة) ماسك أخطاء عام (Global Error Handler)
// (ده لازم يكون "آخر" middleware في الملف)
// ده "المدير" اللي كل الإيرورات بتيجي عنده
// (سواء من "expressAsyncHandler" أو من "404")
app.use((err, req, res, next) => {
    console.error(err.stack); // بنطبع الإيرور في الكونسول

    // بنجيب الـ status code (لو مفيش، بنخليه 500)
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Something went wrong!',
        // بنخفي تفاصيل الإيرور (الـ stack) لو إحنا "production"
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
});


// --- تشغيل السيرفر ---
const port = process.env.PORT || 4000;

// (!! التعديل 3: أفضل ممارسة - نشغل السيرفر بعد الاتصال بالداتا بيز !!)
const startServer = async () => {
    try {
        // 1. اتصل بالداتا بيز الأول
        await connectDB();

        // 2. لو الاتصال نجح، شغل السيرفر
        server.listen(port, () => {
            console.log(`Server is running on port : ${port}`);
        });
    } catch (error) {
        // لو الاتصال بالداتا بيز فشل، اطبع الإيرور ومتشغلش السيرفر
        console.log("Failed to connect to DB, server is not starting.");
        console.log(error);
        process.exit(1); // اخرج من البرنامج بفشل
    }
};

// نبدأ عملية التشغيل
startServer();