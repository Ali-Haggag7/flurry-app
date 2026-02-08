/**
 * RecentMessages Component
 * ------------------------------------------------------------------
 * Displays a list of active conversations with real-time updates via Socket.IO.
 * Features search, unread counts, typing indicators (future), and blocked status handling.
 * Optimized with memoized list items to handle frequent updates efficiently.
 */

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { formatDistanceToNowStrict } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢
import { ar, enUS } from "date-fns/locale"; // 🟢

// Icons
import { MessageSquare, Search, Edit, Ban } from "lucide-react";

// API & Context
import api from "../../lib/axios";
import { useSocketContext } from "../../context/SocketContext";

// Components
import UserAvatar from "../common/UserDefaultAvatar";
import NewChatModal from "../modals/NewChatModal";

// --- Sub-Components (Memoized) ---

// 1. Single Chat Item
const ChatItem = memo(({ chat, isActive, isOnline, currentUser, t, currentLocale }) => { // 🟢 Receive t & locale
    const otherUser = chat.partner;
    const lastMsg = chat.lastMessage;
    const isMe = lastMsg?.sender === currentUser?._id || lastMsg?.sender?._id === currentUser?._id;
    const unreadCount = chat.unreadCount || 0;
    const isUnread = unreadCount > 0;

    const isBlockedByMe = chat.isBlockedByMe;
    const isBlockedByPartner = chat.isBlockedByPartner;
    const isConnectionSevered = isBlockedByMe || isBlockedByPartner;

    // Determine preview text
    const getPreviewText = () => {
        if (isBlockedByMe) return <span className="text-red-400 italic flex items-center gap-1"><Ban size={10} /> {t("messages.blockedByMe")}</span>; // 🟢
        if (isBlockedByPartner) return <span className="text-muted italic flex items-center gap-1">{t("messages.userUnavailable")}</span>; // 🟢

        return (
            <>
                {isMe && <span className="text-xs opacity-70 font-normal">{t("messages.you")}: </span>} {/* 🟢 */}
                {lastMsg?.message_type === "image" ? t("messages.photo") : // 🟢
                    lastMsg?.message_type === "audio" ? t("messages.voice") : // 🟢
                        lastMsg?.message_type === "story_reply" ? t("messages.storyReply") : // 🟢
                            lastMsg?.message_type === "shared_post" ? t("messages.sharedPost") : // 🟢
                                lastMsg?.text || t("messages.noMessages")} {/* 🟢 */}
            </>
        );
    };

    return (
        <Link to={`/messages/${otherUser?._id}`} className="block">
            <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-all duration-200 group border cursor-pointer
                    ${isActive
                        ? "bg-primary/10 border-primary/20 shadow-inner"
                        : isUnread
                            ? "bg-main border-s-4 border-s-primary shadow-sm" // 🔵 border-s-4 works for RTL
                            : "border-transparent hover:bg-main hover:border-black/5 dark:hover:border-white/5"
                    }`}
            >
                {/* Avatar Section */}
                <div className="relative shrink-0">
                    <UserAvatar
                        user={otherUser}
                        className={`w-11 h-11 rounded-full border-2 transition-all object-cover
                            ${isActive || isUnread ? "border-primary" : "border-surface group-hover:border-primary/30"}
                            ${isConnectionSevered ? "grayscale opacity-70" : ""} 
                        `}
                    />
                    {isOnline && !isConnectionSevered && (
                        <span className="absolute bottom-1.5 end-0 z-10 w-3 h-3 bg-green-500 border-2 border-surface rounded-full shadow-sm"></span>
                    )}
                    {isBlockedByMe && (
                        <span className="absolute bottom-0 end-0 z-10 p-0.5 bg-surface rounded-full border border-adaptive">
                            <Ban size={12} className="text-red-500" />
                        </span>
                    )}
                </div>

                {/* Chat Details */}
                <div className="flex-1 min-h-0">
                    <div className="flex justify-between items-center mb-0.5">
                        <span className={`truncate text-sm transition-colors ${isActive || isUnread ? "text-content font-bold" : "text-content/80 font-semibold group-hover:text-content"}`}>
                            {otherUser?.full_name || t("stories.defaultUser")} {/* 🟢 */}
                        </span>
                        <span className={`text-[10px] ${isActive || isUnread ? "text-primary font-bold" : "text-muted group-hover:text-muted/80"}`}>
                            {lastMsg?.createdAt ? formatDistanceToNowStrict(new Date(lastMsg.createdAt), { locale: currentLocale }) : ""} {/* 🟢 Localized time */}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <p className={`text-xs truncate max-w-[140px] flex items-center gap-1.5 ${isActive ? "text-primary/80" : isUnread ? "text-content font-medium" : "text-muted group-hover:text-muted/80"}`}>
                            {getPreviewText()}
                        </p>
                        {unreadCount > 0 && !isConnectionSevered && (
                            <div className="w-5 h-5 bg-primary text-white text-[10px] flex items-center justify-center rounded-full shadow-lg shadow-primary/40 animate-pulse ms-2 font-bold">
                                {unreadCount}
                            </div>
                        )}
                    </div>
                </div>

                {isActive && (
                    <div className="absolute start-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-primary rounded-e-full shadow-[0_0_10px_var(--color-primary)]"></div>
                )}
            </motion.div>
        </Link>
    );
});

// --- Main Component ---

const RecentMessages = () => {
    // --- State ---
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

    // --- Hooks ---
    const { getToken } = useAuth();
    const { currentUser } = useSelector((state) => state.user);
    const location = useLocation();
    const { onlineUsers, socket } = useSocketContext();
    const { t, i18n } = useTranslation(); // 🟢
    const currentLocale = i18n.language === 'ar' ? ar : enUS; // 🟢

    // --- Actions ---

    const markChatAsRead = useCallback(async (partnerId) => {
        // Optimistic Update
        setConversations(prev => prev.map(chat => {
            if (chat.partner._id === partnerId) {
                if (chat.unreadCount === 0) return chat; // Avoid unnecessary updates
                return {
                    ...chat,
                    unreadCount: 0,
                    lastMessage: { ...chat.lastMessage, read: true }
                };
            }
            return chat;
        }));

        try {
            const token = await getToken();
            await api.put(`/message/read/${partnerId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
            console.error("Failed to mark as read", error);
        }
    }, [getToken]);

    const fetchConversations = useCallback(async () => {
        try {
            const token = await getToken();
            const { data } = await api.get("/message/recent", { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) setConversations(data.conversations);
        } catch (error) {
            console.error("Chat Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    // --- Effects ---

    // 1. Initial Fetch & Polling
    useEffect(() => {
        if (!currentUser) return;
        fetchConversations();

        // Poll every 10s as a fallback for socket issues
        const intervalId = setInterval(fetchConversations, 10000);
        return () => clearInterval(intervalId);
    }, [currentUser, fetchConversations]);

    // 2. Socket: Handle New Messages
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (newMessage) => {
            setConversations((prevChats) => {
                const partnerId = newMessage.sender._id || newMessage.sender === currentUser._id
                    ? newMessage.receiver._id || newMessage.receiver
                    : newMessage.sender._id || newMessage.sender;

                const existingChatIndex = prevChats.findIndex(chat => chat.partner._id === partnerId);
                let updatedChats = [...prevChats];

                if (existingChatIndex !== -1) {
                    // Update existing chat
                    const chatToMove = { ...updatedChats[existingChatIndex] };
                    chatToMove.lastMessage = newMessage;

                    // Increment unread count if message is not from me
                    const isFromMe = newMessage.sender === currentUser._id || newMessage.sender?._id === currentUser._id;
                    if (!isFromMe) {
                        chatToMove.unreadCount = (chatToMove.unreadCount || 0) + 1;
                    }

                    updatedChats.splice(existingChatIndex, 1);
                    updatedChats.unshift(chatToMove);
                } else {
                    // New chat: Re-fetch to get full partner details
                    fetchConversations();
                }
                return updatedChats;
            });
        };

        socket.on("receiveMessage", handleNewMessage);
        return () => socket.off("receiveMessage", handleNewMessage);
    }, [socket, currentUser, fetchConversations]);

    // 3. Mark as Read on Route Change
    useEffect(() => {
        if (location.pathname.startsWith('/messages/')) {
            const pathParts = location.pathname.split('/');
            const currentChatId = pathParts[pathParts.length - 1];

            if (currentChatId && conversations.length > 0) {
                const targetChat = conversations.find(c => c.partner?._id === currentChatId);
                // Only mark read if there are unread messages
                if (targetChat && targetChat.unreadCount > 0) {
                    markChatAsRead(currentChatId);
                }
            }
        }
    }, [location.pathname, conversations, markChatAsRead]);

    // --- Derived State ---

    const totalUnreadCount = useMemo(() => {
        return conversations.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);
    }, [conversations]);

    const filteredConversations = useMemo(() => {
        return conversations.filter(chat =>
            chat.partner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.partner?.username?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [conversations, searchQuery]);

    // --- Render ---

    return (
        <motion.div
            className="w-full flex flex-col text-sm bg-surface/60 backdrop-blur-xl rounded-2xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden h-full scrollbar-hide"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
        >
            {/* Header */}
            <div className="p-4 border-b border-black/5 dark:border-white/5 bg-surface/80 backdrop-blur-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-content flex items-center gap-2">
                        {t("messages.title")} {/* 🟢 */}
                        {totalUnreadCount > 0 && (
                            <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-medium animate-pulse">
                                {totalUnreadCount}
                            </span>
                        )}
                    </h3>
                    <button
                        onClick={() => setIsNewChatModalOpen(true)}
                        className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-full transition-all active:scale-95"
                        title={t("messages.newChat")} // 🟢
                    >
                        <Edit size={16} />
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                        type="text"
                        placeholder={t("messages.searchPlaceholder")} // 🟢
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-main border border-black/5 dark:border-white/10 rounded-xl py-2 ps-9 pe-3 text-xs text-content focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder-muted"
                    />
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {loading ? (
                    [1, 2, 3].map((n) => (
                        <div key={n} className="flex items-center gap-3 p-3 rounded-2xl animate-pulse">
                            <div className="w-10 h-10 bg-main rounded-full shrink-0"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-3 bg-main rounded w-1/2"></div>
                                <div className="h-2 bg-main rounded w-3/4"></div>
                            </div>
                        </div>
                    ))
                ) : filteredConversations.length > 0 ? (
                    <AnimatePresence initial={false}>
                        {filteredConversations.map((chat) => (
                            <ChatItem
                                key={chat.partner?._id}
                                chat={chat}
                                currentUser={currentUser}
                                isActive={location.pathname.includes(`/messages/${chat.partner?._id}`)}
                                isOnline={onlineUsers.includes(chat.partner?._id)}
                                t={t} // 🟢 Pass t
                                currentLocale={currentLocale} // 🟢 Pass locale
                            />
                        ))}
                    </AnimatePresence>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-50">
                        <div className="w-16 h-16 bg-main rounded-full flex items-center justify-center mb-3">
                            <MessageSquare className="w-8 h-8 text-muted" />
                        </div>
                        <p className="text-sm font-medium text-muted">{t("messages.noChats")}</p> {/* 🟢 */}
                    </div>
                )}
            </div>

            <NewChatModal
                isOpen={isNewChatModalOpen}
                onClose={() => setIsNewChatModalOpen(false)}
            />
        </motion.div>
    );
};

export default RecentMessages;