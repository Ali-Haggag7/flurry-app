import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import Story from "../models/Story.js";
import Message from "../models/Message.js";
import sendEmail from "../utils/sendEmail.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "my-app" });


// Inngest Function to save user data
const syncUserCreation = inngest.createFunction(
    { id: "sync-user-from-clerk" },  // The name of the function
    { event: "clerk/user.created" },  // الوظيفة دي بتشتغل تلقائيًا clerk كل مرة مستخدم جديد يتسجل في 
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data;  // معلومات المستخدم

        let username = email_addresses[0].email_address.split("@")[0];  // usernameبياخد أول جزء من الإيميل ك
        const user = await User.findOne({ username });

        if (user) {
            username += Math.floor(Math.random() * 10000);  // لو موجود فعلًا، بيضيف رقم عشوائي (عشان ميكررش نفس الاسم)
        }

        const userData = {  // هنا بيكوّن object يحتوي على بيانات المستخدم الجديد
            _id: id,
            email: email_addresses[0].email_address,
            full_name: first_name + " " + last_name,
            profile_picture: image_url,
            username,
        };

        await User.create(userData);  // دي بتسجل المستخدم الجديد في قاعدة البيانات
    }
);


// Inngest Function to update user data in database
const syncUserUpdate = inngest.createFunction(
    { id: "update-user-from-clerk" },
    { event: "clerk/user.updated" },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data;

        const updatedUserData = {
            _id: id,
            email: email_addresses[0].email_address,
            full_name: first_name + " " + last_name,
            profile_picture: image_url,
        };

        await User.findByIdAndUpdate(id, updatedUserData);
    }
);


// Inngest Function to delete user from database
const syncUserDeletion = inngest.createFunction(
    { id: "delete-user-from-clerk" },
    { event: "clerk/user.deleted" },
    async ({ event }) => {

        await User.findByIdAndDelete(id);
    }
);


/**
 * دي "فنكشن مساعدة" عملناها عشان "منكررش" الكود.
 * وظيفتها تاخد الكونكشن وتبعتله الإيميل.
 */
async function sendConnectionNotification(connection, isReminder = false) {
    // (تحسين) ممكن نغير العنوان لو ده تذكير
    const subject = isReminder
        ? `Reminder: New Connection Request`
        : `New Connection Request`;

    const body = `<div style="font-family:Arial, sans-serif; padding:20px;">
                        <h2>Hi ${connection.to_user_id.full_name},</h2>
                        <p>You have a new connection request from ${connection.from_user_id.full_name}
                        - @${connection.from_user_id.username}</p>
                        <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color:#10b981;">here</a>
                        to accept or reject the request</p>
                        <br/>
                        <p>Thanks ,<br/> Postly - Stay Connected</p>
                    </div>`;

    await sendEmail({
        to: connection.to_user_id.email,
        subject,
        body
    });
}
// --- الفانكشن الأساسية بتاعة إنجست ---
export const sendNewConnectionRequestReminder = inngest.createFunction(
    { id: "send-new-connection-request-reminder" },
    { event: "app/connection-requested" },
    async ({ event, step }) => {
        const { connectionId } = event.data;

        // "الخطوة الأولى: الإيميل الفوري"
        await step.run("send-initial-connection-mail", async () => {
            const connection = await Connection.findById(connectionId).populate("from_user_id to_user_id");

            // (تحسين 1) - لو ملقيناش الكونكشن (اتمسح مثلاً)، نخرج
            if (!connection) {
                return { message: "Connection not found, aborting." };
            }

            // (تحسين 2) - استخدمنا الفانكشن المساعدة
            await sendConnectionNotification(connection, false);
            return { message: "Initial email sent." };
        });

        // "الخطوة التانية: النوم (Sleep)"
        const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await step.sleepUntil("wait-for-24-hours", in24Hours);

        // "الخطوة التالتة: التذكير (الروبوت صحي)"
        await step.run("send-connection-request-reminder", async () => {
            // بنجيب الكونكشن "تاني" عشان حالته الجديدة
            const connection = await Connection.findById(connectionId).populate("from_user_id to_user_id");

            // (تحسين 3) - تصليح اللوجيك
            // هل الكونكشن موجود "و" حالته "لسه معلقة"؟
            if (connection && connection.status === "pending") {
                // لو آه، ابعتله التذكير (بنفس الفانكشن المساعدة)
                await sendConnectionNotification(connection, true); // (بعتنا true عشان يعرف إنه تذكير)
                return { message: "Reminder email sent." };
            }

            // لو الحالة (accepted) أو (rejected) أو (null)
            return { message: "No reminder needed." };
        });
    }
);


// Inngest Function to delete a story
const deleteStory = inngest.createFunction(
    { id: "delete-story-after-24-hours" }, // (غيرت الاسم عشان يبقى أوضح)

    // (تصليح 1 - أهم تصليح)
    // هنستنى الإيفنت بتاع "إنشاء" الاستوري، مش "مسحها"
    { event: "app/story.created" }, // <--- ده التصليح

    async ({ event, step }) => {
        const { storyId } = event.data;

        // (تصليح 2 - تحسين بسيط)
        // ممكن نضيف لوج عشان نتأكد إن الفانكشن اشتغلت
        await step.run("log-story-deletion-job", () => {
            console.log(`Job scheduled: Deleting story ${storyId} in 24 hours.`);
            return { success: true };
        });

        const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await step.sleepUntil("wait-for-24-hours", in24Hours);

        await step.run("delete-story-from-db", async () => {
            // هيمسح الاستوري لو لقاها
            // لو اليوزر مسحها يدوي قبل 24 ساعة، الفانكشن دي مش هتضرب
            await Story.findByIdAndDelete(storyId);
            return { message: `Story ${storyId} deleted.` };
        })
    }
);


// Inngest Function to send notifications of unread messages
// الفانكشن دي "بتجدول" الشغل، مش بتنفذه
export const scheduleUnreadNotifications = inngest.createFunction(
    { id: "schedule-unread-notifications" },
    { cron: "TZ=America/New_York 0 9 * * *" }, // (استخدم cron بدل event)
    async ({ step }) => {

        // 1. (تصليح 1) - هنستخدم "Aggregation"
        // دي الكويري اللي بتجيب العد من الداتابيز "فقط"
        const userCounts = await Message.aggregate([
            // الخطوة 1: هات بس الرسايل اللي متقرتش
            { $match: { seen: false } },

            // الخطوة 2: جمعهم حسب اليوزر اللي مبعوتله
            {
                $group: {
                    _id: "$to_user_id", // جمع بـ to_user_id
                    count: { $sum: 1 }  // عد كل واحد
                }
            }
        ]);
        // النتيجة: [ { _id: 'user123', count: 5 }, { _id: 'user456', count: 12 } ]

        // لو مفيش رسايل متقرتش، نخرج
        if (userCounts.length === 0) {
            return { message: "No unread messages." };
        }

        // 2. (تصليح 2) - هنستخدم "Fan-Out" (توزيع الشغل)
        // هنعمل لستة "إيفنتات"
        const events = userCounts.map(item => ({
            name: "app/send-unread-summary", // ده اسم الشغلانة الجديدة
            data: {
                userId: item._id, // الـ ID بتاع اليوزر
                count: item.count   // العدد بتاعه
            }
        }));

        // 3. (تصليح 3) - هنستخدم "step"
        // هنبعت كل الإيفنتات دي لإنجست مرة واحدة
        await step.sendEvent("fan-out-unread-jobs", events);

        return { message: `Scheduled ${events.length} summary emails.` };
    }
);
// دي الفانكشن اللي بتسمع للإيفنت اللي فات وتنفذ.
export const sendUnreadSummaryEmail = inngest.createFunction(
    { id: "send-unread-summary-email-worker" },
    { event: "app/send-unread-summary" }, // 1. بتسمع للإيفنت ده
    async ({ event, step }) => {
        // 2. بتاخد الداتا اللي جاية مع الإيفنت
        const { userId, count } = event.data;

        // 3. (تصليح 4) - بنستخدم step.run عشان الموثوقية
        await step.run("send-summary-email", async () => {

            // 4. بنجيب اليوزر (كويري واحدة بس)
            const user = await User.findById(userId);
            if (!user) {
                throw new Error(`User not found: ${userId}`);
            }

            // 5. بنجهز الإيميل
            const subject = `You have ${count} unseen messages`;
            const body = `
            <div style="font-family:Arial , sans-serif;padding:20px;">
                <h2>Hi ${user.full_name},</h2>
                <p>You have ${count} unseen messages</p>
                <p>Click <a href="${process.env.FRONTEND_URL}/messages" style="color:#10b981;">here</a> to view them</p>
                <br/>
                <p>Thankx , <br /> Postly - Stay Connected </p>
            </div>
            `; // (صلحت الباج بتاعة stylr)

            // 6. بنبعت الإيميل
            await sendEmail({
                to: user.email,
                subject,
                body
            });

            return { message: `Email sent to ${user.email}` };
        });
    }
);


export const functions = [
    syncUserCreation,
    syncUserUpdate,
    syncUserDeletion,
    sendNewConnectionRequestReminder,
    deleteStory,
    scheduleUnreadNotifications,
    sendUnreadSummaryEmail
];