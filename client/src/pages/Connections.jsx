import { Users, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const Connections = () => {

    const navigate = useNavigate();
    const [currentTab, setCurrentTab] = useState("Followers");
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [pendingConnections, setPendingConnections] = useState([]);
    const [connections, setConnections] = useState([]);

    const tabs = [
        { label: "Followers", value: followers, icon: Users, color: "from-purple-400 to-pink-500" },
        { label: "Following", value: following, icon: Users, color: "from-green-400 to-teal-500" },
        { label: "Pending", value: pendingConnections, icon: Users, color: "from-yellow-400 to-orange-500" },
        { label: "Connections", value: connections, icon: Users, color: "from-indigo-400 to-blue-500" },
    ];

    const handleUnfollow = () => {
        // Handle unfollow logic here
    }

    const handleAccept = () => {
        // Handle accept logic here
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-[#0b0f3b] via-[#3c1f7f] to-[#3c1f7f] text-white">
            <div className="max-w-6xl mx-auto py-10">

                {/* Header / Title */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-10"
                >
                    <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-purple-400
            to-pink-500">🌟 Your Network</h1>
                    <p className="text-gray-300 mt-2">
                        Discover, connect, and grow your magical network
                    </p>
                </motion.div>

                {/* Tabs */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }} className="flex flex-wrap justify-center gap-4 mb-10">
                    {tabs.map((tab) => (
                        <button key={tab.label} onClick={() => setCurrentTab(tab.label)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all cursor-pointer
                                    ${currentTab === tab.label ? `bg-linear-to-r ${tab.color} shadow-lg`
                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                            <span className="ml-1 bg-white/20 text-xs px-2 py-0.5 rounded-full">
                                {tab.value?.length}
                            </span>
                        </button>
                    ))}
                </motion.div>

                {/* Users Grid */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {tabs.find((tab) => tab.label === currentTab)?.value.map((user) => (
                        <motion.div key={user.id}
                            whileHover={{ scale: 1.03, boxShadow: "0 0 20px rgba(255,255,255,0.3)" }}
                            className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6
                                        flex flex-col justify-between shadow-lg transition-all">

                            <div className="flex flex-col items-center text-center gap-3">
                                <img src={user.profile_picture} className="w-20 h-20 rounded-full shadow-md"
                                    alt={user.full_name} />
                                <h2 className="font-semibold text-lg">{user.full_name}</h2>
                                <p className="text-gray-300 text-sm">@{user.username}</p>
                                {user.bio && <p className="text-gray-400 text-xs mt-1">{user.bio.slice(0, 50)}...</p>}
                            </div>

                            <div className="flex flex-col gap-3 mt-4">
                                <button onClick={() => navigate(`/profile/${user._id}`)} className="
                                        w-full py-2 rounded-full bg-linear-to-r from-indigo-500 to-purple-600
                                        hover:from-indigo-600 hover:to-purple-700 transition text-white font-medium cursor-pointer">
                                    View Profile
                                </button>
                                {
                                    currentTab === "Following" && (
                                        <button onClick={() => handleUnfollow(user._id)}
                                            className="w-full py-2 rounded-full bg-white/20 hover:bg-white/30 transition text-white
                                            font-medium cursor-pointer">
                                            Unfollow
                                        </button>
                                    )
                                }
                                {
                                    currentTab === "Pending" && (
                                        <button onClick={() => handleAccept(user._id)}
                                            className="w-full py-2 rounded-full bg-white/20 hover:bg-white/30 transition text-white 
                                            font-medium cursor-pointer">
                                            Accept
                                        </button>
                                    )
                                }
                                {
                                    currentTab === "Connections" && (
                                        <button onClick={() => navigate(`/messages/${user._id}`)}
                                            className="w-full py-2 rounded-full bg-linear-to-r from-gray-400 to-teal-500 hover:from-gray-400
                                            hover:to-teal-600 transition text-white font-medium flex items-center justify-center gap-2 cursor-pointer">
                                            <MessageSquare className="w-4 h-4" /> Message
                                        </button>
                                    )
                                }
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </div>
    )
}

export default Connections