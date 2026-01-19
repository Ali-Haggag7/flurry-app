import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        // 👇 ضيفنا الأنواع الجديدة هنا
        enum: [
            "like", "comment", "reply", "share", // تفاعلات
            "follow",                            // متابعة عادية
            "follow_request",                    // طلب متابعة (لحساب خاص)
            "connection_request",                // طلب صداقة
            "connection_accept",                  // قبول طلب صداقة
            "follow_accept"
        ],
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post"
    },
    commentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
    },
    read: {
        type: Boolean,
        default: false
    },
    // 👇 الحقل الجديد: عشان نعرف حالة الطلب (هل لسه معلق ولا اتقبل؟)
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending" // الافتراضي إنه لسه معلق
    }
}, { timestamps: true });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;