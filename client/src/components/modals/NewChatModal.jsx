/**
 * NewChatModal Component
 * ------------------------------------------------------------------
 * Modal for starting a new private conversation.
 * Lists available connections/friends with search functionality.
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢

// Icons
import { X, Search, UserPlus, MessageSquare } from "lucide-react";

// Components
import UserAvatar from "../common/UserDefaultAvatar";

const NewChatModal = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { t } = useTranslation(); // 🟢
    const [searchQuery, setSearchQuery] = useState("");
    const { connections } = useSelector((state) => state.connections || { connections: [] });

    // Filter Logic (Memoized for performance)
    const filteredUsers = useMemo(() => {
        if (!connections) return [];
        return connections.filter(user => {
            if (!user || !user._id) return false;
            const query = searchQuery.toLowerCase();
            return (
                user.full_name?.toLowerCase().includes(query) ||
                user.username?.toLowerCase().includes(query)
            );
        });
    }, [connections, searchQuery]);

    const handleStartChat = (id) => {
        onClose();
        navigate(`/messages/${id}`);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="bg-main w-full max-w-md rounded-3xl shadow-2xl border border-adaptive overflow-hidden flex flex-col max-h-[80vh] relative z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-adaptive flex items-center justify-between bg-surface/50">
                            <h2 className="text-lg font-bold text-content flex items-center gap-2">
                                <UserPlus size={20} className="text-primary" />
                                {t("newChat.title")} {/* 🟢 */}
                            </h2>
                            <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition text-muted hover:text-red-500">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 pb-2">
                            <div className="relative group">
                                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" /> {/* 🔵 start-3 */}
                                <input
                                    type="text"
                                    placeholder={t("newChat.searchPlaceholder")} // 🟢
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-surface border border-adaptive rounded-xl py-2.5 ps-10 pe-4 text-sm text-content focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all placeholder-muted" // 🔵 ps-10 pe-4
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Users List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <div
                                        key={user._id}
                                        onClick={() => handleStartChat(user._id)}
                                        className="flex items-center gap-3 p-3 rounded-2xl hover:bg-surface transition-colors cursor-pointer group"
                                    >
                                        <UserAvatar user={user} className="w-12 h-12 rounded-full border border-adaptive" />
                                        <div className="flex-1 min-w-0 text-start"> {/* 🔵 text-start */}
                                            <h4 className="font-bold text-sm text-content truncate group-hover:text-primary transition-colors">
                                                {user.full_name}
                                            </h4>
                                            <p className="text-xs text-muted truncate">@{user.username}</p>
                                        </div>
                                        <button className="p-2 bg-primary/10 text-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100 rtl:scale-x-[-1]"> {/* 🔵 RTL flip icon */}
                                            <MessageSquare size={18} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center text-muted">
                                    <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-3">
                                        <Search size={32} className="opacity-50" />
                                    </div>
                                    <p className="text-sm">{t("newChat.noUsers")}</p> {/* 🟢 */}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default NewChatModal;