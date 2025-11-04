import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    email: {
        type: String,
        trim: true,
        unique: true,
        required: true
    },
    full_name: {
        type: String,
        trim: true,
        required: true,
    },
    username: {
        type: String,
        trim: true,
        required: true,
        unique: true
    },
    bio: {
        type: String,
        default: "Hey there! I'm using flowNet!"
    },
    profile_picture: {
        type: String,
        default: ""
    },
    cover_photo: {
        type: String,
        default: ""
    },
    followers: {
        type: Array,
        default: []
    },
    following: {
        type: Array,
        default: []
    },
    password: {
        type: String,
        trim: true,
        required: true
    },
}, {
    timestamps: true,  // Add createdAt and updatedAt fields
    collection: "User"  // Specify the collection name
});

const User = mongoose.model("User", userSchema);  // Create the model

export default User;