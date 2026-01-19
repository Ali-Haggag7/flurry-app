import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
    // 1️⃣ الكومنت ده تبع أنهي بوست؟
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
        index: true
    },
    // 2️⃣ مين الكاتب؟
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // 3️⃣ المحتوى
    text: {
        type: String,
        required: true,
        trim: true
    },
    // 4️⃣ 👇 التغيير الجذري هنا: الـ Parent Referencing
    // لو فيه ID هنا، يبقى ده "رد" على الكومنت صاحب الـ ID ده
    // لو null، يبقى ده "كومنت رئيسي"
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
        default: null,
        index: true // عشان لما نجيب الردود يبقى سريع
    },
    // 5️⃣ اللايكات
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    isEdited: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Virtual Field: عشان لو حبينا نجيب الردود المباشرة (اختياري)
commentSchema.virtual('replies', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'parentId'
});

// تفعيل الـ Virtuals
commentSchema.set('toObject', { virtuals: true });
commentSchema.set('toJSON', { virtuals: true });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;