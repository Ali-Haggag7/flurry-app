/**
 * ShareModal Component
 * ------------------------------------------------------------------
 * Modal for sharing a post with recent chats or external apps.
 * Features:
 * - Fetches recent conversations.
 * - Sends direct messages with embedded post link.
 * - Optimized rendering for chat list.
 */

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢

// Icons
import { X, Search, Send, Loader2, Check } from "lucide-react";

// API
import api from "../../lib/axios";

// Components
import UserAvatar from "../common/UserDefaultAvatar";

const ShareModal = ({ isOpen, onClose, post, onSuccess }) => {
    const { getToken } = useAuth();
    const { t } = useTranslation(); // 🟢
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch Recent Chats
    useEffect(() => {
        if (isOpen) {
            const fetchChats = async () => {
                try {
                    const token = await getToken();
                    const { data } = await api.get("/message/recent", {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (data.success && data.conversations) {
                        setChats(data.conversations);
                    }
                } catch (error) {
                    console.error("Error fetching chats", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchChats();
        }
    }, [isOpen, getToken]);

    // Filter Chats
    const filteredChats = useMemo(() => {
        return chats.filter(chat => {
            const partner = chat.partner;
            if (!partner) return false;
            return partner.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                partner.username?.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [chats, searchQuery]);

    const handleSendToChat = async () => {
        if (!selectedChatId) return;
        setSending(true);
        try {
            const token = await getToken();
            const postLink = `${window.location.origin}/post/${post._id}`;
            const messageText = `${t("share.checkOutMsg")} ${post.user?.full_name}:\n${postLink}`; // 🟢 Translated msg

            await api.post("/message/send", {
                receiverId: selectedChatId,
                text: messageText,
                sharedPostId: post._id
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success(t("share.success")); // 🟢
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error(t("share.error")); // 🟢
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-surface w-full max-w-md rounded-2xl border border-adaptive shadow-2xl overflow-hidden flex flex-col max-h-[80vh] relative z-10 transition-colors duration-300"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-adaptive flex justify-between items-center bg-main/50 backdrop-blur-md">
                        <h3 className="font-bold text-content text-lg">{t("share.title")}</h3> {/* 🟢 */}
                        <button onClick={onClose} className="p-2 hover:bg-main rounded-full transition text-muted hover:text-primary">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-4 bg-surface border-b border-adaptive">
                        <div className="relative group">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder={t("share.searchPlaceholder")} // 🟢
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-main border border-adaptive rounded-xl py-2.5 ps-10 pe-4 text-sm text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder-muted"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-surface">
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                        ) : filteredChats.length === 0 ? (
                            <div className="text-center py-10 flex flex-col items-center">
                                <div className="w-16 h-16 bg-main rounded-full flex items-center justify-center mb-3 border border-adaptive">
                                    <Send size={24} className="text-muted opacity-50 rtl:rotate-180" /> {/* 🟢 RTL Icon */}
                                </div>
                                <p className="text-muted font-medium">{t("share.noChats")}</p> {/* 🟢 */}
                            </div>
                        ) : (
                            filteredChats.map((chat) => {
                                const partner = chat.partner;
                                if (!partner) return null;
                                const isSelected = selectedChatId === partner._id;

                                return (
                                    <div
                                        key={partner._id}
                                        onClick={() => setSelectedChatId(partner._id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border
                                        ${isSelected
                                                ? "bg-primary/10 border-primary/50 shadow-sm"
                                                : "hover:bg-main border-transparent"
                                            }`}
                                    >
                                        <div className="relative">
                                            <UserAvatar
                                                user={partner}
                                                className={`w-10 h-10 rounded-full border ${isSelected ? "border-primary" : "border-adaptive"}`}
                                            />
                                            {isSelected && (
                                                <div className="absolute -bottom-1 -end-1 bg-primary rounded-full p-1 border-2 border-surface animate-in zoom-in duration-200">
                                                    <Check size={10} className="text-white" strokeWidth={4} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 text-start"> {/* 🔵 text-start */}
                                            <h4 className={`font-bold text-sm truncate transition-colors ${isSelected ? "text-primary" : "text-content"}`}>
                                                {partner.full_name || t("stories.defaultUser")} {/* 🟢 */}
                                            </h4>
                                            <p className="text-xs text-muted truncate">@{partner.username}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer Action */}
                    <div className="p-4 border-t border-adaptive bg-main/30 backdrop-blur-md">
                        <button
                            onClick={handleSendToChat}
                            disabled={!selectedChatId || sending}
                            className="w-full bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95"
                        >
                            {sending ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} className="rtl:rotate-180" /> {t("share.sendBtn")}</>} {/* 🟢 */}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ShareModal;