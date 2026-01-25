/**
 * ReactionDetailsModal Component
 * ------------------------------------------------------------------
 * A modal to display users who reacted to a specific message.
 * Features categorized tabs for each emoji type and smooth animations.
 * Optimized with useMemo and React.memo to prevent unnecessary re-renders.
 */

import { useState, useMemo, memo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import UserAvatar from "../common/UserDefaultAvatar";

const ReactionDetailsModal = ({ isOpen, onClose, message }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("All");

    // Reset tab when modal closes or message changes
    useEffect(() => {
        if (isOpen) setActiveTab("All");
    }, [isOpen, message?._id]);

    // 1. Extract Unique Emojis (Memoized)
    // Only recalculate if reactions change
    const uniqueEmojis = useMemo(() => {
        if (!message?.reactions?.length) return [];

        // Extract distinct emojis
        const emojis = [...new Set(message.reactions.map(r => r.emoji))];
        return ["All", ...emojis];
    }, [message?.reactions]);

    // 2. Filter Reactions List (Memoized)
    const filteredReactions = useMemo(() => {
        if (!message?.reactions) return [];
        if (activeTab === "All") return message.reactions;
        return message.reactions.filter(r => r.emoji === activeTab);
    }, [message?.reactions, activeTab]);

    // Early return if not open (Prevents rendering logic when closed)
    if (!isOpen || !message) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop (Click to close) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }} // Faster animation
                        className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl border border-adaptive overflow-hidden relative z-10 flex flex-col max-h-[70vh]"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-adaptive flex items-center justify-between bg-surface/95 backdrop-blur-md sticky top-0 z-20">
                            <h3 className="font-bold text-content text-lg">
                                Reactions <span className="text-muted text-sm ml-1">({message.reactions.length})</span>
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-main rounded-full text-muted hover:text-content transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tabs (Horizontal Scroll) */}
                        <div className="px-4 py-3 border-b border-adaptive flex gap-2 overflow-x-auto scrollbar-hide bg-surface">
                            {uniqueEmojis.map((emoji) => (
                                <button
                                    key={emoji}
                                    onClick={() => setActiveTab(emoji)}
                                    className={`
                                        px-4 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap border shrink-0
                                        ${activeTab === emoji
                                            ? "bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105"
                                            : "bg-main text-muted border-transparent hover:bg-main/80 hover:text-content"
                                        }
                                    `}
                                >
                                    {emoji === "All" ? "All" : emoji}
                                </button>
                            ))}
                        </div>

                        {/* Users List */}
                        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide bg-main/50">
                            {filteredReactions.length > 0 ? (
                                <div className="space-y-1">
                                    {filteredReactions.map((reaction, idx) => (
                                        <motion.div
                                            key={`${reaction.user?._id || idx}-${reaction.emoji}`}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }} // Staggered animation
                                            onClick={() => {
                                                onClose();
                                                navigate(`/profile/${reaction.user?._id || reaction.user}`);
                                            }}
                                            className="flex items-center justify-between p-3 hover:bg-surface rounded-xl cursor-pointer group transition-all active:scale-[0.98]"
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* User Avatar with Emoji Badge */}
                                                <div className="relative">
                                                    <UserAvatar user={reaction.user} className="w-10 h-10 rounded-full ring-2 ring-transparent group-hover:ring-adaptive transition-all" />
                                                    <span className="absolute -bottom-1 -right-1 text-sm bg-surface rounded-full border border-adaptive w-5 h-5 flex items-center justify-center shadow-sm">
                                                        {reaction.emoji}
                                                    </span>
                                                </div>

                                                {/* User Info */}
                                                <div>
                                                    <p className="font-bold text-content text-sm leading-tight group-hover:text-primary transition-colors">
                                                        {reaction.user?.full_name || "Unknown User"}
                                                    </p>
                                                    <p className="text-xs text-muted">@{reaction.user?.username || "username"}</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-muted gap-2">
                                    <span className="text-4xl grayscale opacity-50">😶</span>
                                    <p className="text-sm">No reactions found</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// Memoize to prevent re-renders when parent updates unrelated state
export default memo(ReactionDetailsModal);