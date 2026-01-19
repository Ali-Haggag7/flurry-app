import nodemailer from "nodemailer";

// إعدادات الساعي (ثبتنا الهوست والبورت عشان نمنع اللخبطة)
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io", // كتبناه بايدينا
    port: 587,                        // 👈👈 أجبرناه يستخدم 587 (ده المهم)
    auth: {
        user: process.env.SMTP_USER,  // دول شغالين تمام سيبهم
        pass: process.env.SMTP_PASS,
    },
});

/**
 * دالة إرسال الإيميل
 */
const sendEmail = async ({ to, subject, html }) => {
    // لوج عشان نتأكد إنه شغال صح
    console.log("🚀 SMTP Config (Active):", {
        host: "sandbox.smtp.mailtrap.io",
        port: 587,
        user: process.env.SMTP_USER
    });

    try {
        const info = await transporter.sendMail({
            from: `"FlowNet System" <${process.env.SENDER_EMAIL || "test@flownet.com"}>`,
            to: to,
            subject: subject,
            html: html,
        });

        console.log(`✅ Email sent via Mailtrap! Message ID: ${info.messageId}`);
        return true;

    } catch (error) {
        console.error("❌ Error sending email:", error);
        return false;
    }
};

export default sendEmail;