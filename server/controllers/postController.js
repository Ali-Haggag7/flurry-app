import expressAsyncHandler from "express-async-handler"
import Post from "../models/Post.js"
import User from "../models/User.js"
import Comment from "../models/Comment.js"
import imagekit from "../configs/imagekit.js"; // 👈 لازم الامتداد .js في الآخر
import Notification from "../models/Notification.js"


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
 * @desc Get Posts Feed
 * @route /api/post/feed
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getPostsFeed = expressAsyncHandler(async (req, res) => {

    // 👇👇👇 (التعديل المهم جداً) 👇👇👇
    // بدل ما نجيب Clerk ID، بنستخدم اليوزر الجاهز اللي الميدلوير جابه
    // req.user هنا هو الـ Document الكامل من الداتابيز (بما فيه الـ _id والـ blockedUsers)
    const currentUser = req.user;

    // (تحسين 5) - Pagination (جلب رقم الصفحة والعدد)
    // بنجيب رقم الصفحة من (req.query)، لو مش موجود بنفترض 1
    const page = parseInt(req.query.page) || 1;
    // بنجيب العدد (الـ limit)، لو مش موجود بنفترض 10
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit; // الحسبة بتاعة "هنطنش كام بوست"

    // --- (تصليح 2 & 3 & 4) - لوجيك البلوك والاستبعاد ---

    // 1. هات اليوزر "بتاعي" (عشان أعرف أنا عملت بلوك لمين)
    // (ملحوظة: currentUser جاي من الميدلوير، فمش محتاجين نعمل findById تاني هنا إلا لو عايز تتأكد إنه up-to-date أوي)
    // بس للأمان ممكن نستخدم القيمة اللي جاية معانا علطول:

    // (تصليح 4) - بنصلح الـ map عشان تبقى مقروءة
    const blockedByMe = currentUser.blockedUsers?.map(id => id.toString()) || [];

    // 2. (تصليح 2) - هات الناس اللي "هما" عملولي بلوك
    // 👇 هنا بنستخدم currentUser._id (بتاع مونجو) مش Clerk ID
    const usersWhoBlockedMe = await User.find({ blockedUsers: currentUser._id })
        .select("_id")
        .lean();
    const blockedByThem = usersWhoBlockedMe.map(user => user._id.toString());

    // 3. لستة الاستبعاد "الكاملة"
    // (تصليح 3) - شيلنا "userId" عشان نشوف بوستاتنا
    const excludeIds = [...blockedByMe, ...blockedByThem];

    // --- الكويري الأساسي (جلب البوستات) ---
    const posts = await Post.find({
        user: { $nin: excludeIds } // هات البوستات اللي أصحابها "مش" في لستة الاستبعاد
    })
        .sort({ createdAt: -1 }) // رتب من الجديد للقديم
        .skip(skip)              // (تحسين 5) - نطنش الصفحات اللي فاتت
        .limit(limit)            // (تحسين 5) - هات 10 بس
        .populate('comments.user', '_id full_name username profile_picture') // (حل سحري جزئي)
        .populate('user', '_id full_name username profile_picture')          // (حل سحري جزئي)
        .lean();

    /* * (توضيح الحل السحري 👆)
     * في مشكلة الـ N+1، الحل الأسرع (بدل التجميع اليدوي) هو استخدام "populate" بتاع Mongoose.
     * إحنا هنا بنقوله: "بعد ما تجيب الـ 10 بوستات، روح هات "user" بتاع كل بوست، وهات "user" بتاع كل كومنت جوه كل بوست".
     * Mongoose ذكي كفاية إنه هيعمل ده في "كويري واحد" لكل populate (يعني 1 للبوستات + 1 لليوزرز + 1 لبتوع الكومنتات = 3 كويريز).
     * ده "أنضف" بكتير من إننا نعمل اللوجيك اليدوي بتاع التجميع طالما إحنا بنستخدم Mongoose.
     * (ملحوظة: الحل اليدوي اللي شرحته فوق (التجميع في Set) بيبقى "أسرع" في الداتابيز الكبيرة جداً، بس الحل ده (populate) "أنضف" في الكود 100 مرة).
     * عشان الكود ده يشتغل، لازم الموديل بتاع "Post" يكون فيه `ref: "User"` مظبوط.
     */

    // --- (حل بديل لو الـ populate مش شغال) ---
    // (نفس الكود المعطل بتاعك، سيبته زي ما هو عشان المرجع)
    /*
    const userIds = new Set();
    posts.forEach(post => {
        userIds.add(post.user.toString());
        if (post.comments) { // نتأكد إن فيه كومنتات
            post.comments.forEach(c => userIds.add(c.user.toString()));
        }
    });

    const users = await User.find({ _id: { $in: [...userIds] } })
        .select("_id full_name username profile_picture")
        .lean();
    
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    const postsWithUserData = posts.map(post => {
        const populatedUser = userMap.get(post.user.toString()) || UNKNOWN_USER;
        const populatedComments = post.comments ? post.comments.map(c => {
            return { ...c, user: userMap.get(c.user.toString()) || UNKNOWN_USER };
        }) : [];

        return { ...post, user: populatedUser, comments: populatedComments };
    });
    */
    // --- (نهاية الحل البديل) ---

    res.status(200).json({
        success: true,
        posts: posts, // (بنرجع البوستات اللي الـ populate جهزها)
        currentPage: page,
        totalPages: Math.ceil(await Post.countDocuments({ user: { $nin: excludeIds } }) / limit) // (تحسين) بنرجع عدد الصفحات
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

    const post = await Post.findById(id);

    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    // بنستخدم الـ Helper بتاعنا عشان يجيب بيانات اليوزر والكومنتات
    // (Helper ده عبقري لإنه بيحل مشكلة N+1 في الكومنتات)
    const postWithData = await populatePostData(post);

    res.status(200).json({
        success: true,
        post: postWithData
    });
});


/**----------------------------------------------
 * @desc Get User By ID (Profile Page)
 * @route /api/post/user/:userId
 * @method GET
 * @access Public
--------------------------------------------------*/
export const getUserById = expressAsyncHandler(async (req, res) => {
    const { userId } = req.params;

    // (تصليح 1 & 2) - صلحنا الكويري وحددنا الحقول المطلوبة فقط
    const user = await User.findById(userId) // أو findOne({ clerkId: userId }) لو بتبعت clerkId
        .select("-password -email -updatedAt") // (أمان) شيل البيانات الحساسة
        .lean();

    if (!user) {
        res.status(404);
        throw new Error("User not found.");
    }

    // (تحسين) - Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // (كويري البوستات)
    const posts = await Post.find({ user: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // (تحسين 3) - مش هنعمل populate لـ user هنا، لإنه معانا أصلاً
        .populate('comments.user', 'full_name username profile_picture') // نجيب بس أصحاب الكومنتات
        .lean();

    // (تحسين 3 - الذكاء كله هنا) 🧠
    // بدل ما نلف ونعمل كويري لكل بوست عشان نجيب صاحبه، بنركب اليوزر اللي جبناه فوق
    const postsWithUserData = posts.map(post => ({
        ...post,
        user: user // ركبنا أوبجكت اليوزر (اللي جبناه في أول سطر) جوه البوست
    }));

    res.status(200).json({
        success: true,
        user, // بيانات البروفايل
        posts: postsWithUserData, // البوستات بتاعته
        hasMore: posts.length === limit // عشان الفرونت إند يعرف فيه تاني ولا لأ
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
    const { userId } = req.auth();
    const { id } = req.params;
    const { content } = req.body;

    // 1. هات البوست من الداتابيز
    const post = await Post.findById(id);

    // 2. أمان: اتأكد إنه موجود أصلاً
    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    // 3. (أهم نقطة أمنية 🛡️) Authorization Check
    // هل اليوزر اللي باعت الطلب هو هو صاحب البوست؟
    if (post.user.toString() !== userId) {
        res.status(403); // 403 Forbidden (ممنوع)
        throw new Error("You are not authorized to update this post.");
    }

    // 4. التعديل (بنعدل المحتوى النصي)
    // لو مبعتش content جديد، خلي القديم زي ما هو
    post.content = content || post.content;

    // (ملحوظة: تعديل الصور قصة تانية بتحتاج رفع ملفات ومسح القديم من imagekit)
    // (عادة زرار Edit بيسمح بتعديل الكلام بس، وده الأسهل والأكثر شيوعاً)

    // 5. سيف التغييرات
    const updatedPost = await post.save();

    // 6. الرد
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
    const { userId } = req.auth();
    const { id } = req.params; // ID البوست

    const post = await Post.findById(id);

    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    // (Check Ownership) - تأكد إن ده صاحب البوست
    if (post.user.toString() !== userId) {
        res.status(403); // 403 Forbidden
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
export const addCommentToPost = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { postId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
        res.status(400);
        throw new Error("Comment text is required.");
    }

    const post = await Post.findById(postId);

    if (!post) {
        res.status(404);
        throw new Error("Post not found.");
    }

    // 1. نكريت الكومنت
    const newComment = await Comment.create({
        post: postId,
        user: userId,
        text: text,
    });

    // 2. نضيفه للبوست (بنسيف الـ ID بس عشان الداتابيز متتقلش)
    // (تأكد إن الموديل بتاع Post الـ comments فيه type: ObjectId)
    post.comments.unshift(newComment._id);
    await post.save();

    // 3. (الخطوة الـ Premium) 🌟
    // لازم نجيب بيانات اليوزر عشان الفرونت يعرض الكومنت فوراً بصورته واسمه
    // بنعمل "Populate يدوي" سريع
    const commentUser = await User.findById(userId)
        .select("full_name username profile_picture")
        .lean();

    // بنركب اليوزر جوه الكومنت عشان يرجع كامل
    const commentToReturn = {
        ...newComment.toObject(),
        user: commentUser
    };

    // (هنا مكان الإشعار لو حبيت تضيفه)

    res.status(201).json({
        success: true,
        message: "Comment added successfully.",
        comment: commentToReturn // (تصليح الباج) بنرجع الكومنت الجديد بالبيانات
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
    if (comment.user.toString() !== userId) {
        res.status(403);
        throw new Error("You are not authorized to update this comment.");
    }

    // 4. التعديل والحفظ
    comment.text = text;
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
 * @desc Delete Comment
 * @route /api/post/comment/:commentId
 * @method DELETE
 * @access Private
--------------------------------------------------*/
export const deleteComment = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { commentId } = req.params;

    // 1. هات الكومنت عشان نتأكد إنه موجود ونعرف مين صاحبه
    const comment = await Comment.findById(commentId);

    if (!comment) {
        res.status(404);
        throw new Error("Comment not found.");
    }

    // 2. هات البوست عشان نعرف مين صاحبه (لإن صاحب البوست من حقه يمسح برضه)
    const post = await Post.findById(comment.post);

    if (!post) {
        // حالة نادرة جداً إن الكومنت يكون موجود والبوست ممسوح، بس للأمان
        res.status(404);
        throw new Error("Post associated with this comment not found.");
    }

    // 3. (Premium Security Check 🛡️)
    // هل أنت صاحب الكومنت؟ أو أنت صاحب البوست؟
    const isCommentOwner = comment.user.toString() === userId;
    const isPostOwner = post.user.toString() === userId;

    if (!isCommentOwner && !isPostOwner) {
        res.status(403);
        throw new Error("You are not authorized to delete this comment.");
    }

    // 4. امسح الكومنت من كولكشن الكومنتات
    await Comment.findByIdAndDelete(commentId);

    // 5. (خطوة مهمة) شيل الـ ID بتاعه من مصفوفة الكومنتات جوه البوست
    // بنستخدم $pull عشان نسحبه من المصفوفة
    await Post.findByIdAndUpdate(comment.post, {
        $pull: { comments: commentId }
    });

    res.status(200).json({
        success: true,
        message: "Comment deleted successfully."
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

    const comment = await Comment.findById(commentId);

    if (!comment) {
        res.status(404);
        throw new Error("Comment not found.");
    }

    // تأكد إن الموديل بتاع Comment فيه: likes: [{type: ObjectId, ref: "User"}]
    // لو مصفوفة الـ likes مش موجودة (لأمان الكود)
    if (!comment.likes) {
        comment.likes = [];
    }

    const isLiked = comment.likes.includes(userId);

    if (isLiked) {
        // لو عامل لايك -> شيله
        comment.likes.pull(userId);
    } else {
        // لو مش عامل -> ضيفه
        comment.likes.push(userId);

        // (Premium Step) - ابعت إشعار لصاحب الكومنت
        // if (comment.user.toString() !== userId) { ... }
    }

    await comment.save();

    res.status(200).json({
        success: true,
        message: isLiked ? "Comment unliked" : "Comment liked",
        likes_count: comment.likes.length
    });
});


/**----------------------------------------------
 * @desc Reply to a Comment
 * @route /api/post/comment/reply/:commentId
 * @method POST
 * @access Private
--------------------------------------------------*/
export const addReplyToComment = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { commentId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
        res.status(400);
        throw new Error("Reply text is required.");
    }

    // 1. هات الكومنت الأصلي
    const comment = await Comment.findById(commentId);

    if (!comment) {
        res.status(404);
        throw new Error("Comment not found.");
    }

    // 2. جهز الرد
    const newReply = {
        user: userId,
        text: text,
        createdAt: new Date()
    };

    // 3. ضيف الرد في مصفوفة الردود
    comment.replies.push(newReply);
    await comment.save();

    // 4. (Premium Step) 🌟
    // لازم نرجع الرد "كامل" (ببيانات اليوزر) عشان الفرونت يعرضه
    // بس عشان الرد جوه مصفوفة، الـ populate العادي مش هينفع هنا بسهولة
    // فبنعمل "خدعة" بسيطة: بنجيب بيانات اليوزر ونركبها يدوي للرد اللي راجع

    const replyUser = await User.findById(userId)
        .select("full_name username profile_picture")
        .lean();

    const replyToReturn = {
        ...newReply,
        user: replyUser
    };

    res.status(201).json({
        success: true,
        message: "Reply added successfully.",
        reply: replyToReturn
    });
});