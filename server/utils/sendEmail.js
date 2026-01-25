/**
 * @file emailService.js
 * @description Handles email transmission using Nodemailer.
 * Configured specifically for Mailtrap Sandbox with forced port settings to resolve connection issues.
 */

import nodemailer from "nodemailer";

// --- Configuration ---

/**
 * Transporter Configuration
 * NOTE: Host and Port are hardcoded to 'sandbox.smtp.mailtrap.io' and 587
 * to prevent environment variable misconfiguration and ensure connection stability.
 */
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 587, // Strictly using port 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// --- Service Functions ---

/**
 * Sends an email using the configured transporter.
 *
 * @param {Object} params - The email parameters.
 * @param {string} params.to - Recipient email address.
 * @param {string} params.subject - Subject line of the email.
 * @param {string} params.html - HTML body content.
 * @returns {Promise<boolean>} Returns true if sent successfully, false otherwise.
 */
const sendEmail = async ({ to, subject, html }) => {
    // Debug Log: Verify active SMTP configuration before sending
    console.log("🚀 SMTP Config (Active):", {
        host: "sandbox.smtp.mailtrap.io",
        port: 587,
        user: process.env.SMTP_USER,
    });

    try {
        const info = await transporter.sendMail({
            from: `"Flurry System" <${process.env.SENDER_EMAIL || "test@flurry.com"}>`,
            to: to,
            subject: subject,
            html: html,
        });

        console.log(
            `✅ Email sent via Mailtrap! Message ID: ${info.messageId}`
        );
        return true;
    } catch (error) {
        console.error("❌ Error sending email:", error);
        return false;
    }
};

export default sendEmail;