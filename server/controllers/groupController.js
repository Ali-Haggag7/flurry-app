import expressAsyncHandler from "express-async-handler";
import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";
import User from "../models/User.js";
import imagekit from "../configs/imagekit.js"; // تأكد من المسار
import { connections } from "./messageController.js"; // عشان نقدر نوصل للـ SSE connections


/**----------------------------------------------
 * @desc Create a new group
 * @route /api/group/create
 * @method POST
 * @access Private
--------------------------------------------------*/
export const createGroup = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth(); // 1. هات الـ Clerk ID

    // لازم نجيب الـ ID الحقيقي من الداتابيز
    const ownerUser = await User.findOne({ clerkId: userId });
    if (!ownerUser) {
        res.status(404);
        throw new Error("User not found");
    }

    // استلام البيانات (لاحظ: memberIds لو جاية FormData ممكن تحتاج JSON.parse)
    // بس هنفترض هنا إنها جاية Array جاهزة أو هنهندلها
    let { name, description, memberIds } = req.body;

    // لو جاية FormData (سترينج) حولها لمصفوفة
    if (typeof memberIds === 'string') {
        try {
            memberIds = JSON.parse(memberIds);
        } catch (e) {
            memberIds = [];
        }
    }

    // 2. رفع صورة الجروب (اختياري)
    let groupImageUrl = "";
    if (req.file) {
        const uploadResponse = await imagekit.upload({
            file: req.file.buffer,
            fileName: `group-${Date.now()}-${req.file.originalname}`,
            folder: "/groups"
        });
        groupImageUrl = imagekit.url({
            path: uploadResponse.filePath,
            transformation: [{ quality: "auto" }, { width: "500" }]
        });
    }

    // 3. تجهيز قائمة الأعضاء
    // أ) ضيف صاحب الجروب الأول (كأدمن)
    const initialMembers = [{
        user: ownerUser._id,
        role: "admin",
        status: "accepted"
    }];

    // ب) ضيف باقي الأعضاء اللي اخترتهم
    if (memberIds && Array.isArray(memberIds)) {
        memberIds.forEach(friendId => {
            // تأكد إننا مش بنضيف صاحب الجروب تاني
            if (friendId !== ownerUser._id.toString()) {
                initialMembers.push({
                    user: friendId, // ده الـ MongoID بتاع صاحبك
                    role: "member",
                    status: "accepted" // أو pending لو عايز نظام دعوات
                });
            }
        });
    }

    // 4. إنشاء الجروب
    const group = await Group.create({
        name,
        description: description || "",
        group_image: groupImageUrl,
        owner: ownerUser._id,
        members: initialMembers
    });

    // 5. (إضافي) ممكن نعمل populate عشان نرجع الجروب ببيانات الأعضاء كاملة
    const populatedGroup = await group.populate("members.user", "full_name profile_picture");

    res.status(201).json({
        success: true,
        message: "Group created successfully 🎉",
        group: populatedGroup
    });
});


/**----------------------------------------------
 * @desc Get Available Groups for the User
 * @route /api/group/my-groups
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getAvailableGroups = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const currentUser = await User.findOne({ clerkId: userId });

    if (!currentUser) {
        res.status(404); throw new Error("User not found");
    }

    // 🔍 التعديل: هات الجروبات اللي أنا عضو فيها OR أنا المالك بتاعها
    const groups = await Group.find({
        $or: [
            { "members.user": currentUser._id }, // أنا عضو
            { "owner": currentUser._id }         // أو أنا المالك
        ]
    })
        .populate("members.user", "full_name profile_picture clerkId _id")
        // 👇👇 التعديل المهم: ضيفنا clerkId هنا
        .populate("owner", "full_name profile_picture clerkId")
        .sort({ updatedAt: -1 });

    res.status(200).json({
        success: true,
        count: groups.length,
        groups // المصفوفة هنا
    });
});

/**----------------------------------------------
 * @desc Get Discovery Groups for the User
 * @route /api/group/discovery
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getDiscoveryGroups = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth(); // Clerk ID

    // 1. نجيب الـ ID بتاع المونجو
    const currentUser = await User.findOne({ clerkId: userId });

    if (!currentUser) {
        res.status(404);
        throw new Error("User not found");
    }

    // 2. معادلة البحث: (لست العضو) و (لست المالك)
    const groups = await Group.find({
        $and: [
            { "members.user": { $ne: currentUser._id } }, // $ne يعني Not Equal (مش موجود في الأعضاء)
            { "owner": { $ne: currentUser._id } }         // ولا هو المالك
        ]
    })
        .select("name description group_image members owner") // هات بيانات خفيفة بس
        .populate("owner", "full_name profile_picture") // بيانات المالك للعرض
        .sort({ createdAt: -1 }) // الأحدث أولاً
        .limit(50); // 💡 أمان: هات أول 50 جروب بس عشان الصفحة متتقلش (ممكن نزودها بعدين)

    res.status(200).json(groups);
});


/**----------------------------------------------
 * @desc Join a Group
 * @route /api/group/join/:groupId
 * @method POST
 * @access Private
--------------------------------------------------*/
export const joinGroup = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    // 1️⃣ هات اليوزر
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found");
    }

    // 2️⃣ هات الجروب
    const group = await Group.findById(groupId);
    if (!group) {
        res.status(404);
        throw new Error("Group not found");
    }

    // 3️⃣ تحقق: هل هو عضو بالفعل؟
    const isAlreadyMember = group.members.some(member =>
        member.user.toString() === currentUser._id.toString()
    );

    if (isAlreadyMember) {
        res.status(400);
        throw new Error("You are already a member of this group");
    }

    // 4️⃣ ضيف العضو
    group.members.push({
        user: currentUser._id,
        role: "member",
        status: "pending" // أو "accepted" لو مش عايز نظام دعوات
    });

    await group.save();

    // 5️⃣ (إضافة) إنشاء رسالة نظام "System Message" 📢
    // دي هتظهر في الشات للكل إن فلان انضم
    await GroupMessage.create({
        group: groupId,
        sender: currentUser._id, // الراسل هو الشخص اللي انضم
        text: `${currentUser.full_name} has joined the group`,
        message_type: "system", // 👈 نوع الرسالة سيستم
        media_url: ""
    });

    // 6️⃣ (تحسين) رجع الجروب ببيانات الأعضاء كاملة عشان الفرونت يعرضهم فوراً
    const populatedGroup = await group.populate("members.user", "full_name profile_picture");

    res.status(200).json({
        success: true,
        message: "You have joined the group successfully 🎉",
        group: populatedGroup
    });
});


/**----------------------------------------------
 * @desc Get Group Requests (Pending Members)
 * @route /api/group/requests/:groupId
 * @method Get
 * @access Private
--------------------------------------------------*/
export const getGroupRequests = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    // 1️⃣ هات اليوزر الحالي (صاحب الجروب)
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found");
    }

    // 2️⃣ هات الجروب + بيانات الأعضاء (الاسم والصورة)
    // 👇👇 التعديل هنا: ضفنا populate 👇👇
    const group = await Group.findById(groupId)
        .populate("members.user", "full_name profile_picture username");

    if (!group) {
        res.status(404);
        throw new Error("Group not found");
    }

    // 3️⃣ تحقق: هل هو صاحب الجروب؟ (Security Check)
    // (وممكن مستقبلاً نضيف: أو هو أدمن)
    if (group.owner.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("You are not authorized to view requests for this group");
    }

    // 4️⃣ الفلترة: هات بس الناس اللي حالتهم pending
    // دلوقتي member.user عبارة عن أوبجيكت كامل مش ID بس
    const pendingRequests = group.members.filter(member => member.status === "pending");

    res.status(200).json({
        success: true,
        message: "Pending requests retrieved successfully",
        count: pendingRequests.length,
        requests: pendingRequests // غيرت الاسم لـ requests عشان يبقى أوضح
    });
});


/**----------------------------------------------
 * @desc Accept or Reject Group Request
 * @route /api/group/request/respond
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const respondToJoinRequest = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    // بنستقبل: ID الجروب، ID الشخص اللي مقدم، والقرار (accept/reject)
    const { groupId, memberId, action } = req.body;

    // 1️⃣ تحقق من البيانات
    if (!groupId || !memberId || !["accept", "reject"].includes(action)) {
        res.status(400);
        throw new Error("Invalid data provided");
    }

    // 2️⃣ هات صاحب الجروب (أنت)
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found");
    }

    // 3️⃣ هات الجروب
    const group = await Group.findById(groupId);
    if (!group) {
        res.status(404);
        throw new Error("Group not found");
    }

    // 4️⃣ أمان: هل أنت صاحب الجروب؟ 👮‍♂️
    if (group.owner.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("Not authorized to manage requests for this group");
    }

    // 5️⃣ دور على العضو ده في القائمة (لازم يكون pending)
    const memberIndex = group.members.findIndex(m =>
        m.user.toString() === memberId && m.status === "pending"
    );

    if (memberIndex === -1) {
        res.status(404);
        throw new Error("Request not found or already handled");
    }

    // 6️⃣ تنفيذ القرار ⚖️
    if (action === "accept") {
        // ✅ موافقة: غير الحالة لـ accepted
        group.members[memberIndex].status = "accepted";
        group.members[memberIndex].joinedAt = Date.now();

        // 📢 (بونص) ابعت رسالة سيستم إن فيه عضو جديد انضم
        // لازم نجيب اسم العضو الجديد الأول
        const newMemberUser = await User.findById(memberId);
        if (newMemberUser) {
            await GroupMessage.create({
                group: groupId,
                sender: newMemberUser._id, // بنخلي الراسل هو العضو الجديد
                text: `${newMemberUser.full_name} has joined the group`,
                message_type: "system"
            });
        }

    } else {
        // ❌ رفض: شيله من المصفوفة خالص
        group.members.splice(memberIndex, 1);
    }

    // 7️⃣ حفظ التغييرات
    await group.save();

    res.status(200).json({
        success: true,
        message: action === "accept" ? "Member accepted successfully 🎉" : "Request rejected 🗑️",
        memberId // بنرجعه عشان الفرونت يشيله من القائمة فوراً
    });
});


/**----------------------------------------------
 * @desc Get Group Details (Info & Members)
 * @route /api/group/:groupId
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getGroupDetails = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    // 1️⃣ هات اليوزر الحالي (عشان نتأكد إنه عضو ومسموح له يشوف البيانات)
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found");
    }

    // 2️⃣ هات الجروب واعمل Populate لكل حاجة
    const group = await Group.findById(groupId)
        .populate("members.user", "full_name profile_picture username bio") // هات تفاصيل الأعضاء
        .populate("owner", "full_name profile_picture"); // هات تفاصيل المالك

    if (!group) {
        res.status(404);
        throw new Error("Group not found");
    }

    // 3️⃣ (أمان) هل أنت عضو في الجروب ده؟
    // عشان محدش يسرق ID الجروب ويشوف مين اللي فيه وهو مش معاهم
    const isMember = group.members.some(m =>
        m.user._id.toString() === currentUser._id.toString() && m.status === "accepted"
    );

    if (!isMember) {
        res.status(403);
        throw new Error("You are not a member of this group");
    }

    res.status(200).json({
        success: true,
        message: "Group details retrieved successfully",
        group
    });
});


/**----------------------------------------------
 * @desc Send Message to a Group
 * @route /api/group/send
 * @method POST
 * @access Private
--------------------------------------------------*/
export const sendGroupMessage = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId, text } = req.body;
    const file = req.file;
    const replyTo = req.body.replyTo;

    // 1️⃣ تحقق من البيانات الأساسية
    if (!groupId || (!text && !file)) {
        res.status(400);
        throw new Error("Invalid data. Message must have text or image.");
    }

    // 2️⃣ هات اليوزر (الراسل)
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found");
    }

    // 3️⃣ هات الجروب
    const group = await Group.findById(groupId);
    if (!group) {
        res.status(404);
        throw new Error("Group not found");
    }

    // 4️⃣ أهم خطوة: هل أنت عضو في الجروب؟ 👮‍♂️
    // (عشان محدش يبعت في جروب مش بتاعه)
    const isMember = group.members.some(member =>
        member.user.toString() === currentUser._id.toString() && member.status === "accepted"
    );

    if (!isMember) {
        res.status(403);
        throw new Error("You are not a member of this group");
    }

    // 5️⃣ رفع الصورة (لو موجودة) 📸
    let mediaUrl = "";
    let messageType = "text";

    // 🛑 الأمان: لازم نتأكد إن فيه ملف أصلاً قبل ما نفحصه
    if (file) {
        const isImage = file.mimetype.startsWith("image/");
        const isAudio = file.mimetype.startsWith("audio/");

        if (isImage) {
            messageType = "image";
            const uploadResponse = await imagekit.upload({
                file: file.buffer,
                fileName: `group-img-${Date.now()}-${file.originalname}`,
                folder: "/group-messages/images"
            });

            // للصورة بنعمل تحسين جودة وحجم
            mediaUrl = imagekit.url({
                path: uploadResponse.filePath,
                transformation: [{ quality: "auto" }, { width: "800" }]
            });

        } else if (isAudio) {
            messageType = "audio";
            const uploadResponse = await imagekit.upload({
                file: file.buffer,
                // بنسميه webm لأن ده الامتداد اللي بيخرج من تسجيل المتصفح غالباً
                fileName: `group-voice-${Date.now()}.webm`,
                folder: "/group-messages/voices"
            });

            // 🎵 للصوت بناخد الرابط المباشر من غير لعب في الأبعاد
            mediaUrl = uploadResponse.url;
        }
    }

    // 6️⃣ إنشاء الرسالة في الداتابيز 💾
    let newMessage = await GroupMessage.create({
        group: groupId,
        sender: currentUser._id,
        text: text || "",
        message_type: messageType,
        media_url: mediaUrl,
        replyTo: replyTo || null,
        readBy: [currentUser._id]
    });

    // 7️⃣ Populate (عشان نرجع بيانات الراسل كاملة للفرونت)
    newMessage = await newMessage.populate("sender", "full_name profile_picture username clerkId _id");

    // 👇 املأ بيانات الرسالة اللي بنرد عليها (لو موجودة)
    if (replyTo) {
        await newMessage.populate({
            path: "replyTo", // اسم الحقل
            select: "text sender message_type", // هات النص ونوع الرسالة والراسل
            populate: {
                path: "sender", // وكمان هات تفاصيل الراسل القديم
                select: "full_name username" // يهمنا اسمه بس
            }
        });
    }

    // 8️⃣ الـ Real-time (الجزء الممتع) 🚀
    // لازم نلف على كل أعضاء الجروب، ونشوف مين فيهم فاتح (Online) ونبعتله الرسالة

    // هنجهز الرسالة
    const payload = JSON.stringify(newMessage);

    group.members.forEach(member => {
        const memberId = member.user.toString();

        // طبعاً مش هنبعت للراسل نفسه (لأن الفرونت عنده بيضيفها فوراً)
        if (memberId !== currentUser._id.toString()) {

            // هل العضو ده فاتح دلوقتي؟ (موجود في connections)
            const memberSocket = connections[memberId];

            if (memberSocket) {
                // ابعتله الرسالة
                memberSocket.write(`data: ${payload}\n\n`);
            }
        }
    });

    // 👇👇👇 ضيف السطر ده ضروري 👇👇👇
    // ده اللي هيخلي الشات يسمع الرسالة ويحطها في الليست
    // (تأكد إنك عامل import للـ io أو بتجيبه من req.app.get('io'))
    // لو الـ io مش متعرف هنا، ممكن تستخدم req.io لو أنت رابطه بالـ app

    const io = req.app.get("io"); // أو حسب ما أنت معرفه في السيرفر
    if (io) {
        io.to(groupId).emit("receiveGroupMessage", newMessage);
    }

    // 9️⃣ الرد النهائي
    res.status(201).json({
        success: true,
        message: "Message sent successfully",
        data: newMessage
    });
});


/**----------------------------------------------
 * @desc Get Group Messages
 * @route /api/group/messages/:groupId
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getGroupMessages = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    // 1️⃣ هات اليوزر عشان ناخد الـ MongoID بتاعه
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) {
        res.status(404);
        throw new Error("User not found");
    }

    // 2️⃣ هات الجروب وتأكد إنه موجود
    const group = await Group.findById(groupId);
    if (!group) {
        res.status(404);
        throw new Error("Group not found");
    }

    // 3️⃣ تحقق: هل أنت عضو في الجروب ده؟ 🕵️‍♂️
    // (الأدمن والأعضاء العاديين كلهم موجودين في مصفوفة members)
    const isMember = group.members.some(member =>
        member.user.toString() === currentUser._id.toString() && member.status === "accepted"
    );

    if (!isMember) {
        res.status(403); // Forbidden
        throw new Error("You are not a member of this group");
    }

    // 1. هات الرسايل الخاصة بالجروب ده
    const messages = await GroupMessage.find({ group: groupId })
        // 2. املأ بيانات مرسل الرسالة الأصلية
        .populate("sender", "full_name username profile_picture clerkId")

        // 3. 👇👇 الجزء المهم: املأ بيانات الرد (عشان ميعملش Reset بعد الريفرش)
        .populate({
            path: "replyTo", // ادخل جوه حقل replyTo
            select: "text sender message_type media_url", // هات منه الحاجات دي
            populate: {
                path: "sender", // وادخل كمان جوه sender بتاع الرد
                select: "full_name username" // وهات اسمه
            }
        })
        .populate("reactions.user", "full_name username profile_picture") // هات بيانات اليوزر اللي عمل رياكشن

    res.status(200).json({
        success: true,
        message: "Group messages retrieved successfully",
        count: messages.length,
        messages
    });
});

/**----------------------------------------------
 * @desc Leave a Group
 * @route /api/group/leave/:groupId
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const leaveGroup = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    const group = await Group.findById(groupId);

    if (!group) {
        res.status(404); throw new Error("Group not found");
    }

    // 🛑 ممنوع صاحب الجروب يخرج (لازم ينقل الملكية الأول أو يحذف الجروب)
    if (group.owner.toString() === currentUser._id.toString()) {
        res.status(400);
        throw new Error("Owner cannot leave the group. Delete the group instead.");
    }

    // 1️⃣ شيله من المصفوفة
    const initialCount = group.members.length;
    group.members = group.members.filter(m => m.user.toString() !== currentUser._id.toString());

    if (group.members.length === initialCount) {
        res.status(400); throw new Error("You are not in this group");
    }

    await group.save();

    // 2️⃣ ابعت رسالة سيستم إن فلان خرج (عشان الكل يعرف) 📢
    await GroupMessage.create({
        group: groupId,
        sender: currentUser._id,
        text: `${currentUser.full_name} left the group`,
        message_type: "system"
    });

    res.status(200).json({
        success: true,
        message: "You left the group successfully 👋"
    });
});


/**----------------------------------------------
 * @desc Remove (Kick) a Member
 * @route /api/group/kick
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const removeMember = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId, memberId } = req.body; // memberId ده الـ MongoID بتاع الشخص اللي هيتطرد

    const currentUser = await User.findOne({ clerkId: userId });
    const group = await Group.findById(groupId);

    if (!group) {
        res.status(404); throw new Error("Group not found");
    }

    // 1️⃣ تأكد إن اللي بيطرد هو صاحب الجروب (أو أدمن) 👮‍♂️
    if (group.owner.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error("Only the group owner can remove members");
    }

    // 2️⃣ تأكد إننا مش بنطرد صاحب الجروب نفسه بالغلط
    if (memberId === group.owner.toString()) {
        res.status(400); throw new Error("You cannot kick yourself");
    }

    // 3️⃣ تنفيذ الطرد
    const memberIndex = group.members.findIndex(m => m.user.toString() === memberId);
    if (memberIndex === -1) {
        res.status(404); throw new Error("Member not found in this group");
    }

    group.members.splice(memberIndex, 1);
    await group.save();

    // 4️⃣ رسالة سيستم للتشهير بالمطرود 😂
    // نجيب بيانات المطرود الأول عشان نكتب اسمه
    const kickedUser = await User.findById(memberId);
    if (kickedUser) {
        await GroupMessage.create({
            group: groupId,
            sender: currentUser._id, // الراسل هو الأدمن
            text: `${kickedUser.full_name} was removed by ${currentUser.full_name}`,
            message_type: "system"
        });
    }

    res.status(200).json({
        success: true,
        message: "Member removed successfully 👢",
        memberId // عشان الفرونت يشيله من القائمة فوراً
    });
});


/**----------------------------------------------
 * @desc React to a Group Message
 * @route /api/group/react
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const reactToGroupMessage = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { messageId, emoji } = req.body;

    // 1. هات اليوزر
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) { res.status(404); throw new Error("User not found"); }

    // 2. هات رسالة الجروب
    const message = await GroupMessage.findById(messageId);
    if (!message) { res.status(404); throw new Error("Message not found"); }

    // 3. تأكد إن اليوزر عضو في الجروب (أمان زيادة)
    // (ممكن تعديها لو واثق، بس الأفضل تتأكد)

    // 4. اللوجيك الذكي (Toggle)
    const existingReactionIndex = message.reactions.findIndex(r => r.user.toString() === currentUser._id.toString());

    if (existingReactionIndex > -1) {
        if (message.reactions[existingReactionIndex].emoji === emoji) {
            message.reactions.splice(existingReactionIndex, 1); // Remove
        } else {
            message.reactions[existingReactionIndex].emoji = emoji; // Update
        }
    } else {
        message.reactions.push({ user: currentUser._id, emoji }); // Add
    }

    await message.save();

    // 🔥🔥🔥 5. الـ POPULATE المهم جداً 🔥🔥🔥
    const populatedMessage = await message.populate({
        path: "reactions.user",
        select: "full_name username profile_picture"
    });

    // 6. Socket Emission
    const io = req.app.get("io");
    // بنبعت لغرفة الجروب
    io.to(message.group.toString()).emit("groupMessageReaction", {
        messageId,
        reactions: populatedMessage.reactions
    });

    res.status(200).json({ success: true, reactions: populatedMessage.reactions });
});


/**----------------------------------------------
 * @desc Mark Group Messages as Read
 * @route /api/group/mark-read/:groupId
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const markGroupMessagesRead = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { groupId } = req.params;


    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) { 
        res.status(404); throw new Error("User not found"); 
    }

    // شوف عدد الرسايل اللي محتاجة تحديث قبل ما نحدث
    const countBefore = await GroupMessage.countDocuments({
        group: groupId,
        sender: { $ne: currentUser._id },
        readBy: { $ne: currentUser._id }
    });

    // التحديث
    const updateResult = await GroupMessage.updateMany(
        {
            group: groupId,
            sender: { $ne: currentUser._id },
            readBy: { $ne: currentUser._id }
        },
        { $addToSet: { readBy: currentUser._id } }
    );


    // السوكيت
    const io = req.app.get("io");
    if (io) {
        io.to(groupId).emit("groupMessagesRead", {
            groupId,
            userId: currentUser._id
        });
    }

    res.status(200).json({ success: true });
});