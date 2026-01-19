import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // ربطناه بجدول اليوزرز
        required: true
    },
    role: {
        type: String,
        enum: ["admin", "member"], // عشان نميز الأدمن عن العضو العادي
        default: "member"
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected"], // عشان لو الجروب محتاج موافقة
        default: "accepted" // خليها accepted مؤقتاً للتسهيل، أو pending لو عايز دعوات
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false }); // مش محتاجين ID لكل عضو جوه المصفوفة

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    group_image: {
        type: String,
        default: "" // صورة افتراضية للجروب
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    members: [memberSchema], // قائمة الأعضاء
}, {
    timestamps: true
});

const Group = mongoose.model("Group", groupSchema);
export default Group;