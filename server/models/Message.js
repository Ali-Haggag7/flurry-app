import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    // (تصليح 1 - أهم حاجة)
    sender: {
        type: mongoose.Schema.Types.ObjectId, // <--- ده التصليح
        ref: "User",
        required: true,
        index: true // (تصليح 2) - فهرس عشان السرعة
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId, // <--- ده التصليح
        ref: "User",
        required: true,
        index: true // (تصليح 2) - فهرس عشان السرعة
    },
    text: {
        type: String,
        trim: true
    },
    message_type: {
        type: String,
        enum: ["text", "image", "audio", 'video', 'file', "shared_post", "story_reply"],
        required: true // (تحسين) هنخليه مطلوب
    },
    // 👇 حقل اختياري لتخزين الـ ID بتاع البوست المشارة
    sharedPostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message', // بيشاور على رسالة تانية في نفس الجدول
        default: null
    },
    replyToStoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Story'
    },
    media_url: {
        type: String
    },
    delivered: {
        type: Boolean,
        default: false,
        index: true
    },
    read: {
        type: Boolean,
        default: false,
        index: true // (تحسين) فهرس عشان نسرع "عد" الرسايل اللي متقرتش
    },
    deletedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [] // مصفوفة فاضية في البداية
    }],
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
}, {
    timestamps: true
});

// (تصليح 3 - مرن وأمن)
messageSchema.pre("validate", function (next) {
    // 1. لو الرسالة نصية فقط (مفيش ميديا URL)
    if (this.message_type === "text" && !this.media_url) {
        if (!this.text || this.text.trim().length === 0) {
            return next(new Error("Text message cannot be empty without media."));
        }
    }

    // 2. لو الرسالة ميديا (صورة أو صوت)
    if ((this.message_type === "image" || this.message_type === "audio")) {
        if (!this.media_url) {
            return next(new Error(`${this.message_type} message must have a media_url.`));
        }
        // ملحوظة: شيلنا سطر `this.text = undefined` عشان لو حبيت تبعت Caption مع الصورة مستقبلاً
        // وعشان ميحصلش مشاكل لو الفرونت بعت text فاضي ""
    }

    next();
});


const Message = mongoose.model("Message", messageSchema);

export default Message;