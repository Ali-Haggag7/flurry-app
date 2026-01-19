import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
    // 1. صاحب البوست (أهم حقل)
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true // (مهم جداً) عشان لما تجيب بروفايل يوزر، يجيب بوستاته بسرعة
    },

    // 2. المحتوى النصي
    content: {
        type: String,
        trim: true, // يشيل المسافات الزيادة
        default: "" // لو مفيش كلام، خليه فاضي مش null
    },

    // 3. الصور (مصفوفة لإن البوست ممكن يكون فيه كذا صورة)
    // (استخدمنا الاسم image_urls عشان يمشي مع الكنترولر بتاعك)
    image_urls: [{
        type: String,
        // ممكن تضيف validate هنا لو عايز تتأكد إنه رابط صورة صح
    }],

    // 4. نوع البوست (اختياري بس مفيد للفرونت إند)
    post_type: {
        type: String,
        enum: ["text", "image", "video",], // القيم المسموحة بس
        default: "text"
    },

    isHidden: {
        type: Boolean,
        default: false
    },

    // 5. اللايكات (مصفوفة IDs للناس اللي عملت لايك)
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    // 6. الكومنتات (نظام References)
    // إحنا هنا بنخزن IDs الكومنتات، والكومنت نفسه في كولكشن منفصل
    // (ده عشان الكنترولر بتاعك بيعمل Comment.create وبعدين يضيف الـ ID هنا)
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
    }],

    // 7. الشيرات
    shares: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    saves: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
}, {
    timestamps: true // بيضيف createdAt و updatedAt أوتوماتيك
});


// ========================================================
// 🧠 المنطقة الذكية (Indexes & Performance)
// ========================================================

// 1. الفهرس المركب للـ Feed (أهم سطر في الملف ده) 🔥
// إحنا دايماً في الـ Feed بنبحث بـ (user) وبنرتب بـ (createdAt)
// الفهرس ده بيخلي العملية دي طيارة حتى لو عندك مليون بوست
postSchema.index({ user: 1, createdAt: -1 });

// 2. التحقق المنطقي (Validation Hook) 🛡️
// قبل ما نسيف، نتأكد إن البوست مش فاضي (لازم يا كلام يا صور)
postSchema.pre("validate", function (next) {
    const hasContent = this.content && this.content.trim().length > 0;
    const hasImages = this.image_urls && this.image_urls.length > 0;

    if (!hasContent && !hasImages) {
        next(new Error("Post cannot be empty. Must have content or images."));
    } else {
        next();
    }
});


const Post = mongoose.model("Post", postSchema);
export default Post;