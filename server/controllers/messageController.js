import imagekit from "../configs/imagekit.js"; // 👈 لازم الامتداد .js في الآخر
import expressAsyncHandler from "express-async-handler";
import Message from "../models/Message.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { getReceiverSocketId, io } from "../socket/socket.js";

// مخزن الاتصالات الحية (لليوزرز الفاتحين)
export const connections = {};


/**----------------------------------------------
 * @desc SSE Endpoint (Open Connection)
 * @route /api/message/stream/:userId
 * @method GET
 * @access Public (أو Private لو بتبعت التوكن)
--------------------------------------------------*/
export const sseController = (req, res) => {
    const { userId } = req.params;

    // إعدادات الـ SSE (لازم تكون كده)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    // (أمان) بنسمح للفرونت إند بتاعنا بس
    // res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL); 

    // تسجيل اليوزر إنه "أونلاين" معانا
    connections[userId] = res;

    // رسالة ترحيب (عشان نتأكد إن الخط فتح)
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    // لما اليوزر يقفل (يخرج من الصفحة)
    req.on("close", () => {
        delete connections[userId];
        console.log(`Client ${userId} disconnected`);
    });
};


/**----------------------------------------------
 * @desc Send Message (Text, Image, or Audio)
 * @route /api/message/send
 * @method POST
 * @access Private
--------------------------------------------------*/
export const sendMessage = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { receiverId, text, sharedPostId, storyId, replyTo } = req.body;
    const file = req.file;

    // 1. هات الراسل
    const senderUser = await User.findOne({ clerkId: userId });
    if (!senderUser) { res.status(404); throw new Error("Sender not found"); }
    const senderMongoId = senderUser._id;

    // 2. هات المستقبل
    let finalReceiverId = receiverId;
    let receiverUser = null;

    if (mongoose.Types.ObjectId.isValid(receiverId)) {
        receiverUser = await User.findById(receiverId);
        if (receiverUser) finalReceiverId = receiverUser._id;
    }

    if (!receiverUser) {
        receiverUser = await User.findOne({ clerkId: receiverId });
        if (receiverUser) finalReceiverId = receiverUser._id;
    }

    if (!receiverUser) {
        res.status(404);
        throw new Error("Receiver not found");
    }

    // 👇👇👇 🛡️ 1. نقطة تفتيش البلوك (Block Check) 👇👇👇
    const isSenderBlocked = senderUser.blockedUsers.includes(finalReceiverId);
    const isReceiverBlocked = receiverUser.blockedUsers.includes(senderMongoId);

    if (isSenderBlocked || isReceiverBlocked) {
        res.status(403);
        throw new Error("You cannot send messages to this user (Blocked).");
    }

    // 👇👇👇 🤝 2. نقطة تفتيش الكونيكشن (Connection Check) - الإضافة الجديدة 👇👇👇
    // هل الشخص ده موجود في قائمة الـ connections بتاعتي؟
    // (بما إن الكونيكشن علاقة متبادلة، يكفي نتأكد إنه عندي)

    // ملاحظة: تأكد إن senderUser.connections مصفوفة IDs في السكيما
    const isConnected = senderUser.connections.some(id => id.toString() === finalReceiverId.toString());

    if (!isConnected) {
        res.status(403);
        throw new Error("You must be connected to send messages.");
    }
    // 👆👆👆 🤝 👆👆👆


    // ... باقي الكود (رفع الملفات وإنشاء الرسالة) ...

    let mediaUrl = "";
    let messageType = "text";

    if (file) {
        if (file.mimetype.startsWith("image")) {
            messageType = "image";
            const uploadResponse = await imagekit.upload({ file: file.buffer, fileName: `msg-${Date.now()}`, folder: "/messages/images" });
            mediaUrl = uploadResponse.url;
        } else if (file.mimetype.startsWith("audio")) {
            messageType = "audio";
            const uploadResponse = await imagekit.upload({ file: file.buffer, fileName: `voice-${Date.now()}.webm`, folder: "/messages/voices" });
            mediaUrl = uploadResponse.url;
        }
    } else if (sharedPostId) {
        messageType = "shared_post";
    } else if (storyId) {
        messageType = "story_reply";
    }

    const receiverSocketId = getReceiverSocketId(finalReceiverId.toString());
    const isDelivered = receiverSocketId ? true : false;

    let newMessage = await Message.create({
        sender: senderMongoId,
        receiver: finalReceiverId,
        text: text || "",
        message_type: messageType,
        media_url: mediaUrl,
        sharedPostId: sharedPostId || null,
        replyToStoryId: storyId || null,
        replyTo: replyTo || null, // ✅ تخزين الـ ID بتاع الرسالة الأصلية
        delivered: isDelivered,
        read: false
    });

    // 👇👇👇 التعديل الجوهري: الـ Populate الشامل 👇👇👇
    newMessage = await newMessage.populate([
        { path: "sender", select: "full_name profile_picture clerkId username" }, // بيانات الراسل
        { path: "replyToStoryId", select: "image content type background_color" }, // بيانات الستوري (لو رد على ستوري)

        // ✅ إضافة populate للرسالة المردود عليها
        {
            path: "replyTo",
            select: "text sender message_type media_url", // هات نص ونوع الرسالة القديمة
            populate: {
                path: "sender",
                select: "full_name username" // وهات اسم صاحب الرسالة القديمة
            }
        }
    ]);

    if (receiverSocketId) {
        io.to(receiverSocketId).emit("receiveMessage", newMessage);
        console.log(`Message sent via Socket to: ${receiverSocketId}`);

        const senderSocketId = getReceiverSocketId(senderMongoId.toString());
        if (senderSocketId) {
            io.to(senderSocketId).emit("messageDelivered", { toUserId: finalReceiverId });
        }
    }

    res.status(201).json({ success: true, data: newMessage });
});


/**----------------------------------------------
 * @desc Get Chat Messages
 * @route /api/message/:withUserId
 * @method GET
 * @access Private
 * -----------------------------------------------*/
export const getChatMessages = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { withUserId } = req.params;

    // 1. هات الـ Mongo ID بتاعي أنا (الراسل)
    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    const myId = user._id;

    // 👇👇👇 التعديل الحاسم هنا 👇👇👇
    // 2. تحديد هوية الطرف التاني (Mongo ID)
    // عشان لو الرابط فيه Clerk ID (user_...) نحوله لـ Mongo ID (65a...)
    let partnerId = withUserId;

    // لو الـ ID اللي جاي مش MongoID صحيح (يعني غالباً ClerkID)
    if (!mongoose.Types.ObjectId.isValid(withUserId)) {
        const partner = await User.findOne({ clerkId: withUserId });
        if (partner) {
            partnerId = partner._id; // ✅ مسكنا الـ Mongo ID الصح
        } else {
            // لو مش لاقيين اليوزر ده، نرجع شات فاضي بدل ما نضرب إيرور
            return res.status(200).json({ success: true, data: [] });
        }
    }
    // 👆👆👆

    // 3. البحث في الرسايل
    const messages = await Message.find({
        $and: [
            {
                $or: [
                    { sender: myId, receiver: partnerId },
                    { sender: partnerId, receiver: myId }
                ]
            },
            { deletedBy: { $ne: myId } }
        ]
    })
        .sort({ createdAt: 1 })
        .populate([
            { path: "sender", select: "full_name profile_picture clerkId username" }, // ضيفنا username عشان بنحتاجه
            { path: "replyToStoryId", select: "image content type background_color" },

            // 👇👇👇 دي الإضافة السحرية اللي هتحل المشكلة 👇👇👇
            {
                path: "replyTo",
                select: "text sender message_type media_url", // هات بيانات الرسالة الأصلية
                populate: {
                    path: "sender",
                    select: "full_name username" // عشان نعرض "Replying to Ahmed"
                }
            }
            // 👆👆👆👆👆👆👆👆👆👆👆👆👆👆
        ])
        .populate("reactions.user", "full_name username profile_picture")
        .lean();

    // 4. تحديث حالة القراءة (Read)
    if (messages.length > 0) {
        await Message.updateMany(
            { sender: partnerId, receiver: myId, read: false },
            { $set: { read: true } }
        );
    }

    const partnerSocketId = getReceiverSocketId(partnerId.toString());
    if (partnerSocketId) {
        // قوله: "بشرى سارة، الطرف التاني شاف رسايلك حالا!"
        io.to(partnerSocketId).emit("messagesSeen", { byUserId: myId });
    }

    res.status(200).json({
        success: true,
        data: messages
    });
});


/**----------------------------------------------
 * @desc Get User Recent Messages (Conversations List)
 * @route /api/message/recent
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getRecentMessages = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();

    // 1. هات اليوزر الحالي
    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    const myId = user._id;

    // 2. Aggregation Pipeline
    const conversations = await Message.aggregate([
        // المرحلة 1: تصفية الرسايل
        {
            $match: {
                $or: [{ sender: myId }, { receiver: myId }],
                deletedBy: { $ne: myId }
            }
        },

        // المرحلة 2: ترتيب تنازلي (الأحدث أولاً)
        { $sort: { createdAt: -1 } },

        // المرحلة 3: التجميع حسب الطرف الآخر
        {
            $group: {
                _id: {
                    $cond: {
                        if: { $eq: ["$sender", myId] },
                        then: "$receiver",
                        else: "$sender"
                    }
                },
                lastMessage: { $first: "$$ROOT" },
                unreadCount: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ["$receiver", myId] }, { $eq: ["$read", false] }] },
                            1,
                            0
                        ]
                    }
                }
            }
        },

        // المرحلة 4: Lookup لبيانات الطرف الآخر
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "partnerDetails"
            }
        },

        // المرحلة 5: استخراج البيانات وتجهيز حالة البلوك
        {
            $project: {
                _id: 0,
                lastMessage: 1,
                unreadCount: 1,
                partnerRaw: { $arrayElemAt: ["$partnerDetails", 0] } // البيانات الخام
            }
        },

        // المرحلة 6: تشكيل الشكل النهائي وإضافة معلومات البلوك
        {
            $project: {
                lastMessage: 1,
                unreadCount: 1,
                partner: {
                    _id: "$partnerRaw._id",
                    full_name: "$partnerRaw.full_name",
                    username: "$partnerRaw.username",
                    profile_picture: "$partnerRaw.profile_picture"
                },
                // 👇👇 لوجيك البلوك في الباك إند 👇👇
                isBlockedByMe: {
                    $in: ["$partnerRaw._id", user.blockedUsers || []] // هل الـ Partner موجود في البلوك ليست بتاعتي؟
                },
                isBlockedByPartner: {
                    $in: [myId, { $ifNull: ["$partnerRaw.blockedUsers", []] }] // هل أنا موجود في البلوك ليست بتاعته؟
                }
            }
        },

        // المرحلة 7: ترتيب المحادثات (الأحدث فوق)
        { $sort: { "lastMessage.createdAt": -1 } }
    ]);

    res.status(200).json({
        success: true,
        conversations
    });
});


/**----------------------------------------------
 * @desc Mark messages as read
 * @route /api/message/read/:senderId
 * @method PUT
 * @access Private
----------------------------------------------*/
export const markMessagesAsRead = expressAsyncHandler(async (req, res) => {
    const { senderId } = req.params; // الشخص اللي بعتلي (اللي عاوزين نخلي علاماته زرقاء)
    const { userId: clerkId } = req.auth();

    const user = await User.findOne({ clerkId });
    const myId = user._id; // أنا (المستقبل اللي فاتح الشات حالياً)

    // 1. Resolve IDs
    let finalSenderId = senderId;
    if (!mongoose.Types.ObjectId.isValid(senderId)) {
        const senderUser = await User.findOne({ clerkId: senderId });
        if (senderUser) finalSenderId = senderUser._id;
    }

    // 2. تحديث الداتابيز
    const result = await Message.updateMany(
        { sender: finalSenderId, receiver: myId, read: false },
        { $set: { read: true } }
    );

    // 👇👇👇 التريك هنا: لو فيه رسايل اتحدثت، ابعت إشارة فورية للراسل بالسوكيت
    if (result.modifiedCount > 0) {
        const senderSocketId = getReceiverSocketId(finalSenderId.toString());
        if (senderSocketId) {
            io.to(senderSocketId).emit("messagesSeen", { byUserId: myId });
        }
    }

    res.status(200).json({ success: true, message: "Messages marked as read" });
});


/**----------------------------------------------
 * @desc Delete Conversation (Soft Delete for current user only)
 * @route /api/message/conversation/:targetId
 * @method DELETE
 * @access Private
--------------------------------------------------*/
export const deleteConversation = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { targetId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    const myId = currentUser._id;

    // بدل deleteMany هنستخدم updateMany
    await Message.updateMany(
        {
            // حدد الرسايل اللي بيني وبين الشخص ده
            $or: [
                { sender: myId, receiver: targetId },
                { sender: targetId, receiver: myId }
            ]
        },
        {
            // $addToSet: بتضيف القيمة للمصفوفة لو مش موجودة (عشان التكرار)
            $addToSet: { deletedBy: myId }
        }
    );

    res.status(200).json({ success: true, message: "Chat cleared for you only" });
});


/**----------------------------------------------
 * @desc React to a Message (Add/Update/Remove Reaction)
 * @route /api/message/react
 * @method POST
 * @access Private
--------------------------------------------------*/
export const reactToMessage = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { messageId, emoji } = req.body;

    // 1. هات اليوزر
    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) { res.status(404); throw new Error("User not found"); }

    // 2. هات الرسالة (سواء عادية أو جروب - ممكن تعمل check وتدور في الاتنين)
    // هنا هنفترض إننا بنتعامل مع Message عادية (كرر نفس اللوجيك للجروب)
    let message = await Message.findById(messageId);

    // (لو ملقناش في العادي، دور في الجروب)
    let isGroupMsg = false;
    if (!message) {
        message = await GroupMessage.findById(messageId);
        isGroupMsg = true;
    }

    if (!message) { res.status(404); throw new Error("Message not found"); }

    // 3. اللوجيك الذكي للتفاعل (Toggle Logic) 🧠
    const existingReactionIndex = message.reactions.findIndex(r => r.user.toString() === currentUser._id.toString());

    if (existingReactionIndex > -1) {
        // اليوزر ده تفاعل قبل كده
        if (message.reactions[existingReactionIndex].emoji === emoji) {
            // داس على نفس الايموجي -> شيله (Remove)
            message.reactions.splice(existingReactionIndex, 1);
        } else {
            // داس على ايموجي مختلف -> بدله (Update)
            message.reactions[existingReactionIndex].emoji = emoji;
        }
    } else {
        // أول مرة يتفاعل -> ضيفه (Add)
        message.reactions.push({ user: currentUser._id, emoji });
    }

    await message.save();

    // 🔥🔥🔥 التعديل الجديد هنا 🔥🔥🔥
    // لازم نعمل populate للرسايل قبل ما نبعتها
    const populatedMessage = await message.populate({
        path: "reactions.user",
        select: "full_name username profile_picture"
    });

    // 4. Socket.io (نبعت النسخة الـ populated)
    const io = req.app.get("io");
    if (isGroupMsg) {
        io.to(message.group.toString()).emit("messageReaction", {
            messageId,
            reactions: populatedMessage.reactions // 👈 نبعت الرياكشنز كاملة
        });
    } else {
        // في الشات الخاص بنبعت للطرفين
        const receiverSocket = getReceiverSocketId(message.receiver.toString());
        const senderSocket = getReceiverSocketId(message.sender.toString());
        if (receiverSocket) io.to(receiverSocket).emit("messageReaction", { messageId, reactions: message.reactions });
        if (senderSocket) io.to(senderSocket).emit("messageReaction", { messageId, reactions: message.reactions });
    }

    res.status(200).json({ success: true, reactions: message.reactions });
});