import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, MessageSquare, Search, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next"; // 🟢

// --- Local Imports ---
import UserAvatar from "../components/common/UserDefaultAvatar";
import { fetchMyConnections } from "../features/connectionsSlice";
import { useSocketContext } from "../context/SocketContext";

// --- Sub-Components ---
const MessagesSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface border border-adaptive rounded-2xl p-4 flex items-center gap-4">
                <div className="w-14 h-14 bg-main rounded-full shrink-0 animate-pulse" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-main rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-main rounded w-1/2 animate-pulse" />
                </div>
            </div>
        ))}
    </div>
);

const ConnectionCard = memo(({ user, index, isOnline, onNavigate, onViewProfile, t }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ delay: index * 0.05 }}
        onClick={() => onNavigate(user._id)}
        className="group relative bg-surface hover:bg-surface/80 border border-adaptive hover:border-primary/40 rounded-2xl p-4 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
    >
        <div className="flex items-center gap-4">
            <div className="relative shrink-0">
                <UserAvatar
                    user={user}
                    className="w-14 h-14 rounded-full object-cover transition-all duration-300 ring-2 ring-transparent group-hover:ring-offset-2 group-hover:ring-offset-surface"
                />
                {isOnline && (
                    <span className="absolute bottom-2.5 end-0 z-10 w-3 h-3 bg-green-500 border-2 border-surface rounded-full"></span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-content truncate group-hover:text-primary transition-colors">
                    {user.full_name}
                </h3>
                <p className="text-xs text-muted truncate">@{user.username}</p>
            </div>

            <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); onViewProfile(user._id); }}
                    className="p-2 bg-main hover:bg-primary/10 rounded-full text-muted hover:text-primary transition-colors"
                    title={t("connectionsChats.viewProfile")} // 🟢 Updated Key
                >
                    <Eye size={16} />
                </button>
            </div>
        </div>
    </motion.div>
));

const EmptyState = ({ searchTerm, onFindFriends, t }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 text-center"
    >
        <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mb-4 shadow-sm border border-adaptive group hover:border-primary/50 transition-colors">
            {searchTerm ?
                <Search size={32} className="text-muted group-hover:text-primary transition-colors" /> :
                <MessageSquare size={32} className="text-muted group-hover:text-primary transition-colors" />
            }
        </div>
        <h3 className="text-xl font-bold text-content mb-2">
            {searchTerm ? t("connectionsChats.noFriendsFound") : t("connectionsChats.noConversations")} {/* 🟢 Updated Key */}
        </h3>
        <p className="text-muted text-sm max-w-xs mb-6">
            {searchTerm ? t("connectionsChats.notFoundMsg", { query: searchTerm }) : t("connectionsChats.connectMsg")} {/* 🟢 Updated Key */}
        </p>

        {!searchTerm && (
            <button
                onClick={onFindFriends}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:opacity-90 text-white rounded-xl font-medium transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
            >
                <UserPlus size={18} />
                {t("connectionsChats.findFriends")} {/* 🟢 Updated Key */}
            </button>
        )}
    </motion.div>
);

const Messages = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { onlineUsers } = useSocketContext();
    const { t } = useTranslation(); // 🟢

    const { connections, isLoading } = useSelector((state) => state.connections || {});
    const safeConnections = connections || [];

    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        let isMounted = true;
        const loadConnections = async () => {
            const token = await getToken();
            if (isMounted) dispatch(fetchMyConnections(token));
        };
        loadConnections();
        return () => { isMounted = false; };
    }, [dispatch, getToken]);

    const filteredConnections = useMemo(() => {
        if (!searchTerm) return safeConnections;
        const lowerTerm = searchTerm.toLowerCase();
        return safeConnections.filter((user) =>
            user.full_name.toLowerCase().includes(lowerTerm) ||
            user.username.toLowerCase().includes(lowerTerm)
        );
    }, [safeConnections, searchTerm]);

    const handleNavigateToChat = useCallback((userId) => {
        navigate(`/messages/${userId}`);
    }, [navigate]);

    const handleNavigateToProfile = useCallback((userId) => {
        navigate(`/profile/${userId}`);
    }, [navigate]);

    const handleFindFriends = useCallback(() => {
        navigate('/search');
    }, [navigate]);

    return (
        <div className="min-h-screen relative bg-main text-content overflow-hidden pb-20 transition-colors duration-300">
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-40 dark:opacity-60">
                <div className="absolute w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -top-20 -start-20 animate-pulse"></div>
                <div className="absolute w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] bottom-0 end-0 animate-pulse delay-1000"></div>
            </div>

            <div className="relative max-w-5xl mx-auto px-4 py-8 md:px-8">
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 mb-10">
                    <div className="w-full md:w-auto text-start">
                        {/* 🟢 Updated Keys */}
                        <h1 className="text-3xl md:text-4xl font-extrabold text-content mb-2">
                            {t("connectionsChats.title")}
                        </h1>
                        <p className="text-muted text-sm">
                            {t("connectionsChats.subtitle")}
                        </p>
                    </div>

                    <div className="relative w-full md:w-72 group z-10">
                        <div className="relative flex items-center bg-surface rounded-xl p-1 border border-adaptive focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300 shadow-sm">
                            <div className="ps-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-muted group-focus-within:text-primary transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder={t("connectionsChats.searchPlaceholder")} // 🟢 Updated Key
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full ps-2 pe-4 py-2 bg-transparent text-sm text-content placeholder-muted focus:outline-none border-none outline-none ring-0"
                            />
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <MessagesSkeleton />
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredConnections.length > 0 ? (
                            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredConnections.map((user, index) => (
                                    <ConnectionCard
                                        key={user._id}
                                        user={user}
                                        index={index}
                                        isOnline={onlineUsers.includes(user?._id)}
                                        onNavigate={handleNavigateToChat}
                                        onViewProfile={handleNavigateToProfile}
                                        t={t}
                                    />
                                ))}
                            </motion.div>
                        ) : (
                            <EmptyState searchTerm={searchTerm} onFindFriends={handleFindFriends} t={t} />
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

export default Messages;