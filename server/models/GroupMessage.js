import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema({
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group", // ربطناه بجدول الجروبات
        required: true,
        index: true // عشان سرعة البحث
        // ❌ شيلنا unique: true عشان الجروب ياخد ملايين الرسايل عادي
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // ربطناه باليوزر عشان نعرف مين اللي اتكلم وصورته ايه
        required: true
    },
    text: {
        type: String,
        trim: true
    },
    // 👇 ضفنا دول عشان يبقوا زي الشات الخاص بالظبط
    message_type: {
        type: String,
        enum: ["text", "image", "system", "audio"], // system دي لرسايل زي "فلان انضم للجروب"
        default: "text"
    },
    media_url: {
        type: String
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMessage" // ربطناه بجدول الرسايل الخاصة بالجروب
    },
    reactions: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },
            emoji: {
                type: String,
                required: true
            }
        }
    ],
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
}, {
    timestamps: true
});

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
export default GroupMessage;