import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    targetPost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: true
    },
    reason: {
        type: String,
        required: true,
        enum: ["Spam", "Harassment", "Hate Speech", "Violence", "Nudity", "Other"] // قائمة الأسباب المسموحة
    },
    status: {
        type: String,
        enum: ["pending", "reviewed", "resolved"],
        default: "pending"
    }
}, { timestamps: true });

const Report = mongoose.model("Report", reportSchema);
export default Report;