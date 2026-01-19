import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    clerkId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        trim: true,
        unique: true,
        required: true
    },
    full_name: {
        type: String,
        trim: true,
        required: true,
    },
    username: {
        type: String,
        trim: true,
        required: true,
        unique: true
    },
    bio: {
        type: String,
        default: "Hey there! I'm using flowNet!"
    },
    location: {
        type: String,
        default: ""
    },
    profile_picture: {
        type: String,
        default: ""
    },
    cover_photo: {
        type: String,
        default: ""
    },
    isVerified: {
        type: Boolean,
        default: false
    },

    // --- إعدادات الخصوصية ---
    isPrivate: {
        type: Boolean,
        default: false
    },
    hideOnlineStatus: {
        type: Boolean,
        default: false
    },

    // 👇👇👇 الجزء الجديد: إعدادات الإشعارات 👇👇👇
    notificationSettings: {
        email: {
            type: Boolean,
            default: true // الطبيعي إنها شغالة لحد ما هو يقفلها
        },
        push: {
            type: Boolean,
            default: true
        }
    },

    // --- العلاقات (Connections & Follows) ---

    // 1. الأصدقاء
    connections: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // 2. طلبات الصداقة
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // (تم دمج التكرار هنا)

    // 3. المتابعة (Follow System)
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // 4. الحظر والكتم
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],

    lastSeen: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true,
});

const User = mongoose.model("User", userSchema);

export default User;