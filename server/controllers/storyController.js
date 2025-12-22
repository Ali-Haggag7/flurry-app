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
 * @desc Get Stories Feed (Grouped by User)
 * @route /api/story/feed
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getStoriesFeed = expressAsyncHandler(async (req, res) => {
    // 1. هات اليوزر الحالي (بـ Clerk ID)
    const { userId: clerkId } = req.auth();
    const user = await User.findOne({ clerkId });

    if (!user) {
        res.status(404);
        throw new Error("User not found.");
    }

    // 2. حدد مين الناس اللي عايز تشوف استوريهاتهم
    // (أنا + المتابعين + الكونكشنز)
    const userIds = [
        user._id,
        ...(user.following || []),
        ...(user.connections || [])
    ];

    // 3. حدد الوقت (آخر 24 ساعة)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 4. (الوحش 🔥) Aggregation Pipeline
    const stories = await Story.aggregate([
        // المرحلة 1: الفلترة (Match)
        {
            $match: {
                user: { $in: userIds },           // هات استوريهات الناس دي
                createdAt: { $gt: twentyFourHoursAgo } // اللي لسه "حية" (أقل من 24 ساعة)
            }
        },

        // المرحلة 2: الترتيب (Sort)
        // بنرتب من الأقدم للأحدث (عشان الاستوري الأولى تظهر الأول)
        { $sort: { createdAt: 1 } },

        // المرحلة 3: التجميع (Group)
        // دي أهم خطوة: بنلم الاستوريهات في مجموعات حسب اليوزر
        {
            $group: {
                _id: "$user", // جمع بناءً على اليوزر ID
                stories: { $push: "$$ROOT" }, // حط الاستوريهات كلها في مصفوفة اسمها stories
                lastStoryTime: { $max: "$createdAt" } // هات تاريخ "أحدث" استوري (عشان نرتب الدوائر نفسها)
            }
        },

        // المرحلة 4: هات بيانات اليوزر (Lookup)
        // بما إننا جمعنا بـ _id (اللي هو اليوزر)، عايزين نجيب اسمه وصورته
        {
            $lookup: {
                from: "users", // اسم الكولكشن في الداتابيز (بيكون جمع وصغير)
                localField: "_id",
                foreignField: "_id",
                as: "userData"
            }
        },

        // المرحلة 5: تنظيف الشكل (Project)
        // الـ lookup بيرجع array، إحنا عايزين أوبجكت واحد، ونختار الحقول اللي عايزينها
        {
            $project: {
                _id: 1,
                stories: 1,
                lastStoryTime: 1,
                user: { $arrayElemAt: ["$userData", 0] } // خد أول عنصر من المصفوفة
            }
        },

        // المرحلة 6: ترتيب الدوائر (Sort Circles)
        // عايزين اليوزر اللي نزل استوري "أحدث" يظهر في أول الطابور (على الشمال)
        { $sort: { lastStoryTime: -1 } }
    ]);

    // 5. (خطوة تجميلية للفرونت إند)
    // ننظف بيانات اليوزر اللي راجعة (نختار الاسم والصورة بس)
    const formattedStories = stories.map(group => ({
        user: {
            _id: group.user._id,
            full_name: group.user.full_name,
            username: group.user.username,
            profile_picture: group.user.profile_picture,
        },
        stories: group.stories
    }));

    res.status(200).json({
        success: true,
        stories: formattedStories
    });
});


/**----------------------------------------------
 * @desc Delete a story (Manual)
 * @route /api/story/:id
 * @method DELETE
 * @access Private
--------------------------------------------------*/
export const deleteStory = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { id } = req.params; // ID الاستوري

    // 1. هات الاستوري
    const story = await Story.findById(id);

    if (!story) {
        res.status(404);
        throw new Error("Story not found.");
    }

    // 2. (Security Check 🛡️) هل أنت صاحبها؟
    if (story.user.toString() !== userId) {
        res.status(403);
        throw new Error("You are not authorized to delete this story.");
    }

    // 3. امسح من الداتابيز
    await Story.findByIdAndDelete(id);

    // (Premium Note): لو عايز تمسح الصورة من imagekit، لازم تكون مخزن fileId في الموديل
    // لو مش مخزنه، مش مشكلة، المساحة بتشيل كتير.

    res.status(200).json({
        success: true,
        message: "Story deleted successfully."
    });
});


/**----------------------------------------------
 * @desc Get active stories of a specific user
 * @route /api/story/user/:userId
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getUserStories = expressAsyncHandler(async (req, res) => {
    const { userId: targetUserId } = req.params; // اليوزر اللي عايز اتفرج عليه

    // 1. نتأكد إن اليوزر ده موجود أصلاً
    const user = await User.findById(targetUserId).select("_id full_name profile_picture");

    if (!user) {
        res.status(404);
        throw new Error("User not found.");
    }

    // 2. فلتر الوقت (آخر 24 ساعة)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 3. هات الاستوريهات
    const stories = await Story.find({
        user: targetUserId,
        createdAt: { $gt: twentyFourHoursAgo } // أكبر من (بعد) امبارح في نفس المعاد
    })
        .sort({ createdAt: 1 }) // (مهم) ترتيب تصاعدي: أقدم واحدة تظهر الأول
        .lean();

    res.status(200).json({
        success: true,
        user, // بيانات صاحبه (عشان نعرض اسمه وصورته فوق)
        stories
    });
});