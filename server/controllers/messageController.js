import imagekit from "../configs/imagekit.js"; // 👈 لازم الامتداد .js في الآخر
import expressAsyncHandler from "express-async-handler";
import Message from "../models/Message.js";
import User from "../models/User.js";

// مخزن الاتصالات الحية (لليوزرز الفاتحين)
const connections = {};


/**----------------------------------------------
 * @desc SSE Endpoint (Open Connection)
 * @route /api/message/stream/:userId
 * @method GET
 * @access Public (أو Private لو بتبعت التوكن)
--------------------------------------------------*/
export const sseController = (req, res) => {
    const { userId } = req.params;

    // إعدادات الـ SSE (لازم تكون كده)
    res.setHeader("Content-Type", "text/event/stream");
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
 * @desc Send Message (Text or Image)
 * @route /api/message/send
 * @method POST
 * @access Private
--------------------------------------------------*/
export const sendMessage = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth(); // الراسل
    const { to_user_id, text } = req.body; // المستقبل والنص
    const imageFile = req.file; // الملف (لو وجد)

    let mediaUrl = "";
    let messageType = "text";

    // 1. رفع الصورة (لو موجودة)
    if (imageFile) {
        messageType = "image";
        // (تصليح) استخدام Buffer بدل Path
        const uploadResponse = await imagekit.upload({
            file: imageFile.buffer,
            fileName: imageFile.originalname,
            folder: "/messages"
        });

        mediaUrl = imagekit.url({
            path: uploadResponse.filePath,
            transformation: [{ quality: "auto" }, { width: "800" }] // حجم معقول للشات
        });
    }

    // 2. حفظ الرسالة في الداتابيز
    const newMessage = await Message.create({
        sender: userId,       // (تصليح) استخدمنا الأسماء الصح
        receiver: to_user_id, // (تصليح) استخدمنا الأسماء الصح
        text: text || "",
        message_type: messageType,
        media_url: mediaUrl,
        seen: false
    });

    // 3. (الخطوة الناقصة 🔥) الإرسال الفوري عبر SSE
    // بنشوف هل المستقبل (Receiver) فاتح معانا خط؟
    const receiverSocket = connections[to_user_id];

    if (receiverSocket) {
        // لو فاتح، ابعتله الرسالة فوراً
        // SSE لازم الفورمات يكون: data: ... \n\n
        const payload = JSON.stringify(newMessage);
        receiverSocket.write(`data: ${payload}\n\n`);
    }

    // (اختياري) ممكن نبعت للراسل كمان عشان يظهر عنده علامة "صحة واحدة" فوراً

    res.status(201).json({
        success: true,
        message: "Message sent successfully",
        data: newMessage
    });
});


/**----------------------------------------------
 * @desc Get Chat Messages
 * @route /api/message/chat/:withUserId
 * @method GET
 * @access Private
 * -----------------------------------------------*/
export const getChatMessages = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { withUserId } = req.params; // ده مفروض يكون Mongo ID للشخص التاني

    // 1. (التصليح المعتاد) هات اليوزر بتاعنا من الداتابيز
    const user = await User.findOne({ clerkId });

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    const myId = user._id;

    // 2. هات الرسايل (مع تحديد العدد للأداء)
    const messages = await Message.find({
        $or: [
            { sender: myId, receiver: withUserId },
            { sender: withUserId, receiver: myId }
        ]
    })
        .sort({ createdAt: 1 }) // الترتيب: القديم -> الجديد (عشان الشات يبان صح)
        .limit(50) // (تحسين) نحدد عدد الرسايل
        .populate("sender", "username profile_picture") // (تحسين) هات صور اللي باعت عشان العرض
        .lean(); // (تحسين) أداء أسرع

    // 3. تحديث حالة "Seen"
    // (بنحدث بس الرسايل اللي "جاية منه" و "مش مقروءة")
    const unreadMessages = await Message.updateMany(
        { sender: withUserId, receiver: myId, seen: false },
        { $set: { seen: true } }
    );

    // 4. (اللمسة السحرية ✨) Real-time "Seen" Notification
    // لو فيه رسايل اتعملها update فعلاً، والشخص التاني فاتح، قوله "تمت القراءة"
    if (unreadMessages.modifiedCount > 0) {
        // بنشوف هل الشخص التاني (withUserId) متصل بالـ SSE؟
        const senderSocket = connections[withUserId];
        if (senderSocket) {
            senderSocket.write(`data: ${JSON.stringify({
                type: "messages_seen",
                byUserId: myId
            })}\n\n`);
        }
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

    // 1. (التصليح المعتاد) هات اليوزر بتاعنا
    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    const myId = user._id;

    // 2. (الوحش 🔥) Aggregation Pipeline
    const conversations = await Message.aggregate([
        // المرحلة 1: هات كل الرسايل اللي تخصني (سواء بعتها أو استقبلتها)
        {
            $match: {
                $or: [{ sender: myId }, { receiver: myId }]
            }
        },

        // المرحلة 2: رتبهم من الأحدث للأقدم
        // (مهم جداً عشان لما نجمع، ناخد أول واحدة فتطلع هي الأحدث)
        { $sort: { createdAt: -1 } },

        // المرحلة 3: التجميع (Group by Conversation)
        {
            $group: {
                // بنحدد مين "الطرف التاني" عشان نجمع الرسايل بناءً عليه
                _id: {
                    $cond: {
                        if: { $eq: ["$sender", myId] }, // لو أنا الراسل
                        then: "$receiver",              // يبقى الطرف التاني هو المستقبل
                        else: "$sender"                 // والعكس
                    }
                },
                // بناخد "آخر رسالة" (اللي هي أول واحدة بعد الترتيب)
                lastMessage: { $first: "$$ROOT" },

                // (بونص 🔥) بنعد الرسايل اللي "مش مقرية" في المحادثة دي
                unreadCount: {
                    $sum: {
                        $cond: [
                            // الشرط: أنا المستقبل، والرسالة مش seen
                            { $and: [{ $eq: ["$receiver", myId] }, { $eq: ["$seen", false] }] },
                            1, // زود 1
                            0  // مزودش حاجة
                        ]
                    }
                }
            }
        },

        // المرحلة 4: هات بيانات "الطرف التاني" (Lookup)
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "partnerDetails"
            }
        },

        // المرحلة 5: تنظيف الشكل (Project)
        {
            $project: {
                _id: 0, // مش عايزين ID الجروب
                partner: { $arrayElemAt: ["$partnerDetails", 0] }, // بيانات الشخص التاني
                lastMessage: 1, // بيانات الرسالة
                unreadCount: 1  // عدد الرسايل الجديدة
            }
        },

        // (تحسين) نختار بس البيانات المهمة من اليوزر عشان منرجعش الباسورد والبيانات الحساسة
        {
            $project: {
                "partner.password": 0,
                "partner.email": 0,
                "partner.createdAt": 0,
                "partner.updatedAt": 0,
                "partner.clerkId": 0
            }
        },

        // المرحلة 6: ترتيب المحادثات نفسها (اللي فيها رسالة أحدث تطلع فوق)
        { $sort: { "lastMessage.createdAt": -1 } }
    ]);

    res.status(200).json({
        success: true,
        data: conversations
    });
});