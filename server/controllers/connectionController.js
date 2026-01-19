import mongoose from "mongoose";
import expressAsyncHandler from "express-async-handler";
import Connection from "../models/Connection.js";
import { inngest } from "../inngest/index.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js"; // 👈 استيراد موديل الإشعار
import sendEmail from "../utils/sendEmail.js";


// 👇👇👇 1. استدعاء أدوات السوكيت (تأكد من المسار حسب ملفاتك) 👇👇👇
import { io, getReceiverSocketId } from "../socket/socket.js";


/**----------------------------------------------
 * @desc Send Connection Request
 * @route /api/connection/send
 * @method POST
 * @access Private
--------------------------------------------------*/
export const sendConnectionRequest = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { receiverId } = req.body;

    if (userId === receiverId) throw new Error("You cannot send a request to yourself");

    const sender = await User.findOne({ clerkId: userId });
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) throw new Error("User not found");

    if (sender.connections.includes(receiver._id)) {
        throw new Error("You are already connected");
    }

    if (sender.sentRequests.includes(receiver._id)) {
        throw new Error("Request already sent");
    }

    // تحديث المصفوفات
    sender.sentRequests.push(receiver._id);
    receiver.pendingRequests.push(sender._id);

    await sender.save();
    await receiver.save();

    // 👇👇👇 2. التعديل هنا: استخدمنا Notification.create مباشرة 👇👇👇
    // دي بترجع الأوبجكت اللي اتعمل وتخزنه في المتغير notification
    const notification = await Notification.create({
        recipient: receiver._id,
        sender: sender._id,
        type: "connection_request",
        status: "pending"
    });

    // ---------------------------------------------------------
    // 🔔 إرسال الـ Pop-up
    // ---------------------------------------------------------
    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
        // دلوقتي notification مليانة بيانات ومش undefined
        io.to(receiverSocketId).emit("newNotification", {
            _id: notification._id, // ✅ كده هتشتغل ومش هتضرب
            type: "connection_request",
            sender: {
                _id: sender._id,
                full_name: sender.full_name,
                profile_picture: sender.profile_picture,
                username: sender.username
            },
            message: "New connection request"
        });
        console.log(`📡 Socket Notification sent to: ${receiver.username}`);
    }

    // كود الإيميل (زي ما هو)
    if (receiver.notificationSettings?.email) {
        try {
            const profileUrl = `${process.env.CLIENT_URL}/profile/${sender.username}`;
            sendEmail({
                to: receiver.email,
                subject: `New Connection Request from ${sender.full_name} 👥`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                        <h2 style="color: #333;">Hello ${receiver.full_name.split(" ")[0]}!</h2>
                        <p style="font-size: 16px;">
                            <strong>${sender.full_name}</strong> wants to connect with you on FlowNet.
                        </p>
                        <div style="margin: 20px 0;">
                            <a href="${profileUrl}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                View Profile
                            </a>
                        </div>
                        <p style="color: #777; font-size: 12px;">
                            You received this email because you have notifications enabled.
                        </p>
                    </div>
                `
            });
        } catch (error) {
            console.error("Failed to send email:", error);
        }
    }

    res.status(200).json({ success: true, message: "Connection request sent" });
});


/**----------------------------------------------
 * @desc Remove Connection Only (Unfriend)
 * @route /api/connection/remove/:userId
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const removeConnection = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { userId: targetUserId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) throw new Error("User not found");

    // 👇 التعديل: بنشيل من connections بس، وبنسيب following/followers في حالهم
    await User.findByIdAndUpdate(currentUser._id, {
        $pull: { connections: targetUser._id }
    });

    await User.findByIdAndUpdate(targetUser._id, {
        $pull: { connections: currentUser._id }
    });

    // Socket (زي ما هو)
    const receiverSocketId = getReceiverSocketId(targetUserId);
    if (receiverSocketId) {
        io.to(receiverSocketId).emit("connectionRemoved", {
            removerId: currentUser._id,
            message: "Connection removed"
        });
    }

    res.status(200).json({ success: true, message: "Connection removed successfully" });
});


/**----------------------------------------------
 * @desc Get User Connections & Requests
 * @route /api/connection
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getUserConnections = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();

    // حقول اليوزر اللي محتاجينها للعرض في الكروت
    const publicFields = "full_name username profile_picture bio";

    const user = await User.findOne({ clerkId: userId })
        // 1. الأصدقاء
        .populate("connections", publicFields)
        // 2. الطلبات الواردة
        .populate("pendingRequests", publicFields)
        // 3. الطلبات الصادرة
        .populate("sentRequests", publicFields)
        // 4. المتابعين (مهمة جداً تكون موجودة)
        .populate("followers", publicFields)
        // 5. المتابعهم
        .populate("following", publicFields)
        // 6. المحظورين (عشان إدارة البلوك)
        .populate("blockedUsers", publicFields);

    if (!user) { res.status(404); throw new Error("User not found"); }

    res.status(200).json({
        success: true,
        data: {
            connections: user.connections || [],
            pendingRequests: user.pendingRequests || [],
            sentRequests: user.sentRequests || [],
            followers: user.followers || [],
            following: user.following || [],
            blockedUsers: user.blockedUsers || []
        }
    });
});


/**----------------------------------------------
 * @desc Accept Connection Request
 * @route /api/connection/accept/:requestId
 * @method POST
 * @access Private
--------------------------------------------------*/
export const acceptConnection = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth(); // أنا (المستقبل)
    const { requestId: senderId } = req.params; // هو (الراسل الأصلي)

    const me = await User.findOne({ clerkId: userId });
    const sender = await User.findById(senderId);

    if (!me || !sender) throw new Error("User not found");

    // 1. تحديث المصفوفات (القبول)
    await User.findByIdAndUpdate(me._id, {
        $addToSet: { connections: sender._id, followers: sender._id, following: sender._id },
        $pull: { pendingRequests: sender._id }
    });

    await User.findByIdAndUpdate(sender._id, {
        $addToSet: { connections: me._id, followers: me._id, following: me._id },
        $pull: { sentRequests: me._id }
    });

    // 2. تحديث الإشعار القديم (عشان العداد ينقص عند "me")
    await Notification.findOneAndUpdate(
        { recipient: me._id, sender: sender._id, type: "connection_request" },
        { status: "accepted" }
    );

    // 👇👇👇 3. إنشاء إشعار جديد للراسل (عشان يعرف إني قبلت) 👇👇👇
    // بنستخدم create مباشرة عشان نرجع الأوبجكت
    const newNotification = await Notification.create({
        recipient: sender._id, // هو اللي هيستلم الإشعار المرة دي
        sender: me._id,        // أنا اللي عملت الأكشن
        type: "connection_accept",
        message: `${me.full_name} accepted your connection request` // رسالة توضيحية
    });

    // ---------------------------------------------------------
    // 🔔 4. إرسال الـ Pop-up (Socket)
    // ---------------------------------------------------------
    const receiverSocketId = getReceiverSocketId(senderId); // هات السوكيت بتاع الراسل

    if (receiverSocketId) {
        io.to(receiverSocketId).emit("newNotification", {
            _id: newNotification._id,
            type: "connection_accept",
            sender: {
                _id: me._id,
                full_name: me.full_name,
                profile_picture: me.profile_picture,
                username: me.username
            },
            message: "Connection accepted"
        });
    }

    // ---------------------------------------------------------
    // 📧 5. إرسال الإيميل (لو مفعل الإعدادات)
    // ---------------------------------------------------------
    if (sender.notificationSettings?.email) {
        try {
            const profileUrl = `${process.env.CLIENT_URL}/profile/${me.username}`;
            sendEmail({
                to: sender.email,
                subject: `Connection Accepted: You are now connected with ${me.full_name}! 🎉`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; text-align: center;">
                        <h2 style="color: #10b981;">Good News! 🥳</h2>
                        <p style="font-size: 16px;">
                            <strong>${me.full_name}</strong> accepted your connection request.
                        </p>
                        <p>You can now see each other's posts and updates.</p>
                        <br>
                        <a href="${profileUrl}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Visit Profile
                        </a>
                    </div>
                `
            });
        } catch (error) {
            console.error("Failed to send acceptance email:", error);
        }
    }

    res.status(200).json({ success: true, message: "Connection accepted" });
});


/**----------------------------------------------
 * @desc Reject OR Cancel Connection Request
 * @route /api/connection/reject/:id
 * @method POST
 * @access Private
--------------------------------------------------*/
export const rejectConnectionRequest = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { id: targetUserId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) throw new Error("User not found");

    // 1. تنظيف المصفوفات من الطرفين
    await User.findByIdAndUpdate(currentUser._id, {
        $pull: { pendingRequests: targetUser._id, sentRequests: targetUser._id, followRequests: targetUser._id }
    });

    await User.findByIdAndUpdate(targetUser._id, {
        $pull: { pendingRequests: currentUser._id, sentRequests: currentUser._id, followRequests: currentUser._id }
    });

    // 2. قتل الإشعار (تحديثه لـ rejected)
    // بنعمل ده عشان العداد عند "المستقبل" ينقص، والإشعار يختفي أو لونه يبهت
    await Notification.findOneAndUpdate(
        {
            $or: [
                { recipient: currentUser._id, sender: targetUser._id },
                { recipient: targetUser._id, sender: currentUser._id }
            ],
            type: { $in: ["connection_request", "follow_request"] }
        },
        { status: "rejected" } // ممكن تستبدلها بـ .findOneAndDelete() لو عايز تمسحه خالص من التاريخ
    );

    // ملحوظة: مبنبعتش Socket ولا Email في الرفض عشان "البرستيج" 😉

    res.status(200).json({ success: true, message: "Request removed/rejected successfully" });
});


/**----------------------------------------------
 * @desc Block User
 * @route /api/connection/block/:id
 * @method POST
 * @access Private
--------------------------------------------------*/
export const blockUser = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { id: targetUserId } = req.params;

    const currentUser = await User.findOne({ clerkId });
    if (!currentUser) throw new Error("User not found");

    const currentUserId = currentUser._id;

    if (currentUserId.toString() === targetUserId) {
        res.status(400); throw new Error("You cannot block yourself.");
    }

    // 3. التحديثات (زي ما هي)
    await User.findByIdAndUpdate(currentUserId, {
        $addToSet: { blockedUsers: targetUserId },
        $pull: { following: targetUserId, followers: targetUserId, connections: targetUserId }
    });

    await User.findByIdAndUpdate(targetUserId, {
        $pull: { following: currentUserId, followers: currentUserId, connections: currentUserId }
    });

    // حذف أي وثيقة صداقة قديمة
    await Connection.findOneAndDelete({
        $or: [{ sender: currentUserId, receiver: targetUserId }, { sender: targetUserId, receiver: currentUserId }]
    });

    res.status(200).json({ success: true, message: "User blocked successfully" });
});


/**----------------------------------------------
 * @desc Unblock User
 * @route /api/connection/unblock/:id
 * @method POST
 * @access Private
--------------------------------------------------*/
export const unblockUser = expressAsyncHandler(async (req, res) => {
    const { userId } = req.auth();
    const { id: targetUserId } = req.params;

    const currentUser = await User.findOne({ clerkId: userId });
    if (!currentUser) throw new Error("User not found");

    await User.findByIdAndUpdate(currentUser._id, {
        $pull: { blockedUsers: targetUserId }
    });

    res.status(200).json({ success: true, message: "User unblocked successfully" });
});