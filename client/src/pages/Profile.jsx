import { useParams } from "react-router-dom";
import PostCard from "../components/PostCard.jsx";
import { useState, useEffect } from "react";
import sample_cover from "../assets/sample_cover.jpg"
import sample_profile from "../assets/sample_profile.jpg"
import UpdateProfileModal from "../components/UpdateProfileModal.jsx"

const Profile = () => {
    const currentUser = {
        _id: "123",
        username: "MyUsername",
        profile_picture: sample_profile,
    };

    const { profileId } = useParams();

    const [user, setUser] = useState({
        _id: "u1",
        username: "John Doe",
        full_name: "John Doe",
        profile_picture: sample_profile,
        cover_photo: sample_cover,
        bio: "This is my bio",
        isFollowed: false,
        isBlocked: false,
    });

    const [posts, setPosts] = useState([
        {
            _id: "p1",
            content: "Hello world! #firstPost",
            image_urls: [
                "https://via.placeholder.com/300",
                "https://via.placeholder.com/301",
            ],
            comments: [],
            likes: [],
            createdAt: new Date().toISOString(),
        },
    ]);

    const [activeTab, setActiveTab] = useState("posts");
    const [showEdit, setShowEdit] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);

    const isMyProfile = !profileId || profileId === currentUser?._id;

    // Simple handlers (you can replace these with API calls)
    const handleFollowToggle = () => {
        setUser((prev) => ({ ...prev, isFollowed: !prev.isFollowed }));
    };

    const toggleBlock = () => {
        setIsBlocked((prev) => !prev);
        setUser((prev) => ({ ...prev, isBlocked: !prev.isBlocked }));
    };

    return (
        <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-6">
            <div className="max-w-5xl mx-auto">
                {/* Cover */}
                <div className="relative">
                    <div className="h-56 rounded-3xl bg-gradient-to-r from-indigo-600/30 via-purple-600/30 to-pink-600/30 backdrop-blur-xl shadow-2xl overflow-hidden">
                        {user.cover_photo && (
                            <img
                                src={user.cover_photo}
                                className="w-full h-full object-cover mix-blend-overlay opacity-80"
                                alt="cover"
                            />
                        )}
                    </div>

                    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
                        <img
                            src={user.profile_picture}
                            className="w-32 h-32 rounded-full border-4 border-purple-400 shadow-[0_0_40px_rgba(168,85,247,0.8)]"
                            alt={user.username}
                        />
                    </div>
                </div>

                {/* User Info */}
                <div className="mt-20 text-center text-white">
                    <h1 className="text-2xl font-bold">{user.username}</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        {user.bio || "No bio yet..."}
                    </p>

                    {isMyProfile ? (
                        <button
                            onClick={() => setShowEdit(true)}
                            className="mt-3 px-4 py-2 bg-purple-600/30 border border-purple-500/50 hover:bg-purple-600/50 rounded-xl text-sm font-medium transition cursor-pointer"
                        >
                            Edit Profile
                        </button>
                    ) : (
                        <div className="mt-3 flex justify-center gap-3">
                            <button
                                onClick={handleFollowToggle}
                                className={`px-6 py-2 rounded-xl text-sm font-medium shadow-lg transition-all
                                            ${user.isFollowed
                                        ? "bg-gradient-to-r from-red-500 to-pink-600 border border-red-500/50 text-white hover:from-red-600 hover:to-pink-700"
                                        : "bg-gradient-to-r from-gray-400 to-teal-500 border border-purple-500/50 text-white hover:from-gray-500 hover:to-teal-600"
                                    } cursor-pointer`}
                            >
                                {user.isFollowed ? "Unfollow" : "Follow"}
                            </button>

                            <button
                                onClick={toggleBlock}
                                className={`px-6 py-2 rounded-xl text-sm font-medium shadow-lg transition-all
                                            ${user.isBlocked
                                        ? "bg-red-600 border border-red-500 text-white hover:bg-red-700"
                                        : "bg-purple-600/30 border border-purple-500 text-white hover:bg-purple-600/50"
                                    } cursor-pointer`}
                            >
                                {user.isBlocked ? "Unblock" : "Block"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                {!isBlocked && (
                    <>
                        <div className="mt-10 flex justify-center gap-6">
                            {[
                                { key: "posts", label: "Posts" },
                                { key: "media", label: "Media" },
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    className={`py-2 px-5 text-sm font-medium rounded-full cursor-pointer transition-all ${activeTab === tab.key
                                        ? "bg-purple-600 text-white scale-110"
                                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                                        }`}
                                    onClick={() => setActiveTab(tab.key)}
                                >
                                    {tab.label.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {/* Posts */}
                        <div className="mt-8 flex flex-col items-center gap-6">
                            {/* --- الجزء الأول: عرض البوستات --- */}
                            {activeTab === "posts" &&
                                posts.map((post) => (
                                    <PostCard
                                        key={post._id}
                                        post={{
                                            ...post,
                                            user: {
                                                _id: user._id,
                                                username: user.username,
                                                profile_picture: user.profile_picture,
                                                full_name: user.full_name,
                                            },
                                        }}
                                        className="w-full max-w-2xl"
                                    />
                                ))}

                            {/* --- الجزء الثاني: عرض الميديا (الصور) --- */}
                            {activeTab === "media" && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                                    {posts
                                        .filter(
                                            (p) =>
                                                Array.isArray(p.image_urls) && p.image_urls.length > 0
                                        )
                                        .flatMap((p) =>
                                            p.image_urls.map((img, i) => (
                                                <img
                                                    key={`${p._id}-${i}`}
                                                    src={img}
                                                    className="rounded-xl object-cover shadow-lg hover:scale-105 transition-all w-full h-48"
                                                    alt={`media-${i}`}
                                                />
                                            ))
                                        )}
                                </div>
                            )}
                        </div>
                    </>
                )}
                {showEdit && <UpdateProfileModal setShowEdit={setShowEdit} />}
            </div>
        </div>
    );
};

export default Profile;