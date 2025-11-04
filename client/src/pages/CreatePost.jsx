import { useState } from "react";
import { Image, UnlockKeyhole, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import sample_profile from "../assets/sample_profile.jpg";
import sample_cover from "../assets/sample_cover.jpg";

const CreatePost = () => {
    const [content, setContent] = useState("");
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const [user, setUser] = useState({
        _id: "1",
        username: "Ali Haggag",
        full_name: "Ali Haggag",
        profile_picture: sample_profile,
        cover_photo: sample_cover,
        bio: "I'm a software developer. I love coding and building things.",
        isFollowed: false,
    });

    return (
        <div className="min-h-screen bg-linear-to-br from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f]
        text-white">  {/* Background */}
            <div className="max-w-6xl mx-auto p-6">  {/* Container */}
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r
                    from-purple-400 to-pink-500">
                        🔮 Create Post
                    </h1>
                    <p className="text-gray-300 mt-2">
                        Share your thoughts with the world!
                    </p>
                </div>

                {/* Form */}
                <div className="max-w-xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl
                    shadow-[0_0_25px_rgba(131,58,180,0.5)] p-6 space-y-4 border border-purple-500/40">
                    {/* User Info */}
                    <div className="flex items-center gap-3">
                        <img src={user.profile_picture} className="w-12 h-12 rounded-full border border-purple-500
                            shadow-[0_0_10px_rgba(255,0,255,0.3)]" />
                        <div>
                            <h2 className="font-semibold text-purple-200">{user.full_name}</h2>
                            <p className="text-gray-400 text-sm">@{user.username}</p>
                        </div>
                    </div>

                    {/* Post Content */}
                    <textarea className="w-full resize-none max-h-24 mt-4 text-sm outline-none placeholder-gray-400
                            bg-white/5 text-gray-200 p-3 rounded-xl border border-purple-600/40
                            focus:ring-2 focus:ring-purple-500 transition-all duration-300"
                        placeholder="What's happening?"
                        onChange={(e) => setContent(e.target.value)}
                        value={content} />
                    {
                        images.length > 0 && (
                            <div className="flex flex-wrap gap-3 mt-4">
                                {images.map((image, index) => (
                                    <div key={index} className="relative group">
                                        <img src={URL.createObjectURL(image)}
                                            className="w-24 h-24 object-cover rounded-xl border
                                            border-pink-500/50 shadow-[0_0_10px_rgba(255,0,255,0.3)]" />
                                        <div onClick={() => setImages(images.filter((_, i) => i !== index))}
                                            className="absolute hidden group-hover:flex items-center justify-center 
                                            top-0 right-0 bottom-0 left-0 bg-black/40 rounded-xl transition cursor-pointer">
                                            <X className="w-4 h-4 text-white" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    }
                    {/* Post Buttons */}
                    <div className="flex items-center justify-between p-3 border-t border-purple-500/30">
                        {/* Add Images Button */}
                        <label htmlFor="images" className="flex items-center gap-2 text-sm text-gray-400
                            hover:text-purple-300 transition cursor-pointer">
                            <Image className="w-5 h-5" /> Add Images
                        </label>

                        <input
                            type="file"
                            id="images"
                            name="images"
                            accept="image/*"
                            hidden
                            multiple
                            onChange={(e) => setImages([...images, ...e.target.files])}
                        />

                        {/* Post Publish Button */}
                        <button onClick={() => toast.promise(handleSubmit(), {
                            loading: "Uploading...",
                            success: "Post Added",
                            error: "Post Not Added",
                        })} disabled={loading} className="text-sm bg-linear-to-r from-indigo-500 to-purple-600
                            hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition text-white
                            font-medium px-8 py-2 rounded-xl shadow-[0_0_15px_rgba(131,58,180,0.5)]
                            hover:shadow-[0_0_25px_rgba(255,0,255,0.8)] cursor-pointer">
                            Publish Post
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
};

export default CreatePost;