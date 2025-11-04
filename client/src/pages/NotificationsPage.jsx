import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Image, Bell } from "lucide-react";
import moment from "moment";

const TABS = [
    { key: "all", icon: Bell },
    { key: "like", icon: Heart },
    { key: "comment", icon: MessageCircle },
    { key: "media", icon: Image },
];

const NotificationsPage = () => {
    const [notifications, setNotifications] = useState([]);
    const [activeTab, setActiveTab] = useState("all");
    const [loading, setLoading] = useState(true);

    const filtered =
        activeTab === "all"
            ? notifications
            : notifications.filter((notification) => notification.type === activeTab);

    return (
        <div className="min-h-screen bg-linear-to-b from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f] text-white
            p-4 relative overflow-y-hidden">

            {/* Header */}
            <div className="sm:ml-20 sticky top-0 z-20 backdrop-blur-lg bg-[#182034]/50 rounded-xl
                p-3 flex items-center gap-3 shadow-lg border border-purple-500/30 mb-6">
                <Bell className="w-6 h-6 text-white" />
                <h1 className="text-xl font-bold">Notifications</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 justify-center mb-6">
                {TABS.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.key
                    return (
                        <motion.div key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`cursor-pointer p-3 rounded-xl backdrop-blur-lg bg-[#182034]/30
                            border border-purple-500/20 flex items-center justify-center`}
                            whileHover={{ scale: 1.1 }}
                            animate={{ scale: isActive ? 1.15 : 1 }}
                        >
                            <Icon className={`w-6 h-6 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} />
                        </motion.div>
                    )
                })}
            </div>

            {/* Notifications List */}
            <div className="space-y-4 max-w-2xl mx-auto">
                {loading ? (
                    <p className="text-center text-gray-400">Loading...</p>
                ) : (
                    <AnimatePresence>
                        {filtered.map((n) => {
                            const user = n.from_user;
                            return (
                                <motion.div key={n._id} initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="relative flex items-start gap-4 p-4 rounded-2xl backdrop-blur-lg bg-[#182034]/40
                                    border border-purple-500/20 shadow-lg hover:shadow-[0_0_20px_rgba(255,0,255,0.3)] transition-all"
                                >
                                    {/* Profile Picture */}
                                    <motion.img src={user.profile_picture}
                                        alt={user.full_name}
                                        className="w-12 h-12 rounded-full border border-purple-400 shadow-none" />

                                    {/* Content and Timestamp */}
                                    <div className="flex-1">
                                        <p className="text-white text-sm">
                                            <span className="font-semibold">{user.full_name}</span>
                                            {n.type === "like" && " liked your post."}
                                            {n.type === "comment" && " commented on your post."}
                                            {n.type === "media" && " shared a post."}
                                        </p>
                                        {n.type === "comment" && (
                                            <div className="mt-12 p-2 rounded-lg bg-[#1f264f]/60 border border-purple-500/20
                                            text-gray-200 text-sm">
                                                {n.commentText}
                                            </div>
                                        )}
                                        <span className="text-gray-400 text-xs">
                                            {moment(n.createdAt).fromNow()}
                                        </span>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    )
};

export default NotificationsPage;