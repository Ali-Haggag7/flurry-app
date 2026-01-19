import expressAsyncHandler from "express-async-handler";
import Notification from "../models/Notification.js";
import User from "../models/User.js"; // 👈 لازم نستورد موديل اليوزر
import { io, userSocketMap } from "../socket/socket.js";


/**----------------------------------------------
 * @desc Get User Notifications
 * @route /api/notifications
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getUserNotifications = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { filter } = req.query;

    const user = await User.findOne({ clerkId });
    if (!user) { res.status(404); throw new Error("User not found"); }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    let query = { recipient: user._id };

    if (filter === 'requests') {
        // 🤝 حالة الشبكة (طلبات فقط)
        query.type = { $in: ["connection_request", "follow_request"] };
        query.status = "pending";
    } else {
        // 🔔 حالة الجرس (Default)
        // 👇 التعديل هنا: حددنا الأنواع المسموحة للجرس فقط (تفاعلات + قبول صداقة)
        // ومستحيل يجيب connection_request هنا
        query.type = {
            $in: ["like", "comment", "reply", "share", "follow", "connection_accept", "follow_accept"]
        };
    }

    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", "full_name username profile_picture")
        .populate("post", "content image")
        .populate("commentId", "text")
        .lean();

    const totalCount = await Notification.countDocuments(query);
    const hasMore = totalCount > skip + notifications.length;

    res.status(200).json({ success: true, notifications, hasMore });
});


/**----------------------------------------------
 * @desc Get Unread Count (For Bell Icon 🔔)
 * @route /api/notifications/unread-count
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getUnreadCount = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const user = await User.findOne({ clerkId });

    if (!user) {
        return res.status(200).json({ success: true, count: 0 });
    }

    // 👇 التعديل المهم: عد الغير مقروء من نوع "Interactions" فقط
    // عشان الـ Requests ليها عداد خاص بيها (النقطة الحمراء)
    const count = await Notification.countDocuments({
        recipient: user._id,
        read: false,
        type: { $in: ["like", "comment", "reply", "share", "follow", "connection_accept", "follow_accept"] }
    });

    res.status(200).json({
        success: true,
        count
    });
});


/**----------------------------------------------
 * @desc Delete Notification
 * @route /api/notifications/:id
 * @method DELETE
 * @access Private
--------------------------------------------------*/
export const deleteNotification = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { id } = req.params;

    const user = await User.findOne({ clerkId });

    const notification = await Notification.findById(id);
    if (!notification) {
        res.status(404);
        throw new Error("Notification not found");
    }

    // Security Check: هل أنا صاحب الإشعار؟
    if (notification.recipient.toString() !== user._id.toString()) {
        res.status(403);
        throw new Error("Not authorized");
    }

    await Notification.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: "Notification deleted"
    });
});


/**----------------------------------------------
 * @desc Mark ONE Notification as Read
 * @route /api/notifications/:id/read
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const markOneAsRead = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { id } = req.params;

    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    // بنبحث عن الإشعار ونتأكد إنه بتاع اليوزر ده
    const notification = await Notification.findOneAndUpdate(
        { _id: id, recipient: user._id }, // الشرط
        { read: true },                 // التحديث
        { new: true }                   // رجع الجديد
    );

    if (!notification) {
        res.status(404);
        throw new Error("Notification not found");
    }

    res.status(200).json({ success: true, notification });
});


/**----------------------------------------------
 * @desc Mark All (or filtered) Notifications as Read
 * @route /api/notifications/read-all
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const markAllAsRead = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const { type } = req.query; // هنستقبل النوع هنا (like, comment, etc..)

    const user = await User.findOne({ clerkId });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    // بنجهز فلتر البحث
    let filter = { recipient: user._id, read: false };

    // لو باعت نوع معين (ومش all)، ضيفه للفلتر
    if (type && type !== "all") {
        filter.type = type;
    }

    // التحديث السحري
    await Notification.updateMany(filter, { $set: { read: true } });

    res.status(200).json({ success: true, message: "Notifications marked as read" });
});


/**----------------------------------------------
 * @desc Get All Network Requests (For Red Dot 🔴)
 * @route /api/notifications/network-counts
 * @method GET
 * @access Private
--------------------------------------------------*/
export const getNetworkCounts = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const user = await User.findOne({ clerkId });

    if (!user) { return res.status(404).json({ message: "User not found" }); }

    // 👇 التعديل: بنعد الإشعارات اللي (نوعها طلبات) + (مش مقروءة)
    const count = await Notification.countDocuments({
        recipient: user._id,
        type: { $in: ["connection_request", "follow_request"] },
        read: false // 👈 ده الشرط اللي هيخلي الرقم يصفر لما تعمل mark read
    });

    res.status(200).json({ count });
});


/**----------------------------------------------
 * @desc Mark Network Requests as Read (Clears the Red Dot 🔴)
 * @route /api/notifications/mark-network-read
 * @method PUT
 * @access Private
--------------------------------------------------*/
export const markNetworkAsRead = expressAsyncHandler(async (req, res) => {
    const { userId: clerkId } = req.auth();
    const user = await User.findOne({ clerkId });

    if (!user) { res.status(404); throw new Error("User not found"); }

    // التحديث السحري: بنستهدف بس "طلبات الصداقة" و "المتابعة" اللي لسه مش مقروءة
    await Notification.updateMany(
        {
            recipient: user._id,
            type: { $in: ["connection_request", "follow_request"] }, // 👈 ده الفلتر المهم
            read: false
        },
        { $set: { read: true } }
    );

    res.status(200).json({ success: true, message: "Network requests marked as read" });
});


/**
 * (Helper Function) - تستخدم داخل الـ Controllers الأخرى
 */
export const createNotification = async ({ recipient, sender, type, post, commentId, status }) => {
    try {
        // 1. ممنوع أبعت لنفسي
        if (recipient.toString() === sender.toString()) return;

        // 2. منع التكرار (لأي نوع ماعدا الكومنتات)
        if (type !== 'comment' && type !== 'reply') {
            const existing = await Notification.findOne({ recipient, sender, type, post, commentId });
            if (existing) return;
        }

        // 👇👇 هنا كان الغلطة: لازم نعرف المتغير newNotification
        const newNotification = await Notification.create({
            recipient,
            sender,
            type,
            post,
            commentId,
            status: status || "pending"
        });

        // 👇👇 3. (Real-time Push) 👇👇
        const receiverSocketId = userSocketMap[recipient.toString()];

        if (receiverSocketId) {
            // بنعمل populate عشان الفرونت إند يعرف يعرض الصورة والاسم
            // (استخدمنا await عشان populate بترجع Promise)
            const populatedNotif = await newNotification.populate("sender", "full_name username profile_picture");

            // إرسال الإشعار
            io.to(receiverSocketId).emit("newNotification", populatedNotif);
        }

    } catch (error) {
        console.error("Notification Error:", error);
    }
};