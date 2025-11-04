import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./configs/db.js";
import { inngest, functions } from "./inngest/index.js";
import { serve } from "inngest/express"

dotenv.config();

// Connection To Db
connectDB();

// Creating The Server
const app = express();

// Middlewares 
app.use(express.json()); // to parse JSON data
app.use(cors()); // to allow cross-origin requests

// Routes
app.get("/", (req, res) => {
    res.send("Server is running");
});

// Inngest Functions
app.use("/api/inngest", serve({ client: inngest, functions }));

// Running The Server
const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`Server is running on port : ${port}`);
});
