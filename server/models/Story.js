// models/Story.js

import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    content: { type: String, trim: true, default: "" },
    image: { type: String, default: "" },
    type: {
        type: String,
        enum: ["text", "image", "video"],
        default: "text",
        required: true
    },
    background_color: { type: String, default: "#000000" },
    caption: { type: String, default: "" },

    // 👇 التعديل الجذري: دمجنا المشاهدة والتفاعل في مكان واحد
    viewers: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },
            viewedAt: {
                type: Date,
                default: Date.now
            },
            // 👇 التفاعل بقى جزء من بيانات المشاهدة
            reaction: {
                type: String,
                default: null // لو مفيش تفاعل تبقى null
            }
        }
    ],

    // ❌ شيلنا مصفوفة reactions المنفصلة عشان التكرار غلط

    openedByOwnerAt: { type: Date, default: null },

    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400
    }
}, {
    timestamps: true
});

// Validation
storySchema.pre("validate", function (next) {
    if (this.type === "text" && (!this.content || this.content.trim().length === 0)) {
        return next(new Error("Text story must have content."));
    }
    if ((this.type === "image" || this.type === "video") && (!this.image || this.image.trim().length === 0)) {
        return next(new Error("Image/Video story must have a media file."));
    }
    next();
});

const Story = mongoose.model("Story", storySchema);
export default Story;