import { Inngest } from "inngest";
// --- Models ---
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import Story from "../models/Story.js";
import Message from "../models/Message.js";
// --- Utils ---
import sendEmail from "../utils/sendEmail.js";

// Initialize Inngest Client
export const inngest = new Inngest({ id: "my-app" });

// =========================================================
// 1. User Synchronization (Clerk Webhooks)
// =========================================================

/**
 * Syncs new user creation from Clerk to MongoDB.
 * Handles username collision by appending random digits if necessary.
 */
const syncUserCreation = inngest.createFunction(
    { id: "sync-user-from-clerk" },
    { event: "clerk/user.created" },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data;

        let username = email_addresses[0].email_address.split("@")[0];

        // Check for username collision
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            username += Math.floor(Math.random() * 10000);
        }

        const userData = {
            _id: id, // Explicitly mapping Clerk ID to MongoDB _id
            email: email_addresses[0].email_address,
            full_name: `${first_name} ${last_name}`,
            profile_picture: image_url,
            username,
        };

        await User.create(userData);
    }
);

/**
 * Updates existing user data when changed in Clerk.
 */
const syncUserUpdate = inngest.createFunction(
    { id: "update-user-from-clerk" },
    { event: "clerk/user.updated" },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data;

        const updatedUserData = {
            _id: id,
            email: email_addresses[0].email_address,
            full_name: `${first_name} ${last_name}`,
            profile_picture: image_url,
        };

        await User.findByIdAndUpdate(id, updatedUserData);
    }
);

/**
 * Deletes user from MongoDB when deleted in Clerk.
 */
const syncUserDeletion = inngest.createFunction(
    { id: "delete-user-from-clerk" },
    { event: "clerk/user.deleted" },
    async ({ event }) => {
        const { id } = event.data; // Fixed: Destructured id from event.data
        await User.findByIdAndDelete(id);
    }
);

// =========================================================
// 2. Connection Notifications & Logic
// =========================================================

/**
 * Helper: Sends connection request email notifications.
 * @param {Object} connection - The populated connection object
 * @param {Boolean} isReminder - Whether this is a reminder email
 */
async function sendConnectionNotification(connection, isReminder = false) {
    const subject = isReminder
        ? `Reminder: New Connection Request`
        : `New Connection Request`;

    const body = `
    <div style="font-family:Arial, sans-serif; padding:20px;">
      <h2>Hi ${connection.to_user_id.full_name},</h2>
      <p>You have a new connection request from ${connection.from_user_id.full_name} 
      - @${connection.from_user_id.username}</p>
      <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color:#10b981;">here</a> 
      to accept or reject the request</p>
      <br/>
      <p>Thanks,<br/> Postly - Stay Connected</p>
    </div>
  `;

    await sendEmail({
        to: connection.to_user_id.email,
        subject,
        body,
    });
}

/**
 * Orchestrates connection request notifications:
 * 1. Sends immediate email.
 * 2. Waits 24 hours.
 * 3. Checks status and sends reminder if still pending.
 */
export const sendNewConnectionRequestReminder = inngest.createFunction(
    { id: "send-new-connection-request-reminder" },
    { event: "app/connection-requested" },
    async ({ event, step }) => {
        const { connectionId } = event.data;

        // --- Step 1: Initial Email ---
        await step.run("send-initial-connection-mail", async () => {
            const connection = await Connection.findById(connectionId).populate("from_user_id to_user_id");

            if (!connection) {
                return { message: "Connection not found, aborting." };
            }

            await sendConnectionNotification(connection, false);
            return { message: "Initial email sent." };
        });

        // --- Step 2: Delay ---
        const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await step.sleepUntil("wait-for-24-hours", in24Hours);

        // --- Step 3: Reminder Logic ---
        await step.run("send-connection-request-reminder", async () => {
            // Re-fetch connection to check current status
            const connection = await Connection.findById(connectionId).populate("from_user_id to_user_id");

            if (connection && connection.status === "pending") {
                await sendConnectionNotification(connection, true);
                return { message: "Reminder email sent." };
            }

            return { message: "No reminder needed." };
        });
    }
);

// =========================================================
// 3. Story Management (Ephemeral Content)
// =========================================================

/**
 * Handles the automatic deletion of stories 24 hours after creation.
 */
const deleteStory = inngest.createFunction(
    { id: "delete-story-after-24-hours" },
    { event: "app/story.created" },
    async ({ event, step }) => {
        const { storyId } = event.data;

        await step.run("log-story-deletion-job", () => {
            console.log(`Job scheduled: Deleting story ${storyId} in 24 hours.`);
            return { success: true };
        });

        const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await step.sleepUntil("wait-for-24-hours", in24Hours);

        await step.run("delete-story-from-db", async () => {
            // Deletes story if it exists (idempotent operation)
            await Story.findByIdAndDelete(storyId);
            return { message: `Story ${storyId} deleted.` };
        });
    }
);

// =========================================================
// 4. Unread Message Digest (Cron Job & Fan-Out)
// =========================================================

/**
 * Cron Job: Runs daily at 9:00 AM NY Time.
 * Aggregates unread message counts and triggers individual email jobs (Fan-Out pattern).
 */
export const scheduleUnreadNotifications = inngest.createFunction(
    { id: "schedule-unread-notifications" },
    { cron: "TZ=America/New_York 0 9 * * *" },
    async ({ step }) => {
        // 1. Aggregation: Group unread messages by recipient
        const userCounts = await Message.aggregate([
            { $match: { seen: false } },
            {
                $group: {
                    _id: "$to_user_id",
                    count: { $sum: 1 },
                },
            },
        ]);

        if (userCounts.length === 0) {
            return { message: "No unread messages." };
        }

        // 2. Map results to event payloads
        const events = userCounts.map((item) => ({
            name: "app/send-unread-summary",
            data: {
                userId: item._id,
                count: item.count,
            },
        }));

        // 3. Fan-Out: Dispatch events for parallel processing
        await step.sendEvent("fan-out-unread-jobs", events);

        return { message: `Scheduled ${events.length} summary emails.` };
    }
);

/**
 * Worker: Processes individual unread summary emails.
 * Triggered by the Cron Job above.
 */
export const sendUnreadSummaryEmail = inngest.createFunction(
    { id: "send-unread-summary-email-worker" },
    { event: "app/send-unread-summary" },
    async ({ event, step }) => {
        const { userId, count } = event.data;

        await step.run("send-summary-email", async () => {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error(`User not found: ${userId}`);
            }

            const subject = `You have ${count} unseen messages`;
            const body = `
        <div style="font-family:Arial, sans-serif; padding:20px;">
            <h2>Hi ${user.full_name},</h2>
            <p>You have ${count} unseen messages</p>
            <p>Click <a href="${process.env.FRONTEND_URL}/messages" style="color:#10b981;">here</a> to view them</p>
            <br/>
            <p>Thanks,<br/> Postly - Stay Connected</p>
        </div>
        `;

            await sendEmail({
                to: user.email,
                subject,
                body,
            });

            return { message: `Email sent to ${user.email}` };
        });
    }
);

// Export all functions for Inngest serve handler
export const functions = [
    syncUserCreation,
    syncUserUpdate,
    syncUserDeletion,
    sendNewConnectionRequestReminder,
    deleteStory,
    scheduleUnreadNotifications,
    sendUnreadSummaryEmail,
];