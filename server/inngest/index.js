import { Inngest } from "inngest";
import User from "../models/User.js";

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


// Create an empty array where we'll export future Inngest functions
export const functions = [];