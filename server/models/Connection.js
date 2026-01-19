import mongoose from "mongoose";

const connectionSchema = new mongoose.Schema({
    // 1. المرسل (اللي بعت الطلب)
    sender: {
        type: mongoose.Schema.Types.ObjectId, // 👈 التعديل الأهم: لازم ObjectId مش String
        ref: "User",
        required: true
    },

    // 2. المستقبل (اللي جاله الطلب)
    receiver: {
        type: mongoose.Schema.Types.ObjectId, // 👈 نفس الكلام هنا
        ref: "User",
        required: true
    },

    // 3. حالة الطلب
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending"
    }
}, {
    timestamps: true // بيضيف createdAt و updatedAt أوتوماتيك
});

// ========================================================
// 🧠 المنطقة الذكية (Indexes)
// ========================================================

// 1. منع التكرار: (مستحيل أحمد يبعت لمحمد طلبين في نفس الوقت)
connectionSchema.index({ sender: 1, receiver: 1 }, { unique: true });

// 2. تسريع البحث: (عشان لما تجيب "طلبات الصداقة اللي جيالي" تبقى طيارة)
connectionSchema.index({ receiver: 1, status: 1 });

const Connection = mongoose.model("Connection", connectionSchema);

export default Connection;