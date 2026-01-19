import expressAsyncHandler from "express-async-handler";
import Story from "../models/Story.js";
import User from "../models/User.js";
import imagekit from "../configs/imagekit.js"; // 👈 لازم الامتداد .js في الآخر
import { inngest } from "../inngest/index.js";

/**----------------------------------------------
 * @desc Add a new story
 * @route /api/story/add
 * @method POST
 * @access Private
--------------------------------------------------*/
export const addStory = expressAsyncHandler(async (req, res) => {
    // 1. (التصليح المعتاد) - هنجيب اليوزر الحقيقي من الداتابيز
    const { userId: clerkId } = req.auth();
    const user = await User.findOne({ clerkId });
    const caption = req.body.caption;

    if (!user) {
        res.status(404);
        throw new Error("User not found. Please sync account.");
    }

    // 2. نستقبل البيانات
    const { content, type, backgroundColor } = req.body; // غيرت الأسماء لـ camelCase للأناقة
    const file = req.file; // (multer single upload)

    // 3. التحقق (Validation)
    // لو النوع "text" ومفيش كلام -> ارفض
    if (type === "text" && (!content || content.trim().length === 0)) {
        res.status(400);
        throw new Error("Text story must have content.");
    }
    // لو النوع "image" ومفيش ملف -> ارفض
    if (type !== "text" && !file) {
        res.status(400);
        throw new Error("Media file is required for image/video stories.");
    }

    let mediaUrl = "";

    // 4. رفع الميديا (لو موجودة)
    if (file) {
        const uploadResponse = await imagekit.upload({
            file: file.buffer,
            fileName: file.originalname,
            folder: "/stories/" // فولدر خاص بالاستوري
        });

        // 👇👇 التعديل الذكي هنا 👇👇
        // بنحدد هل هنحط تحويلات ولا لأ حسب نوع الملف
        let transformationOptions = [];
        // لو صورة، نطبق تحسين الجودة
        if (file.mimetype.startsWith("image/")) {
            transformationOptions = [{ quality: "auto" }];
        }
        // لو فيديو، بنسيب المصفوفة فاضية [] عشان الرابط يرجع خام من غير tr:q-auto

        mediaUrl = imagekit.url({
            path: uploadResponse.filePath,
            transformation: transformationOptions,
        });
    }

    // 5. إنشاء الاستوري في الداتابيز
    const story = await Story.create({
        user: user._id, // ✅ هنا حطينا الـ Mongo ID الصح
        content: content || "",
        image: mediaUrl, // (التزمنا باسم الموديل)
        type: type || "text",
        background_color: backgroundColor,
        caption
    });

    // 6. (Inngest Magic ✨)
    // بنبعت إيفنت "الإنشاء" للروبوت، وهو هيتصرف (ينام 24 ساعة ويمسحها)
    await inngest.send({
        name: "app/story.created", // نفس الاسم اللي الروبوت مستنيه
        data: {
            storyId: story._id // بنبعتله الـ ID عشان يعرف يمسح إيه
        }
    });

    res.status(201).json({
        success: true,
        message: "Story added successfully",
        story
    });
});


/**----------------------------------------------
 * @desc Get Stories Feed (Sorted by Unseen First)
 * @route /api/story/feed
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getStoriesFeed = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const user = await User.findOne({ clerkId });

    if (!user) {
        res.status(404);
        throw new Error("User not found.");
    }

    // 1. 👇 هات قائمة المحظورين (عشان نفلترهم)
    const blockedList = user.blockedUsers || [];

    // 2. تصفية قائمة الأصدقاء والمتابعين (شيل منهم المحظورين)
    // حولنا الـ ID لـ String عشان المقارنة تكون دقيقة في الفلتر
    const userIds = [user._id, ...(user.following || []), ...(user.connections || [])]
        .filter(id => !blockedList.some(blockedId => blockedId.toString() === id.toString()));

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rawStories = await Story.find({
        user: {
            $in: userIds,       // الناس اللي بتابعهم
            $nin: blockedList   // 🛡️ زيادة تأكيد: استبعد أي حد في البلوك ليست
        },
        createdAt: { $gt: twentyFourHoursAgo }
    })
        .populate("user", "username full_name profile_picture")
        .populate({
            path: "viewers.user",
            select: "username full_name profile_picture"
        })
        .sort({ createdAt: 1 })
        .lean();

    const groupedStories = {};
    const currentUserIdStr = user._id.toString();

    rawStories.forEach(story => {
        if (!story.user) return; // أمان لو اليوزر ممسوح

        const storyOwnerIdStr = story.user._id.toString();
        const isOwner = storyOwnerIdStr === currentUserIdStr;

        const isViewedByMe = isOwner
            ? !!story.openedByOwnerAt
            : story.viewers.some(v => v.user && v.user._id.toString() === currentUserIdStr);

        story.isViewed = isViewedByMe;

        if (!groupedStories[storyOwnerIdStr]) {
            groupedStories[storyOwnerIdStr] = {
                user: story.user,
                stories: [],
                hasUnseen: false,
                lastStoryTime: story.createdAt
            };
        }

        groupedStories[storyOwnerIdStr].stories.push(story);

        if (new Date(story.createdAt) > new Date(groupedStories[storyOwnerIdStr].lastStoryTime)) {
            groupedStories[storyOwnerIdStr].lastStoryTime = story.createdAt;
        }

        if (!story.isViewed) {
            groupedStories[storyOwnerIdStr].hasUnseen = true;
        }
    });

    const formattedStories = Object.values(groupedStories).sort((a, b) => {
        if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
        return new Date(b.lastStoryTime) - new Date(a.lastStoryTime);
    });

    res.status(200).json({
        success: true,
        stories: formattedStories
    });
});


/**----------------------------------------------
 * @desc Get active stories of a specific user
 * @route /api/story/user/:userId
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getUserStories = expressAsyncHandler(async (req, res) => {
    const { userId: targetUserId } = req.params;

    // 1. تحديد المشاهد (أنت)
    let viewerId = null;
    if (req.auth) {
        const { userId: clerkId } = req.auth();
        const viewer = await User.findOne({ clerkId });
        viewerId = viewer?._id.toString();
    }

    // 2. هات بيانات صاحب البروفايل
    const user = await User.findById(targetUserId).select("_id full_name username profile_picture");
    if (!user) {
        res.status(404);
        throw new Error("User not found.");
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 3. هات الاستوريز واعمل Populate لبيانات صاحبها جواها
    let stories = await Story.find({
        user: targetUserId,
        createdAt: { $gt: twentyFourHoursAgo }
    })
        .populate("user", "username full_name profile_picture") // 👈 مهم جداً عشان الاسم يظهر جوه البلاير
        .sort({ createdAt: 1 })
        .lean();

    // 4. حساب الـ Seen بدقة متناهية
    stories = stories.map(story => {
        let isSeen = false;

        if (viewerId) {
            // لو أنا صاحب الاستوري
            if (story.user._id.toString() === viewerId) {
                isSeen = !!story.openedByOwnerAt;
            } else {
                // لو مشاهد عادي (كود آمن جداً للمقارنة)
                isSeen = story.viewers && story.viewers.some(v => {
                    if (!v) return false;
                    // التعامل مع v سواء كان object أو id مباشر
                    const idToCheck = v.user ? v.user : v;
                    return idToCheck?.toString() === viewerId;
                });
            }
        }

        return {
            ...story,
            seen: isSeen,     // عشان الفرونت القديم
            isViewed: isSeen  // عشان توحيد المسميات
        };
    });

    res.status(200).json({
        success: true,
        user,
        stories
    });
});


/**----------------------------------------------
 * @desc Mark story as viewed
 * @route /api/story/:id/view
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const viewStory = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { id } = req.params;

    const user = await User.findOne({ clerkId });
    if (!user) { res.status(404); throw new Error("User not found"); }

    const story = await Story.findById(id);
    if (!story) { res.status(404); throw new Error("Story not found"); }

    const currentUserIdStr = user._id.toString();

    // 🔥🔥🔥 1. عملية التنظيف الشاملة (Cleaning & Deduplication) 🔥🔥🔥
    // دي هتحل مشكلة العداد (2) ومشكلة الـ ValidationError للأبد
    let uniqueViewers = [];
    const seenIds = new Set(); // بنستخدم Set عشان نضمن عدم تكرار أي ID

    if (story.viewers && story.viewers.length > 0) {
        for (const v of story.viewers) {
            // أ) ارمي أي عنصر بايظ (مفهوش user) -> ده بيحل الـ ValidationError
            if (!v || !v.user) continue;

            const vId = v.user.toString();
            // ب) لو الـ ID ده عدا علينا قبل كده، ارميه (منع التكرار)
            if (!seenIds.has(vId)) {
                seenIds.add(vId);
                uniqueViewers.push(v);
            }
        }
    }

    // 🔥🔥🔥 2. إضافة المشاهدة الجديدة 🔥🔥🔥
    // لو أنا مش صاحب الاستوري
    if (story.user.toString() !== currentUserIdStr) {
        // لو أنا مش موجود في القائمة النضيفة، ضيفني
        if (!seenIds.has(currentUserIdStr)) {
            uniqueViewers.push({
                user: user._id,
                viewedAt: new Date(),
                reaction: null
            });
        }
    } else {
        // لو أنا صاحب الاستوري: حدث وقت الفتح فقط
        if (!story.openedByOwnerAt) {
            story.openedByOwnerAt = new Date();
        }
    }

    // 3. حفظ القائمة النضيفة الجديدة
    story.viewers = uniqueViewers;
    await story.save();

    res.status(200).json({ success: true });
});


/**----------------------------------------------
 * @desc Delete a story (Manual)
 * @route /api/story/:id
 * @method DELETE
 * @access Private
--------------------------------------------------*/
export const deleteStory = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth(); // 1. ده الـ Clerk ID
    const { id } = req.params; // ID الاستوري

    // 2. نجيب اليوزر الحقيقي من الداتابيز
    const user = await User.findOne({ clerkId });

    if (!user) {
        res.status(404);
        throw new Error("User not found.");
    }

    // 3. هات الاستوري
    const story = await Story.findById(id);

    if (!story) {
        res.status(404);
        throw new Error("Story not found.");
    }

    // 4. (التصحيح هنا 🔥) نقارن الـ Mongo ID ببعض
    if (story.user.toString() !== user._id.toString()) {
        res.status(403);
        throw new Error("You are not authorized to delete this story.");
    }

    // 5. امسح من الداتابيز
    await Story.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: "Story deleted successfully."
    });
});


/**----------------------------------------------
 * @desc Mark all stories of a specific user as seen
 * @route /api/story/mark-all-seen
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const handleStoriesEnd = expressAsyncHandler(async (req, res) => {
    // 1. استلام الـ ID بتاع صاحب الاستوريز من الرابط
    const { targetUserId } = req.params;

    // 2. استلام الـ ID بتاعك (المشاهد) من Clerk middleware
    const { userId: viewerClerkId } = req.auth();

    // 3. تحويل Clerk ID لـ Mongo ID (المشاهد)
    const viewer = await User.findOne({ clerkId: viewerClerkId });
    if (!viewer) {
        res.status(404);
        throw new Error("Viewer not found");
    }

    // 4. تحديث "كل" الاستوريز الحية بتاعة الـ targetUserId
    // بنضيف الـ ID بتاعك في مصفوفة الـ viewers لو مش موجود
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await Story.updateMany(
        {
            user: targetUserId,
            createdAt: { $gte: twentyFourHoursAgo },
            viewers: { $ne: viewer._id },
            user: { $ne: viewer._id } // 👈 أهم سطر
        },
        {
            $addToSet: { viewers: viewer._id }
        }
    );


    res.status(200).json({
        success: true,
        message: "All stories marked as seen successfully"
    });
});


/**----------------------------------------------
 * @desc Toggle reaction
 * @route /api/story/:storyId/react
 * @method POST
 * @access Private
--------------------------------------------------*/
export const toggleReaction = expressAsyncHandler(async (req, res) => {
    const { storyId } = req.params;
    const { emoji } = req.body;
    const { userId: clerkId } = req.auth();

    const user = await User.findOne({ clerkId });
    if (!user) { res.status(404); throw new Error("User not found"); }

    const story = await Story.findById(storyId);
    if (!story) { res.status(404); throw new Error("Story not found"); }

    // 🔥🔥 خطوة التنظيف الإجباري هنا كمان 🔥🔥
    // لازم ننضف قبل ما نعمل save وإلا الـ Validation هيضرب بسبب البيانات القديمة
    if (story.viewers && story.viewers.length > 0) {
        story.viewers = story.viewers.filter(v => v && v.user);
    }

    const userIdStr = user._id.toString();
    const viewerIndex = story.viewers.findIndex(v => v.user.toString() === userIdStr);

    if (viewerIndex > -1) {
        // ✅ موجود: عدل الرياكت
        story.viewers[viewerIndex].reaction = emoji;
        // بنعمل markModified عشان مونجوز يفهم إننا عدلنا جوه المصفوفة
        story.markModified('viewers');
    } else {
        // 🆕 مش موجود: ضيفه جديد
        story.viewers.push({
            user: user._id,
            viewedAt: new Date(),
            reaction: emoji
        });
    }

    // دلوقتي الـ save هينجح لأننا نضفنا العناصر البايظة فوق
    await story.save();

    res.status(200).json({ success: true, reaction: emoji });
});