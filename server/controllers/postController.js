import expressAsyncHandler from "express-async-handler"
import Post from "../models/Post.js"
import User from "../models/User.js"
import Comment from "../models/Comment.js"
import imagekit from "../configs/imagekit.js"; // 👈 لازم الامتداد .js في الآخر
import Notification from "../models/Notification.js"
import Story from "../models/Story.js"
import Report from "../models/Report.js";


// ========= HELPERS =========

// (تحسين) - هنعمل أوبجكت "اليوزر المجهول" مرة واحدة بس
const UNKNOWN_USER = {
    _id: null, // (تصليح 3) - استخدام null أنضف من ""
    full_name: "Unknown User",
    username: "unknown",
    profile_picture: "default_avatar_url.png" // (يفضل تحط لينك صورة افتراضية)
};

/**
 * الفانكشن دي سليمة زي ما هي، بس "populatePostData" الجديدة مش هتستخدمها
 * عشان نتجنب الـ N+1. هنسيبها عشان ممكن تستخدمها في حتت تانية.
 */
const getUserData = async (userId) => {
    if (!userId) return UNKNOWN_USER; // أمان إضافي
    const user = await User.findById(userId)
        .select("_id full_name username profile_picture")
        .lean();
    return user || UNKNOWN_USER;
}

/**
 * (تصليح 1 - القنبلة 💣)
 * دي النسخة الجديدة اللي بتحل مشكلة الـ N+1
 * (وتم تحديثها لدعم الردود - Replies)
 */
const populatePostData = async (post) => {
    // 1. "بنجمع" كل الـ IDs اللي محتاجينها (بوست + كومنتات + ردود)
    // بنستخدم Set عشان نمنع التكرار
    const userIds = new Set();
    userIds.add(post.user.toString()); // نضيف صاحب البوست

    if (post.comments) {
        post.comments.forEach(c => {
            userIds.add(c.user.toString()); // نضيف بتوع الكومنتات

            // (تحديث للردود) - لو الكومنت فيه ردود، هات أصحابها كمان
            if (c.replies) {
                c.replies.forEach(r => userIds.add(r.user.toString()));
            }
        });
    }

    // 2. بنروح الداتابيز "مرة واحدة بس"
    const users = await User.find({ _id: { $in: [...userIds] } })
        .select("_id full_name username profile_picture")
        .lean();

    // 3. بنعمل "خريطة" (Map) لليوزرز عشان ندور فيهم بسرعة
    // (Key: "userId", Value: {userObject})
    const userMap = new Map(users.map(user => [user._id.toString(), user]));

    // 4. "بنركب" الداتا (في الميموري، سريع جداً)
    // بنجيب صاحب البوست من الخريطة
    const populatedUser = userMap.get(post.user.toString()) || UNKNOWN_USER;

    // بنلف على الكومنتات ونركب اليوزرز بتوعهم (وبتوع الردود)
    const populatedComments = post.comments ? post.comments.map(c => {
        const commentUser = userMap.get(c.user.toString()) || UNKNOWN_USER;

        // (تحديث للردود) - بنركب اليوزرز للردود
        const populatedReplies = c.replies ? c.replies.map(r => {
            const replyUser = userMap.get(r.user.toString()) || UNKNOWN_USER;
            // نتأكد إننا بنتعامل مع object سواء كان document أو lean
            const replyData = r.toObject ? r.toObject() : r;
            return { ...replyData, user: replyUser };
        }) : [];

        // نتأكد إننا بنتعامل مع object
        const commentData = c.toObject ? c.toObject() : c;

        return {
            ...commentData,
            user: commentUser,
            replies: populatedReplies // بنرجع الردود جاهزة
        };
    }) : [];

    // 5. بنرجع البوست "الجاهز"
    const postData = post.toObject ? post.toObject() : post;
    return {
        ...postData,
        user: populatedUser,
        comments: populatedComments
    };
}


// ========= CONTROLLERS =========
/**----------------------------------------------
 * @desc Get Feed Posts (Unified Logic For You & Following) 🌐
 * @route /api/post/feed
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getPostsFeed = expressAsyncHandler(async (req, res) => {
    // 1. استلام البيانات
    const currentUser = req.user; // Full User Object from Middleware
    const { type } = req.query;   // "for-you" or "following"

    // 2. Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ---------------------------------------------------------
    // 🚫 Zone 1: Block Logic (قائمة الحظر)
    // ---------------------------------------------------------
    // الناس اللي أنا حاظرهم
    const blockedByMe = currentUser.blockedUsers?.map(id => id.toString()) || [];
    // الناس اللي حاظريني (استعلام سريع)
    const usersWhoBlockedMe = await User.find({ blockedUsers: currentUser._id }).distinct('_id');
    const blockedByThem = usersWhoBlockedMe.map(id => id.toString());

    // القائمة السوداء الكاملة
    const baseExcludeList = [...blockedByMe, ...blockedByThem];

    // 2. شرط الإخفاء (يطبق على الكل)
    const isHiddenCondition = {
        $or: [
            { isHidden: false },
            { isHidden: { $exists: false } }
        ]
    };

    // ---------------------------------------------------------
    // 🔍 Zone 2: Query Builder (تحديد نوع الفيد)
    // ---------------------------------------------------------
    let query = {};

    if (type === 'following') {
        // ✅ Following Feed
        query = {
            $and: [
                {
                    user: {
                        $in: currentUser.following, // الناس اللي بتابعهم
                        $nin: baseExcludeList       // مش محظورين
                    }
                },
                isHiddenCondition // 👈 ضفنا الشرط هنا
            ]
        };
    }
    else {
        // 🌍 For You Feed:
        // (الكل) - (المحظورين) - (الحسابات الخاصة الغريبة)

        // 1. دايرتي (أنا + اللي بتابعهم)
        const myCircle = [...currentUser.following, currentUser._id];

        // 2. الحسابات الخاصة اللي "برا" دايرتي (ممنوع أشوفهم)
        const hiddenPrivateUsers = await User.find({
            isPrivate: true,
            _id: { $nin: myCircle }
        }).distinct('_id');

        // 3. القائمة النهائية للاستبعاد
        const finalExcludeList = [...baseExcludeList, ...hiddenPrivateUsers];

        query = {
            $and: [
                { user: { $nin: finalExcludeList } },
                isHiddenCondition // 👈 وضفناه هنا كمان
            ]
        };
    }

    // ---------------------------------------------------------
    // 🚀 Zone 3: Execution & Stories Injection
    // ---------------------------------------------------------
    console.log("Query:", JSON.stringify(query, null, 2)); // شوف هو بيدور على إيه
    // 1. جلب البوستات
    let posts = await Post.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'full_name username profile_picture isPrivate isVerified') // بيانات صاحب البوست
        .populate('comments.user', 'full_name username profile_picture')
        .lean();

    // 2. (اختياري بس جامد) إضافة الـ Stories لكل يوزر في الفيد 📸
    // عشان تظهر الدائرة الملونة حوالين صورته في الـ Feed
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // بنجمع كل الـ User IDs اللي ظهروا في البوستات دي
    const userIdsInFeed = posts.map(p => p.user._id);

    // بنجيب الستوريز النشطة لليوزرز دول مرة واحدة (Bulk Query)
    const activeStories = await Story.find({
        user: { $in: userIdsInFeed },
        createdAt: { $gte: twentyFourHoursAgo }
    }).lean();

    // بندمج الستوريز مع البوستات
    posts = posts.map(post => {
        const userStories = activeStories.filter(s => s.user.toString() === post.user._id.toString());

        // بنحسب هل أنا شفت الستوريز دي ولا لأ
        const storiesWithSeenStatus = userStories.map(s => ({
            ...s,
            // 👇 توحيد منطق الـ Seen بدقة
            seen: s.viewers ? s.viewers.some(v => {
                const viewerId = v.user ? v.user.toString() : v.toString();
                return viewerId === currentUser._id.toString();
            }) : false
        }));

        return {
            ...post,
            user: {
                ...post.user,
                stories: storiesWithSeenStatus,
                hasActiveStory: userStories.length > 0
            }
        };
    });

    // 3. إحصائيات الصفحات
    const totalPosts = await Post.countDocuments(query);

    res.status(200).json({
        success: true,
        posts,
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        hasMore: totalPosts > skip + posts.length
    });
});


/**----------------------------------------------
 * @desc Get Single Post
 * @route /api/post/:id
 * @method GET
 * @access Private/Public
--------------------------------------------------*/
export const getPostById = expressAsyncHandler(async (req, res) => {
    const { id } = req.params;

    // تأكد إن فيه auth، لو مفيش اعتبره زائر (لأن الراوت Public/Private)
    let viewerMongoId = null;
    if (req.auth) {
        const { userId: clerkId } = req.auth();
        const viewer = await User.findOne({ clerkId });
        viewerMongoId = viewer?._id;
    }

    // 1. هات البوست
    // استخدام .lean() مهم جداً عشان نقدر نعدل في الداتا براحتنا
    let post = await Post.findById(id)
        .populate("user", "full_name username profile_picture isPrivate isVerified blockedUsers")
        // 👇 التعديل هنا: بنعمل populate للكومنتات واليوزر اللي جواها
        .populate({
            path: "comments",
            populate: { path: "user", select: "full_name username profile_picture" }
        })
        .lean();

    if (!post) { res.status(404); throw new Error("Post not found."); }

    // =========================================================
    // 🔥🔥 الحل السحري لمشكلة الـ Key (Deduplication) 🔥🔥
    // =========================================================
    if (post.comments && Array.isArray(post.comments)) {
        const uniqueComments = [];
        const seenIds = new Set();

        post.comments.forEach(comment => {
            // نتأكد إن الكومنت موجود وليه ID (عشان لو فيه nulls في الداتابيز)
            if (comment && comment._id) {
                const idStr = comment._id.toString();
                // لو مشوفناش الـ ID ده قبل كده، ضيفه
                if (!seenIds.has(idStr)) {
                    seenIds.add(idStr);
                    uniqueComments.push(comment);
                }
            }
        });

        // استبدل القائمة القديمة بالقائمة النظيفة
        post.comments = uniqueComments;
    }
    // =========================================================

    // 🔒 2. Privacy Check
    // (لازم نتأكد إن post.user موجود عشان الـ lean ممكن يخليه null لو فيه مشكلة في الـ populate)
    if (post.user && post.user.isPrivate) {
        const isOwner = viewerMongoId && post.user._id.toString() === viewerMongoId.toString();
        // لازم تجيب الـ viewer كامل لو عايز تتشك على الـ following، بس هنا هنفترض إنك بتعديها
        // أو ممكن تعمل كويري بسيط تشوف هل أنا بتابعه

        if (!isOwner && viewerMongoId) {
            const viewerData = await User.findById(viewerMongoId).select('following');
            const isFollowing = viewerData?.following?.includes(post.user._id);

            if (!isFollowing) {
                res.status(403); throw new Error("This post is from a private account.");
            }
        }
    }

    // 🔥🔥🔥 التعديل هنا لتوحيد منطق الستوريز 🔥🔥🔥
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stories = await Story.find({
        user: post.user._id,
        createdAt: { $gte: twentyFourHoursAgo }
    })
        .populate("user", "full_name username profile_picture") // 👈 (مهم) لازم populate هنا
        .lean();

    if (post.user) {
        post.user.stories = stories.map(s => ({
            ...s,
            seen: s.viewers ? s.viewers.some(v => {
                const viewerId = v.user ? v.user.toString() : v.toString();
                return viewerMongoId && viewerId === viewerMongoId;
            }) : false
        }));
    }

    res.status(200).json({ success: true, post });
});


/**----------------------------------------------
 * @desc Get User By ID (Updated Logic 🚀)
 * @route /api/post/user/:userId
 * @method GET
 * @access Public/Private
--------------------------------------------------*/
export const getUserById = expressAsyncHandler(async (req, res) => {
    const { userId } = req.params;
    let { userId: myClerkId } = req.auth();

    // 1. Target User
    const targetUser = await User.findById(userId).select("-password -email").lean();
    if (!targetUser) { res.status(404); throw new Error("User not found."); }
    const targetUserIdStr = targetUser._id.toString();

    // 2. Viewer User (Full Data)
    const viewer = await User.findOne({ clerkId: myClerkId })
        .select("connections pendingRequests sentRequests blockedUsers following followRequests"); // زودنا following/followRequests

    const viewerMongoId = viewer?._id.toString();

    // =========================================================
    // 🛡️ المنطقة العازلة (Block Logic)
    // =========================================================
    if (viewer && viewerMongoId !== targetUserIdStr) {
        const isBlockedByMe = viewer.blockedUsers?.some(id => id.toString() === targetUserIdStr);
        const isBlockedByTarget = targetUser.blockedUsers?.some(id => id.toString() === viewerMongoId);

        if (isBlockedByMe || isBlockedByTarget) {
            return res.status(200).json({
                success: true,
                user: {
                    _id: targetUser._id,
                    full_name: isBlockedByMe ? targetUser.full_name : "User Unavailable",
                    username: isBlockedByMe ? targetUser.username : "unavailable",
                    profile_picture: isBlockedByMe ? targetUser.profile_picture : "/avatar-placeholder.png",
                    bio: null,
                    followers: [],
                    following: [],
                    isBlockedByMe,
                    isBlockedByTarget,
                },
                posts: [],
                connectionStatus: "none", // 👈 حالة افتراضية في البلوك
                hasMore: false
            });
        }
    }

    // =========================================================
    // 🔗 1. منطق الصداقة (Connection Logic Only) 🔗
    // =========================================================
    let connectionStatus = "none"; // (none, connected, sent, received, self)

    if (viewer) {
        if (viewerMongoId === targetUserIdStr) {
            connectionStatus = "self";
        }
        else if (viewer.connections?.some(id => id.toString() === targetUserIdStr)) {
            connectionStatus = "connected";
        }
        // هل جالي طلب صداقة منه؟ (نشوف الـ Pending بتوعي)
        else if (viewer.pendingRequests?.some(id => id.toString() === targetUserIdStr)) {
            connectionStatus = "received";
        }
        // هل أنا بعت طلب صداقة؟ (نشوف الـ Pending بتوعه هو، عشان نضمن إنه صداقة)
        else if (targetUser.pendingRequests?.some(id => id.toString() === viewerMongoId)) {
            connectionStatus = "sent";
        }
    }

    // =========================================================
    // 👣 2. منطق المتابعة (Follow Logic Only) 👣
    // =========================================================
    let followStatus = "none"; // (none, following, requested, self)

    if (viewer && viewerMongoId !== targetUserIdStr) {
        // هل أنا بتابعه؟
        if (viewer.following?.some(id => id.toString() === targetUserIdStr)) {
            followStatus = "following";
        }
        // هل أنا باعت طلب متابعة؟ (للحساب الخاص)
        // بنشوف في الـ followRequests بتوعه هو
        else if (targetUser.followRequests?.some(id => id.toString() === viewerMongoId)) {
            followStatus = "requested";
        }
    }

    // =========================================================
    // 📸 منطق الستوريز
    // =========================================================
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activeStories = await Story.find({
        user: targetUser._id,
        createdAt: { $gte: twentyFourHoursAgo }
    })
        .populate("user", "full_name username profile_picture")
        .lean();

    targetUser.stories = activeStories.map(story => {
        if (!viewer) return { ...story, seen: false };

        const viewersList = story.viewers || [];
        const isSeen = viewersList.some(v => {
            const viewerIdToCheck = v.user ? v.user.toString() : v.toString();
            return viewerIdToCheck === viewerMongoId;
        });

        return { ...story, seen: isSeen };
    });

    targetUser.hasActiveStory = activeStories.length > 0;

    // =========================================================
    // 🦅 منطق البوستات
    // =========================================================
    const isOwner = viewerMongoId === targetUserIdStr;
    let postQuery = { user: targetUser._id };

    if (!isOwner) {
        postQuery.$or = [
            { isHidden: false },
            { isHidden: { $exists: false } }
        ];
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find(postQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'full_name username profile_picture isVerified isPrivate')
        .populate('comments.user', 'full_name username profile_picture')
        .lean();

    // =========================================================
    // 🚀 الإرسال النهائي
    // =========================================================
    res.status(200).json({
        success: true,
        user: { ...targetUser, isBlockedByMe: false, isBlockedByTarget: false },
        posts, // المتغيرات دي معرفة تحت في كودك الأصلي
        connectionStatus, // 👈 حالة الصداقة
        followStatus,     // 👈 حالة المتابعة (الجديد)
        hasMore: posts.length === limit
    });
});


/**----------------------------------------------
 * @desc Add New Post
 * @route /api/post/add
 * @method POST
 * @access Private
--------------------------------------------------*/
export const addPost = expressAsyncHandler(async (req, res) => {
    // (الخطوة 3) شيلنا الـ "try" من هنا
    const { userId: clerkId } = req.auth();
    const { content, postType } = req.body;
    const files = req.files;

    // 📸 كمين 1: هل الملفات وصلت أصلاً من الفرونت إند؟
    console.log("📦 Incoming Files:", files ? files.length : "NO FILES");
    console.log("📝 Incoming Body:", req.body);
    // 2. (الخطوة الجديدة المهمة جداً 🔥)
    // بنروح نجيب اليوزر بتاعنا من الداتابيز باستخدام الـ Clerk ID
    const user = await User.findOne({ clerkId }); // (لازم يكون عندك حقل clerkId في موديل اليوزر)

    const hasContent = content && content.trim().length > 0;
    const hasFiles = files && files.length > 0;

    if (!hasContent && !hasFiles) {
        // (مهم) لما ترمي إيرور في "هاندلر" عادي، لازم تبعت status
        res.status(400);
        // وبنرمي "إيرور" عشان الهاندلر يمسكه
        throw new Error("Post cannot be empty.");
    }

    let image_urls = [];

    if (hasFiles) {
        image_urls = await Promise.all(
            files.map(async (file) => {
                const response = await imagekit.upload({
                    file: file.buffer,
                    fileName: file.originalname,
                    folder: "posts"
                });
                return response.url;
            })
        );
    }

    const newPost = await Post.create({
        user: user._id, // <--- هنا السر كله! استخدمنا الـ ObjectId الحقيقي
        content: content || "",
        post_type: postType,
        image_urls
    });

    const populatedPost = await populatePostData(newPost);

    res.status(201).json({
        success: true,
        message: "Post added successfully",
        post: populatedPost
    });

    // (الخطوة 4) شيلنا الـ "catch" من هنا
    // لإن لو أي "await" فوق ضرب، الهاندلر هيمسكه ويبعته للمدير
});


/**----------------------------------------------
 * @desc Update Post
 * @route /api/post/:id
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const updatePost = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth(); // ده الـ Clerk ID
    const { id } = req.params;
    const { content } = req.body;

    // 2. 👇 الخطوة الناقصة: هات اليوزر من الداتابيز باستخدام الـ Clerk ID
    const currentUser = await User.findOne({ clerkId: userId });

    if (!currentUser) {
        res.status(401);
        throw new Error("User not found in database");
    }

    // 3. هات البوست
    const post = await Post.findById(id);

    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    // 4. 👇 المقارنة الصح: قارن الـ ID اللي في البوست بالـ ID بتاع اليوزر من الداتابيز
    // (لازم toString عشان نضمن إننا بنقارن نصوص)
    if (post.user.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("You are not authorized to update this post.");
    }

    // 5. التعديل والحفظ
    post.content = content || post.content;
    const updatedPost = await post.save();

    res.status(200).json({
        success: true,
        message: "Post updated successfully.",
        post: updatedPost
    });
});


/**----------------------------------------------
 * @desc Delete Post
 * @route /api/post/:id
 * @method DELETE
 * @access Private
--------------------------------------------------*/
export const deletePost = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth(); // Clerk ID
    const { id } = req.params;     // Post ID

    // 1. نجيب اليوزر الحقيقي (عشان ناخد الـ _id بتاعه)
    const currentUser = await User.findOne({ clerkId: userId });

    if (!currentUser) {
        res.status(404);
        throw new Error("User not found.");
    }

    const post = await Post.findById(id);

    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    // 🔥🔥🔥 التصحيح هنا 🔥🔥🔥
    // قارن صاحب البوست بـ currentUser._id (مش userId بتاع Clerk)
    if (post.user.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("You are not authorized to delete this post.");
    }

    // هنا ممكن تضيف كود مسح الصور من imagekit لو حابب (Premium Step)

    await Post.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: "Post deleted successfully."
    });
});


/**----------------------------------------------
 * @desc Like / Unlike Post
 * @route /api/post/like/:postId
 * @method POST
 * @access Private
--------------------------------------------------*/
export const likeUnlikePost = expressAsyncHandler(async (req, res) => {
    // 1. ✅ بنجيب الـ _id الحقيقي لليوزر الحالي (أنا)
    const userId = req.user._id;

    // 2. ✅ بنستقبل id البوست
    const { id: postId } = req.params;

    // لازم نعمل populate لليوزر عشان نجيب الـ _id بتاعه للإشعار
    const post = await Post.findById(postId); // مش محتاج populate هنا لو الـ user متخزن كـ ObjectId

    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    // 3. ✅ التأكد إن مصفوفة اللايكات موجودة
    if (!post.likes) {
        post.likes = [];
    }

    // مقارنة الـ ObjectIds ببعض
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
        // --- حالة إلغاء اللايك (Unlike) ---
        post.likes = post.likes.filter(id => id.toString() !== userId.toString());

        // (اختياري: ممكن تمسح الإشعار لو شال اللايك)
        await Notification.findOneAndDelete({
            from_user: userId,
            post: post._id,
            type: "like"
        });

    } else {
        // --- حالة عمل اللايك (Like) ---
        post.likes.push(userId);

        // 🔔 إنشاء الإشعار (مباشرة هنا عشان نضمن صحة البيانات)
        // بنشيك إن مش أنا اللي بعمل لايك لنفسي
        if (post.user.toString() !== userId.toString()) {
            try {
                // 👇👇 الحل السحري لتجنب CastError 👇👇
                // بنستخدم Mongoose Direct Call
                await Notification.create({
                    recipient: post.user, // ✅ ده ObjectId (صاحب البوست)
                    sender: userId,    // ✅ ده ObjectId (أنا)
                    post: post._id,       // ✅ ده ObjectId (البوست)
                    type: "like"
                });

            } catch (error) {
                console.log("Notification Error:", error.message);
                // بنكمل عادي حتى لو الإشعار فشل عشان اللايك ميقفش
            }
        }
    }

    await post.save();

    res.status(200).json({
        success: true,
        message: isLiked ? "Post unliked" : "Post liked",
        likes: post.likes,
        likes_count: post.likes.length
    });
});


/**----------------------------------------------
 * @desc Add Comment to Post
 * @route /api/post/comment/:postId
 * @method POST
 * @access Private
--------------------------------------------------*/
export const addComment = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { postId } = req.params;
    const { text, parentId } = req.body;

    if (!text || text.trim().length === 0) {
        res.status(400);
        throw new Error("Comment text is required.");
    }

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found.");
    }

    const post = await Post.findById(postId);
    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    // إنشاء الكومنت
    let newComment = await Comment.create({
        user: currentUser._id,
        post: postId,
        text,
        parentId: parentId || null
    });

    newComment = await newComment.populate("user", "username full_name profile_picture");
    await Post.findByIdAndUpdate(postId, { $push: { comments: newComment._id } });

    // 🔥🔥🔥 إضافة الإشعار (Notification Logic) 🔥🔥🔥
    if (post.user.toString() !== currentUser._id.toString()) {
        try {
            await Notification.create({
                recipient: post.user,    // صاحب البوست
                sender: currentUser._id, // أنا (اللي كتبت الكومنت)
                type: 'comment',         // نوع الإشعار
                // 👇 التعديل هنا: لو فيه parentId يبقى ده 'reply'، لو مفيش يبقى 'comment'
                type: parentId ? 'reply' : 'comment',
                post: post._id,          // البوست
                commentId: newComment._id // الكومنت نفسه
            });
        } catch (error) {
            console.log("Notification Error (Comment):", error.message);
        }
    }

    res.status(201).json({
        success: true,
        message: parentId ? "Reply added successfully" : "Comment added successfully",
        comment: newComment
    });
});


/**----------------------------------------------
 * @desc Update Comment
 * @route /api/post/comment/:commentId
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const updateComment = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { commentId } = req.params;
    const { text } = req.body;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }

    // validation بسيط
    if (!text || text.trim().length === 0) {
        res.status(400);
        throw new Error("Comment text is required.");
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        res.status(404);
        throw new Error("Comment not found.");
    }

    // 3. (Security Check 🛡️)
    // التعديل مسموح لصاحب الكومنت "فقط"
    if (comment.user.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("You are not authorized to update this comment.");
    }

    // 4. التعديل والحفظ
    comment.text = text;
    comment.isEdited = true; // 👈 ضيف السطر ده عشان نعلم عليه
    await comment.save();

    // (اختياري) ممكن تعمل populate وترجعه تاني عشان لو الفرونت محتاج يحدثه فوراً
    // const updatedComment = await comment.populate('user', 'full_name username profile_picture');

    res.status(200).json({
        success: true,
        message: "Comment updated successfully.",
        comment: comment
    });
});


/**----------------------------------------------
 * @desc Delete Comment (Cascade Delete 🌳)
 * @route /api/post/comment/:commentId
 * @method DELETE
 * @access Private
--------------------------------------------------*/
// 1️⃣ دالة مساعدة تجيب كل عيال الكومنت وعيال عياله (Recursion)
const getRecursiveCommentIds = async (commentId) => {
    // هات كل الكومنتات اللي الـ parentId بتاعها هو الكومنت ده
    const children = await Comment.find({ parentId: commentId });

    let ids = [];

    // لكل طفل، هات عياله هو كمان
    for (const child of children) {
        ids.push(child._id); // ضيف الطفل ده
        const grandChildrenIds = await getRecursiveCommentIds(child._id); // هات أحفاده
        ids = [...ids, ...grandChildrenIds]; // ضيف الأحفاد
    }

    return ids;
};

export const deleteComment = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { commentId } = req.params;

    // 1. هات اليوزر
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) { res.status(404); throw new Error("User not found."); }

    // 2. هات الكومنت المستهدف
    const comment = await Comment.findById(commentId);
    if (!comment) { res.status(404); throw new Error("Comment not found."); }

    // 3. هات البوست المرتبط
    const post = await Post.findById(comment.post);
    if (!post) { res.status(404); throw new Error("Post not found."); }

    // 4. (Security Check)
    const isCommentOwner = comment.user.toString() === currentUser._id.toString();
    const isPostOwner = post.user.toString() === currentUser._id.toString();

    if (!isCommentOwner && !isPostOwner) {
        res.status(403);
        throw new Error("You are not authorized to delete this comment.");
    }

    // =========================================================
    // 🔥🔥 العملية الجراحية (Cascade Delete) 🔥🔥
    // =========================================================

    // أ) هات قائمة بكل العيال والأحفاد اللي محتاجين يتمسحوا
    const childrenIds = await getRecursiveCommentIds(commentId);

    // ب) ضيف عليهم الكومنت الأصلي نفسه (الأب)
    const allIdsToDelete = [comment._id, ...childrenIds];

    // ج) امسحهم كلهم من كولكشن الكومنتات مرة واحدة
    await Comment.deleteMany({
        _id: { $in: allIdsToDelete }
    });

    // د) شيلهم كلهم من مصفوفة البوست (عشان العداد يظبط)
    await Post.findByIdAndUpdate(comment.post, {
        $pull: { comments: { $in: allIdsToDelete } }
    });

    res.status(200).json({
        success: true,
        message: `Comment and ${childrenIds.length} replies deleted successfully.`,
        deletedCount: allIdsToDelete.length // (اختياري) عرف الفرونت مسحنا كام واحد
    });
});


/**----------------------------------------------
 * @desc Like / Unlike Comment
 * @route /api/post/comment/like/:commentId
 * @method POST
 * @access Private
--------------------------------------------------*/
export const toggleCommentLike = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { commentId } = req.params;

    // 1. هات اليوزر صاحب الطلب
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }

    // 2. هات الكومنت
    const comment = await Comment.findById(commentId);
    if (!comment) {
        res.status(404);
        throw new Error("Comment not found.");
    }

    // 3. تأكد إن المصفوفة موجودة
    if (!comment.likes) {
        comment.likes = [];
    }

    // 👇👇👇 التعديل الجوهري هنا 👇👇👇
    // لازم نقارن ID بـ ID ونحولهم لنصوص
    const userIdStr = currentUser._id.toString();
    const isLiked = comment.likes.some(id => id.toString() === userIdStr);

    if (isLiked) {
        // لو عامل لايك -> شيله (Filter)
        comment.likes = comment.likes.filter(id => id.toString() !== userIdStr);
    } else {
        // لو مش عامل -> ضيف الـ ID بس (مش اليوزر كله)
        comment.likes.push(currentUser._id);
    }

    await comment.save();

    res.status(200).json({
        success: true,
        message: isLiked ? "Comment unliked" : "Comment liked",
        likes_count: comment.likes.length
    });
});


/**----------------------------------------------
 * @desc Share Post
 * @route /api/post/share/:id
 * @method POST
 * @access Private
--------------------------------------------------*/
export const sharePost = expressAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.auth();

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }

    const post = await Post.findById(id);
    if (!post) {
        res.status(404);
        throw new Error("Post not found");
    }

    const updatedPost = await Post.findByIdAndUpdate(
        id,
        { $push: { shares: currentUser._id } },
        { new: true }
    );

    // 🔥🔥🔥 إضافة الإشعار (Notification Logic) 🔥🔥🔥
    if (post.user.toString() !== currentUser._id.toString()) {
        try {
            await Notification.create({
                recipient: post.user,    // صاحب البوست
                sender: currentUser._id, // أنا (اللي عملت شير)
                type: 'share',           // نوع الإشعار
                post: post._id           // البوست
            });
        } catch (error) {
            console.log("Notification Error (Share):", error.message);
        }
    }

    res.status(200).json(updatedPost);
});


/**----------------------------------------------
 * @desc Save Post
 * @route /api/post/save/:id
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const togglePostSave = expressAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.auth();

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }

    const post = await Post.findById(id);
    if (!post) {
        res.status(404);
        throw new Error("Post not found");
    }

    const isSaved = post.saves.includes(currentUser._id);

    if (isSaved) {
        post.saves.pull(currentUser._id);
    } else {
        post.saves.push(currentUser._id);
    }

    await post.save();

    res.status(200).json({
        success: true,
        message: isSaved ? "Post unsaved successfully" : "Post saved successfully",
        saves: post.saves,
        saves_count: post.saves.length
    });
});


/**----------------------------------------------
 * @desc Get Saved Posts
 * @route /api/post/saved
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getSavedPosts = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth(); // Clerk ID

    // 1. نجيب اليوزر الحقيقي
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found.");
    }

    // 2. Pagination (عشان لو حافظ 1000 بوست الصفحة متموتش)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 3. الكويري السحري: هات البوستات اللي أنا موجود في قائمة الـ saves بتاعتها
    // ونستبعد البوستات المخفية (Moderation)
    const query = {
        saves: currentUser._id,
        $or: [
            { isHidden: false },
            { isHidden: { $exists: false } }
        ]
    };

    // 4. تنفيذ البحث
    let posts = await Post.find(query)
        .sort({ createdAt: -1 }) // الأحدث إنشاءً (ممكن تغيرها لآخر حاجة اتحفظت لو غيرت السكيما)
        .skip(skip)
        .limit(limit)
        .populate('user', 'full_name username profile_picture isPrivate isVerified')
        .populate('comments.user', 'full_name username profile_picture')
        .lean();

    // 5. (Consistency) 🔥 نضيف منطق الستوريز عشان الشكل يبقى موحد مع الفيد
    // (نسخ لصق من لوجيك getPostsFeed عشان الاحترافية)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userIdsInFeed = posts.map(p => p.user._id);

    const activeStories = await Story.find({
        user: { $in: userIdsInFeed },
        createdAt: { $gte: twentyFourHoursAgo }
    }).lean();

    posts = posts.map(post => {
        const userStories = activeStories.filter(s => s.user.toString() === post.user._id.toString());
        const storiesWithSeenStatus = userStories.map(s => ({
            ...s,
            seen: s.viewers ? s.viewers.some(v => v.toString() === currentUser._id.toString()) : false
        }));

        return {
            ...post,
            user: {
                ...post.user,
                stories: storiesWithSeenStatus,
                hasActiveStory: userStories.length > 0
            }
        };
    });

    // 6. الإحصائيات للـ Pagination
    const totalPosts = await Post.countDocuments(query);

    res.status(200).json({
        success: true,
        posts,
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        hasMore: totalPosts > skip + posts.length
    });
});


/**----------------------------------------------
 * @desc Report a Post
 * @route /api/post/report/:id
 * @method POST
 * @access Private
--------------------------------------------------*/
export const reportPost = expressAsyncHandler(async (req, res) => {
    const { id: postId } = req.params;
    const { userId } = req.auth();
    const { reason } = req.body; // السبب هيجي من الفرونت

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found via Clerk ID");
    }


    // 1. تأكد إن البوست موجود
    const post = await Post.findById(postId);
    if (!post) { res.status(404); throw new Error("Post not found"); }

    // 2. تأكد إن اليوزر مبلغش عن نفس البوست ده قبل كده (عشان Spam Reports)
    const existingReport = await Report.findOne({ reporter: currentUser, targetPost: postId });
    if (existingReport) {
        res.status(400);
        throw new Error("You have already reported this post");
    }

    // 3. إنشاء البلاغ
    await Report.create({
        reporter: currentUser,
        targetPost: postId,
        reason: reason || "Other"
    });

    // 👇👇👇 اللوجيك الجديد: عداد العقاب 👇👇👇

    // 2. عد كل الريبورتات اللي معمولة على البوست ده
    const reportCount = await Report.countDocuments({ targetPost: postId });

    // 3. حدد "رقم الخطر" (Threshold) - خليه 5 مثلاً
    const REPORT_THRESHOLD = 5;

    if (reportCount >= REPORT_THRESHOLD) {
        // 4. تنفيذ الحكم: إخفاء البوست
        await Post.findByIdAndUpdate(postId, { isHidden: true });
        console.log(`🚨 Auto-Moderation: Post ${postId} hidden due to high reports.`);
    }

    res.status(201).json({ success: true, message: "Report submitted. Thank you for making our community safer." });
});