import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/Message.js";
import User from "../models/User.js"; // 1. استيراد الموديل

const app = express();

// بنعمل سيرفر HTTP عادي وبنركب عليه السوكيت
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173"], // ⚠️ هام: تأكد إن ده رابط الفرونت إند بتاعك بالظبط
        methods: ["GET", "POST"]
    }
});

// 👇👇👇 السطر ده هو الحل 👇👇👇
// بنربط الـ io بالـ app عشان نقدر نستخدمه في الكنترولرز (req.app.get('io'))
app.set("io", io);

// 🗺️ خريطة لتخزين اليوزرز (userId: socketId)
// عشان نعرف نبعت رسالة لشخص معين باستخدام الـ ID بتاعه
export const userSocketMap = {}; // {userId: socketId}
const hiddenUsers = new Set();   // 2. قائمة الناس "الأشباح" (عشان نخفيهم من الأونلاين)

// دالة مساعدة عشان نجيب الـ Socket ID بتاع أي حد
export const getReceiverSocketId = (receiverId) => {
    return userSocketMap[receiverId];
};

io.on("connection", async (socket) => {
    console.log("a user connected 🔌", socket.id);

    // 1. استلام الـ userId من الفرونت إند (هنشرحها في كود الفرونت)
    const userId = socket.handshake.query.userId;

    // 2. تسجيل اليوزر إنه "أونلاين"
    if (userId && userId !== "undefined") {
        userSocketMap[userId] = socket.id;

        // 3. لما اليوزر يتصل، شيك على الداتابيز
        // هل هو مفعل "إخفاء الظهور" ولا لأ؟
        try {
            const user = await User.findById(userId).select("hideOnlineStatus");
            if (user && user.hideOnlineStatus) {
                hiddenUsers.add(userId); // ضيفه لقائمة الأشباح
            }
        } catch (error) {
            console.error("Error fetching user privacy:", error);
        }

        // 👇 التريك هنا: أول ما يفتح، كل الرسايل اللي جاتله وهي مقفولة تبقى Delivered
        const markAsDelivered = async () => {
            try {
                // 1. تحديث في الداتابيز
                await Message.updateMany(
                    { receiver: userId, delivered: false },
                    { $set: { delivered: true } }
                );

                // 2. إبلاغ المرسلين (اللي فاتحين حالياً) إن رسايلهم وصلت
                // بنجيب قائمة بالناس اللي باعتة رسايل لليوزر ده لسه موصلتش
                const senders = await Message.distinct("sender", { receiver: userId });

                senders.forEach(senderId => {
                    const senderSocketId = userSocketMap[senderId.toString()];
                    if (senderSocketId) {
                        // بنبعت إشارة للراسل: "رسايلك وصلت لليوزر ده"
                        io.to(senderSocketId).emit("messagesDelivered", { toUserId: userId });
                    }
                });
            } catch (err) {
                console.error("Error updating delivered status:", err);
            }
        };

        // 👇 الإضافة المهمة جداً: الاستماع لحدث "feedback" من الفرونت إند
        // لما الفرونت يستلم رسالة ويقول "أنا استلمت"، السيرفر يبلغ الراسل
        socket.on("messageReceivedConfirm", ({ messageId, senderId, receiverId }) => {
            const senderSocket = userSocketMap[senderId];
            if (senderSocket) {
                // بلغ الراسل إن رسالته بقت Delivered
                io.to(senderSocket).emit("messageDelivered", {
                    messageId,
                    toUserId: receiverId // عشان الراسل يعرف دي رسالة لمين
                });
            }

            // (اختياري) تحديث الداتابيز إن الرسالة دي بقت delivered
            // await Message.findByIdAndUpdate(messageId, { delivered: true });
        });
        markAsDelivered();
    }


    // 👇👇 لازم الكود ده يكون موجود عشان يدخل الروم 👇👇
    socket.on("joinGroup", (groupId) => {
        socket.join(groupId);
        console.log(`User joined group room: ${groupId}`);
    });

    // 4. استمع لحدث "تغيير الحالة" من الفرونت (عشان السويتش يشتغل لحظياً)
    socket.on("toggleOnlineStatus", ({ isHidden }) => {
        if (isHidden) {
            hiddenUsers.add(userId); // خبيه
        } else {
            hiddenUsers.delete(userId); // أظهره
        }
        // حدث القائمة للكل فوراً
        emitOnlineUsers();
    });

    // 5. دالة إرسال القائمة (المعدلة)
    const emitOnlineUsers = () => {
        // هات كل الناس المتصلين
        const allOnlineUsers = Object.keys(userSocketMap);

        // شيل منهم "الأشباح"
        const visibleOnlineUsers = allOnlineUsers.filter(id => !hiddenUsers.has(id));

        // ابعت القائمة النظيفة
        io.emit("getOnlineUsers", visibleOnlineUsers);
    };

    // ابعت القائمة أول ما يدخل
    emitOnlineUsers();

    // 4. عند قطع الاتصال (قفل المتصفح)
    socket.on("disconnect", async () => { // 👈 خليناها async
        console.log("user disconnected ❌", socket.id);

        // 👇👇 الإضافة الجديدة: تحديث آخر ظهور 👇👇
        if (userId) {
            // نحدث الوقت الحالي في الداتابيز
            await User.findByIdAndUpdate(userId, { lastSeen: new Date() });

            delete userSocketMap[userId];
            // لازم كمان نشيله من الـ hiddenUsers لو كان فيها
            hiddenUsers.delete(userId);

            io.emit("getOnlineUsers", Object.keys(userSocketMap));
        }
    });
});

export { app, io, server };