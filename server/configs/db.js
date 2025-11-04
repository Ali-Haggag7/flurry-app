import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export default function connectDB() {
    try {
        mongoose.connect(process.env.MONGO_URL).then(() => {
            console.log("MongoDB connected successfully");
        }).catch((error) => {  // عمل كونكت بس في مشكلة
            console.log(`Error to connect: ${error}`);
        });
    }
    catch (error) {  // معملش كونكت اصلا
        console.log(`Error: ${error}`);
    }
}