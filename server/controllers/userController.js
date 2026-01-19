import expressAsyncHandler from "express-async-handler";
import User from "../models/User.js";
import imagekit from "../configs/imagekit.js"; // 👈 لازم الامتداد .js في الآخر
import Notification from "../models/Notification.js"; // 👈 (1) استيراد موديل الإشعار
import { createNotification } from "./notificationController.js"; // 👈 (2) استيراد دالة الإشعار
import sendEmail from "../utils/sendEmail.js";
import { io, getReceiverSocketId } from "../socket/socket.js"; // 👈 تأكد إنك عامل Import لدول فوق


/**----------------------------------------------
 * @desc مزامنة اليوزر (أول مرة لوج إن)
 * @route /api/user/sync
 * @method POST
 * @access Private (محمي بتوكن)
--------------------------------------------------*/
export const syncUser = expressAsyncHandler(async (req, res) => {
    // 1. استقبل البيانات
    console.log("Sync User Body:", req.body);

    const { id, emailAddresses, firstName, lastName, imageUrl, username } = req.body;

    // محاولة جلب الـ ID من البودي أو من التوكن
    // (ملحوظة: req.auth ساعات بتبقى دالة وساعات أوبجكت حسب إصدار Clerk، سيبها زي ما شغالة عندك)
    const clerkUserId = id || (req.auth && typeof req.auth === 'function' ? req.auth().userId : req.auth?.userId);

    if (!clerkUserId) {
        res.status(400);
        throw new Error("Clerk User ID is missing");
    }

    // تجهيز البيانات
    const email = emailAddresses?.[0]?.emailAddress || req.body.email;
    const fullName = (firstName && lastName) ? `${firstName} ${lastName}` : (req.body.fullName || "User");
    const image = imageUrl || req.body.profilePicture || "";
    // لو مفيش يوزر نيم، خد الجزء اللي قبل @ في الإيميل
    const userNameData = username || req.body.username || email?.split("@")[0] || `user_${Date.now()}`;

    // 2. البحث باستخدام clerkId
    let user = await User.findOne({ clerkId: clerkUserId });

    // 3. التحديث (لو اليوزر موجود)
    if (user) {
        user.email = email;
        user.full_name = fullName;
        if (image) {
            user.profile_picture = image;
        }
        user.username = userNameData;

        await user.save();
        console.log("User Updated:", user);
        return res.status(200).json({ success: true, user });
    }

    // 4. الإنشاء (لو اليوزر جديد)
    user = await User.create({
        clerkId: clerkUserId,
        email: email,
        full_name: fullName,
        username: userNameData,
        profile_picture: image
    });

    // 👇👇👇 5. إرسال إيميل الترحيب (Welcome Email) 👇👇👇
    // بنعملها هنا عشان تشتغل مرة واحدة بس مع التسجيل الجديد
    try {
        // مش بنحط await عشان منعملش تعطيل لليوزر، خليها تبعت في الخلفية
        sendEmail({
            to: email,
            subject: "Welcome to Rift Family! 🚀",
            html: `
                <div style="font-family: sans-serif; text-align: center; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
                    <h1 style="color: #2563eb;">Welcome ${fullName}! 👋</h1>
                    <p style="font-size: 16px; color: #374151;">We are thrilled to have you on board.</p>
                    <p style="font-size: 16px; color: #374151;">Start connecting with people now!</p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #9ca3af;">Rift Team</p>
                </div>
            `
        });
    } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
        // مش بنوقف الرد، بنكمل عادي
    }

    console.log("User Created:", user);
    res.status(201).json({ success: true, user });
});


/**----------------------------------------------
 * @desc Get Logged-In User's Data
 * @route /api/user/me  (ده الاسم المتعارف عليه للرابط ده)
 * @method GET
 * @access Private (محمي - لازم توكن)
--------------------------------------------------*/
export const getUserData = expressAsyncHandler(async (req, res) => {

    // 1. (!! التعديل الأهم !!)
    // إحنا هنا بنثق في "البواب" (protect)
    // ومش بننادي req.auth() تاني.
    // اليوزر ID جاهز في req.user اللي البواب سلمهولنا
    const userId = req.user.id; // <--- الكراش اتصلح هنا

    // 3. بندور على اليوزر في الداتا بيز بالـ ID
    // .select("-password") عشان نرجع بياناته من غير الباسورد
    const user = await User.findById(userId)
        .select("-password")
        .populate("followers", "full_name username profile_picture") // 👈 لازم ده
        .populate("following", "full_name username profile_picture") // 👈 ولازم ده
        .populate("connections", "full_name username profile_picture")
        .populate("pendingRequests", "full_name username profile_picture")
        .populate("sentRequests", "full_name username profile_picture")
        .populate("followRequests", "full_name username profile_picture");

    // 4. (ده التشيك المنطقي الصح)
    // بنتأكد إننا *لقينا* اليوزر في الداتا بيز
    // (ممكن يكون التوكن سليم بس اليوزر اتمسح من الداتا بيز)
    if (!user) {
        // res.status(404) معناها "Not Found"
        return res.status(404).json({ success: false, message: "User not found" });
    }

    // 5. لو لقينا اليوزر، بنرجعه
    return res.status(200).json({ success: true, data: user });

    // 6. مش محتاجين try...catch
    // لو أي إيرور حصل (زي الداتا بيز فصلت)، 
    // expressAsyncHandler هيمسكه ويبعته للـ Error Handler بتاعك
})


/**----------------------------------------------
 * @desc Update Logged-in User's Data
 * @route /api/user/update-profile (ده اسم منطقي أكتر)
 * @method PUT
 * @access Private (محمي بتوكن، عشان req.auth)
--------------------------------------------------*/
export const updateUserData = expressAsyncHandler(async (req, res) => {

    // 1. هنجيب اليوزر من الـ req.auth() زي ما إنت عامل
    // (أو من req.user.id لو بتستخدم "البواب" اللي عملناه قبل كده)
    const { userId } = req.auth();

    // 2. (!! التعديل الأهم !!)
    // هنستخدم "let" بدل "const" عشان نقدر نغير قيمة اليوزرنيم
    let { username, bio, location, full_name } = req.body;

    // 3. هنتأكد إن اليوزرنيم مش متاخد (لو اليوزر بيغيره)
    if (username) {
        const tempUser = await User.findOne({ clerkId: userId });
        if (tempUser.username !== username) {
            // اليوزر بيغير اسمه، نتأكد إن الاسم الجديد مش متاخد
            const userExists = await User.findOne({ username });
            if (userExists) {
                // لو متاخد، هنرجع إيرور
                res.status(400); // 400 = Bad Request
                throw new Error("Username is already taken");
                // (أحسن ما نرجعله اسمه القديم من غير ما يعرف)
            }
        }
    }

    // 4. هنجهز البيانات الجديدة (مبدئياً)
    // هنستخدم "..." (spread operator) عشان نفلتر أي حاجة فاضية
    // ده بيضيف "username" للـ object بس لو "username" مش فاضي
    const updatedData = {
        ...(username && { username }),
        ...(bio && { bio }),
        ...(location && { location }),
        ...(full_name && { full_name }),
    };

    // 5. هنتعامل مع "ملف" صورة البروفايل (لو موجود)
    if (req.files && req.files.profile_picture && req.files.profile_picture[0]) {
        const profile = req.files.profile_picture[0];

        // 6. (!! التعديل الأهم !!)
        // هنقرأ من الـ "buffer" (الذاكرة) مش من "fs" (الهارد)
        const result = await imagekit.upload({
            file: profile.buffer, // <--- من الذاكرة
            fileName: profile.originalname, // <--- الاسم الأصلي للملف (صلحنا الكراش)
        });

        // 7. (!! تصليح الـ Transformation !!)
        const url = imagekit.url({
            path: result.filePath,
            transformation: [
                { format: "webp" }, // <--- دي "صيغة"
                { width: 512 },    // <--- ده "عرض"
                { quality: "auto" } // <--- دي "جودة"
            ]
        });
        updatedData.profile_picture = url; // نضيف الرابط للداتا
    }

    // 8. هنتعامل مع "ملف" صورة الكافر (لو موجود)
    if (req.files && req.files.cover && req.files.cover[0]) {
        const cover = req.files.cover[0];

        const result = await imagekit.upload({
            file: cover.buffer, // <--- من الذاكرة
            fileName: cover.originalname,
        });

        const url = imagekit.url({
            path: result.filePath,
            transformation: [
                { format: "webp" }, // <--- صيغة
                { width: 1280 },   // <--- عرض
                { quality: "auto" } // <--- جودة
            ]
        });
        updatedData.cover_photo = url; // نضيف الرابط للداتا
    }

    // 9. نحدث الداتا بيز مرة واحدة بكل البيانات
    // .select("-password") عشان منرجعش الباسورد لليوزر
    const user = await User.findOneAndUpdate({ clerkId: userId }, updatedData, { new: true }).select("-password");

    if (user) {
        return res.status(200).json({ success: true, data: user, message: "User updated successfully" });
    } else {
        res.status(404);
        throw new Error("User not found");
    }
});


/**----------------------------------------------
 * @desc Search For Users (ده وصف أدق)
 * @route /api/user/search
 * @method GET (ده الصح للبحث)
 * @access Private (لأنه بيعتمد على اليوزر اللي مسجل)
--------------------------------------------------*/
export const discoverUsers = expressAsyncHandler(async (req, res) => {
    // 1. استقبال الـ Query
    const { query } = req.query;

    // 2. لو مفيش بحث، رجع مصفوفة فاضية فوراً (توفير موارد)
    if (!query || query.trim() === "") {
        return res.json({ success: true, users: [] });
    }

    // 3. تحديد هوية الباحث (عشان الفلترة)
    const { userId: clerkId } = req.auth();
    const currentUser = await User.findOne({ clerkId }).select("_id blockedUsers");

    if (!currentUser) {
        // لو لسبب ما اليوزر مش موجود، نرجع فاضي
        return res.json({ success: true, users: [] });
    }

    const currentUserId = currentUser._id;
    const myBlockedList = currentUser.blockedUsers || [];

    // 4. تعبير البحث (Regex)
    // "i" يعني مش فارقة كابيتال ولا سمول
    const searchRegex = new RegExp(query, "i");

    // 5. 🧠 الاستعلام الذكي (Smart & Safe Query)
    const users = await User.find({
        $and: [
            // أ) شروط المطابقة (ابحث في دول)
            {
                $or: [
                    { username: searchRegex },
                    { full_name: searchRegex },
                    { bio: searchRegex },      // دور في البايو
                    { location: searchRegex }  // دور في العنوان
                ]
            },

            // ب) شروط الاستبعاد (فلترة الأمان) 🛡️
            { _id: { $ne: currentUserId } },       // 1. مش أنا
            { _id: { $nin: myBlockedList } },      // 2. مش الناس اللي أنا حاظرهم
            { blockedUsers: { $ne: currentUserId } } // 3. 🔥 مش الناس اللي "حاظريني" (العزل التام)
        ]
    })
        // 6. هات بس البيانات المهمة للكارت
        .select("_id full_name username profile_picture bio isVerified location")
        // 7. حد أقصى للنتايج (Performance)
        .limit(20);

    res.status(200).json({ success: true, users });
});


/**----------------------------------------------
 * @desc Follow User (Fixed & Real-time 🛠️🔔)
 * @route /api/user/follow/:id
 * @method POST
 * @access Private
--------------------------------------------------*/
export const followUser = expressAsyncHandler(async (req, res) => {
    const { id: targetUserId } = req.params;

    // 1. هات اليوزر الحالي
    let currentUser;
    if (req.user && req.user._id) currentUser = await User.findById(req.user._id);
    else if (req.user && req.user.id) currentUser = await User.findOne({ clerkId: req.user.id });

    if (!currentUser) { res.status(404); throw new Error("Current user not found"); }

    // 2. هات الهدف
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) { res.status(404); throw new Error("User not found"); }

    if (currentUser._id.toString() === targetUser._id.toString()) {
        res.status(400); throw new Error("Cannot follow yourself");
    }

    if (currentUser.following.includes(targetUser._id)) {
        res.status(400); throw new Error("You already follow this user");
    }

    // =================================================
    // 🔒 الحساب الخاص (Private) -> Follow Request
    // =================================================
    if (targetUser.isPrivate) {
        if (targetUser.followRequests.includes(currentUser._id)) {
            return res.status(200).json({ success: true, status: "requested", message: "Request already sent" });
        }

        await targetUser.updateOne({ $push: { followRequests: currentUser._id } });

        // 👇👇👇 التعديل هنا: استخدام Notification.create مباشرة 👇👇👇
        const newNotification = await Notification.create({
            recipient: targetUser._id,
            sender: currentUser._id,
            type: "follow_request",
            status: "pending"
        });

        // السوكيت
        const receiverSocketId = getReceiverSocketId(targetUser._id);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newNotification", {
                _id: newNotification._id, // ✅ دلوقتي ده موجود ومش هيضرب
                type: "follow_request",
                sender: {
                    _id: currentUser._id,
                    full_name: currentUser.full_name,
                    profile_picture: currentUser.profile_picture,
                    username: currentUser.username
                },
                message: "Sent you a follow request"
            });
        }

        return res.status(200).json({ success: true, status: "requested", message: "Follow request sent" });
    }

    // =================================================
    // ✅ الحساب العام (Public) -> Direct Follow
    // =================================================
    await currentUser.updateOne({ $push: { following: targetUser._id } });
    await targetUser.updateOne({ $push: { followers: currentUser._id } });

    // 👇👇👇 التعديل هنا كمان 👇👇👇
    const newNotification = await Notification.create({
        recipient: targetUser._id,
        sender: currentUser._id,
        type: "follow"
    });

    // السوكيت
    const receiverSocketId = getReceiverSocketId(targetUser._id);
    if (receiverSocketId) {
        io.to(receiverSocketId).emit("newNotification", {
            _id: newNotification._id, // ✅ دلوقتي ده موجود ومش هيضرب
            type: "follow",
            sender: {
                _id: currentUser._id,
                full_name: currentUser.full_name,
                profile_picture: currentUser.profile_picture,
                username: currentUser.username
            },
            message: "Started following you"
        });
    }

    res.status(200).json({ success: true, status: "following", message: `You are now following ${targetUser.full_name}` });
});


/**----------------------------------------------
 * @desc Unfollow User OR Cancel Request 🧠
 * @route /api/user/unfollow/:id
 * @method POST
 * @access Private
--------------------------------------------------*/
export const unfollowUser = expressAsyncHandler(async (req, res) => {
    const { id: targetUserId } = req.params;
    let currentUser = await User.findById(req.user._id || req.user.id);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) { res.status(404); throw new Error("User not found"); }

    // الحالة 1: أنا بتابعه بالفعل (Unfollow)
    if (currentUser.following.includes(targetUser._id)) {
        await currentUser.updateOne({ $pull: { following: targetUser._id } });
        await targetUser.updateOne({ $pull: { followers: currentUser._id } });
        return res.status(200).json({ success: true, status: "none", message: "User unfollowed" });
    }

    // الحالة 2: أنا باعتله طلب وعايز ألغيه (Cancel Request)
    // 👇 دي الإضافة الذكية عشان زرار "Requested" يشتغل كـ "Cancel"
    else if (targetUser.followRequests.includes(currentUser._id)) {
        await targetUser.updateOne({ $pull: { followRequests: currentUser._id } });
        // مش محتاجين نمسح من عندنا حاجة لأننا أصلاً مسجلناش حاجة عندنا في الـ followUser
        return res.status(200).json({ success: true, status: "none", message: "Follow request cancelled" });
    }

    else {
        res.status(400); throw new Error("You don't follow this user");
    }
});


/**----------------------------------------------
 * @desc Get User By ID (Public Profile)
 * @route GET /api/user/:id
 * @method GET
 * @access Private (أو Public لو عايز أي حد يشوف البروفايلات)
--------------------------------------------------*/
export const getUserById = expressAsyncHandler(async (req, res) => {
    // 1. هات الـ ID من الرابط
    const { id } = req.params;

    // 2. دور على اليوزر في الداتابيز
    // (بنستثني الباسورد والإيميل والبيانات الحساسة عشان ده بروفايل عام)
    const user = await User.findById(id).select("-password -email -clerkId");

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    // 3. رجع البيانات
    res.status(200).json({
        success: true,
        user
    });
});


/**----------------------------------------------
 * @desc Get User Network (Followers or Following List)
 * @route GET /api/user/:id/:type
 * @method GET
 * @access Private
----------------------------------------------*/
export const getUserNetwork = expressAsyncHandler(async (req, res) => {
    const { id, type } = req.params;

    // 1. تحقق من النوع (لازم يكون followers أو following)
    if (type !== 'followers' && type !== 'following') {
        res.status(400);
        throw new Error("Invalid type. Must be 'followers' or 'following'");
    }

    // 2. هات اليوزر واعمل populate للقائمة المطلوبة
    // populate: يعني شيل الـ ID وحط مكانه بيانات الشخص (الاسم، الصورة، الخ)
    const user = await User.findById(id).populate({
        path: type, // يا followers يا following
        select: "full_name username profile_picture bio location" // هات بس البيانات دي
    });

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    // 3. رجع القائمة
    res.status(200).json({
        success: true,
        users: user[type] // رجع المصفوفة اللي اتملت بيانات
    });
});


/**----------------------------------------------
 * @desc Block / Unblock User
 * @route /api/user/block/:id
 * @method PUT
 * @access Private
----------------------------------------------*/
export const toggleBlockUser = expressAsyncHandler(async (req, res) => {
    const { id: targetId } = req.params;
    const { userId } = req.auth(); // Clerk ID

    const currentUser = await User.findOne({ clerkId: userId });
    const targetUser = await User.findById(targetId);

    if (!targetUser) { res.status(404); throw new Error("User not found"); }

    // لو هو أصلاً في قائمة المحظورين -> شيله (Unblock)
    if (currentUser.blockedUsers.includes(targetId)) {
        await User.findByIdAndUpdate(currentUser._id, {
            $pull: { blockedUsers: targetId }
        });
        res.status(200).json({ success: true, message: "User unblocked", isBlocked: false });
    }
    // لو مش موجود -> ضيفه (Block)
    else {
        await User.findByIdAndUpdate(currentUser._id, {
            $push: { blockedUsers: targetId }
        });
        res.status(200).json({ success: true, message: "User blocked", isBlocked: true });
    }
});


/**----------------------------------------------
 * @desc Mute / Unmute User
 * @route /api/user/mute/:id
 * @method PUT
 * @access Private
----------------------------------------------*/
export const toggleMuteUser = expressAsyncHandler(async (req, res) => {
    const { id: targetId } = req.params;
    const { userId } = req.auth();

    const currentUser = await User.findOne({ clerkId: userId });

    // لو هو معمول له ميوت -> شيله (Unmute)
    if (currentUser.mutedUsers.includes(targetId)) {
        await User.findByIdAndUpdate(currentUser._id, {
            $pull: { mutedUsers: targetId }
        });
        res.status(200).json({ success: true, message: "Notifications unmuted 🔔", isMuted: false });
    }
    // لو مش معمول -> ضيفه (Mute)
    else {
        await User.findByIdAndUpdate(currentUser._id, {
            $push: { mutedUsers: targetId }
        });
        res.status(200).json({ success: true, message: "Notifications muted 🔕", isMuted: true });
    }
});


/**----------------------------------------------
 * @desc Accept Follow Request & Notify User 🤝🔔
 * @route /api/user/follow-request/accept/:id
 * @method POST
 * @access Private
--------------------------------------------------*/
export const acceptFollowRequest = expressAsyncHandler(async (req, res) => {
    const { id: requesterId } = req.params; // الشخص اللي بعتلي الطلب (اللي هيستلم الإشعار)
    const currentUser = await User.findById(req.user._id);
    const requester = await User.findById(requesterId);

    if (!requester) { res.status(404); throw new Error("User not found"); }

    // تأكد إن فيه طلب أصلاً
    if (!currentUser.followRequests.includes(requesterId)) {
        res.status(400); throw new Error("No follow request from this user");
    }

    // 1. تحديث الداتابيز (نقل من طلبات لمتابعين)
    await currentUser.updateOne({
        $push: { followers: requesterId },
        $pull: { followRequests: requesterId }
    });

    await requester.updateOne({
        $push: { following: currentUser._id }
    });

    // 2. 👇👇👇 إنشاء الإشعار في الداتابيز 👇👇👇
    // الإشعار ده بيقول: "أنا (currentUser) قبلت طلبك يا (requester)"
    const newNotification = await Notification.create({
        recipient: requester._id, // رايح للي بعت الطلب
        sender: currentUser._id,  // جاي مني
        type: "follow_accept"     // 👈 النوع اللي ظبطنا نصه في الفرونت
    });

    // 3. 👇👇👇 إرسال السوكيت (عشان الجرس يرن عنده فوراً) 👇👇👇
    const receiverSocketId = getReceiverSocketId(requester._id);
    if (receiverSocketId) {
        io.to(receiverSocketId).emit("newNotification", {
            _id: newNotification._id,
            type: "follow_accept",
            sender: {
                _id: currentUser._id,
                full_name: currentUser.full_name,
                profile_picture: currentUser.profile_picture,
                username: currentUser.username
            },
            message: "Accepted your follow request"
        });
    }

    res.status(200).json({ success: true, message: "Follow request accepted" });
});


/**----------------------------------------------
 * @desc Decline Follow Request
 * @route /api/user/follow-request/decline/:id
 * @method POST
 * @access Private
--------------------------------------------------*/
export const declineFollowRequest = expressAsyncHandler(async (req, res) => {
    const { id: requesterId } = req.params;
    const { userId } = req.auth();

    const currentUser = await User.findOne({ clerkId: userId });

    // 1. تحديث اليوزر
    await currentUser.updateOne({
        $pull: { followRequests: requesterId }
    });

    // (مهم) لازم نشيل الطلب من عند الراسل كمان (sentRequests)
    await User.findByIdAndUpdate(requesterId, {
        $pull: { sentRequests: currentUser._id }
    });

    // 2. 🔥 تحديث الإشعار لـ "rejected" (عشان العداد ينقص)
    await Notification.findOneAndUpdate(
        { recipient: currentUser._id, sender: requesterId, type: "follow_request" },
        { status: "rejected" }
    );

    res.status(200).json({ success: true, message: "Follow request declined" });
});


/**----------------------------------------------
 * @desc Update Privacy Settings
 * @route /api/user/update-privacy
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const updatePrivacySettings = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { isPrivate, hideOnlineStatus } = req.body; // بستقبل القيم true/false

    const user = await User.findOne({ clerkId: userId });
    if (!user) { res.status(404); throw new Error("User not found"); }

    // تحديث القيم لو مبعوتة
    if (typeof isPrivate !== 'undefined') user.isPrivate = isPrivate;
    if (typeof hideOnlineStatus !== 'undefined') user.hideOnlineStatus = hideOnlineStatus;

    await user.save();

    res.status(200).json({
        success: true,
        message: "Privacy settings updated",
        user: {
            isPrivate: user.isPrivate,
            hideOnlineStatus: user.hideOnlineStatus
        }
    });
});


/**----------------------------------------------
 * @desc Update Notification Settings 🔔
 * @route /api/user/update-settings
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const updateNotificationSettings = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    // بنستقبل القيم (ممكن تيجي true أو false)
    const { email, push } = req.body;

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    // تأكد إن notificationSettings موجودة (حماية لليوزرز القدام)
    if (!user.notificationSettings) {
        user.notificationSettings = { email: true, push: true };
    }

    // التحديث الذكي: لو القيمة مبعوتة نحدثها، لو مش مبعوتة نسيب القديم
    // بنستخدم (undefined) عشان القيمة ممكن تكون false وده تغيير مقبول
    if (email !== undefined) user.notificationSettings.email = email;
    if (push !== undefined) user.notificationSettings.push = push;

    await user.save();

    res.status(200).json({
        success: true,
        message: "Notification settings updated",
        settings: user.notificationSettings
    });
});


/**----------------------------------------------
 * @desc Send Test Email (For Development) 🧪
 * @route POST /api/user/test-email
 * @access Private
--------------------------------------------------*/
export const sendTestEmail = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const user = await User.findOne({ clerkId: userId });

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    console.log(`Attempting to send email to: ${user.email}`);

    const isSent = await sendEmail({
        to: user.email,
        subject: "Rift Test: It Works! 🚀",
        html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                <h1>🎉 Congratulations!</h1>
                <p>If you are reading this, your email system is working perfectly with Mailtrap.</p>
                <p style="color: #888;">Sent from Localhost</p>
            </div>
        `
    });

    if (isSent) {
        res.status(200).json({ success: true, message: "Email sent to Mailtrap!" });
    } else {
        res.status(500);
        throw new Error("Failed to send email");
    }
});