/**
 * MessageItem Component
 * ------------------------------------------------------------------
 * Renders a single chat message bubble with optimization logic.
 * Uses a custom memo comparison to prevent re-rendering unrelated messages
 * when the reaction menu is toggled.
 */

import { memo, useState } from "react";
import { Reply, Smile, Clock, Check, CheckCheck, Play, Pause, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import VoiceMessage from "../chat/VoiceMessage";
import SharedPostCard from "../feed/SharedPostCard";
import UserAvatar from "../common/UserDefaultAvatar";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const MessageItem = ({
    msg,
    userId,
    activeReactionId,
    setActiveReactionId,
    handleReaction,
    setReplyTo,
    setViewReactionMessage,
    scrollToMessage,
    highlightedId,
    readStatus
}) => {

    const [showMobileActions, setShowMobileActions] = useState(false);

    // 1. Handle System Messages
    if (msg.message_type === "system") {
        return (
            <div className="flex justify-center my-4 w-full">
                <span className="bg-surface/80 border border-adaptive text-muted text-[10px] md:text-xs px-3 py-1 rounded-full shadow-sm backdrop-blur-sm text-center select-none">
                    {msg.text}
                </span>
            </div>
        );
    }

    // 2. Identify Sender
    const senderId = msg.sender?._id || msg.sender;
    const isMe = String(senderId) === String(userId) || msg.sender?.clerkId === userId;
    const isHighlighted = highlightedId === msg._id;
    const isSending = msg.isSending;
    const showReactionMenu = activeReactionId === msg._id;

    // Helper: Render Links
    const renderWithLinks = (text) => {
        if (!text) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.split(urlRegex).map((part, index) =>
            part.match(urlRegex) ? (
                <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all font-medium" onClick={(e) => e.stopPropagation()}>
                    {part}
                </a>
            ) : part
        );
    };

    return (
        <div
            className={`flex items-end gap-2 transition-colors duration-500 p-2 rounded-xl relative z-10 
            ${isMe ? "flex-row-reverse" : "flex-row"} 
            ${isSending ? "opacity-70" : "opacity-100"} 
            ${isHighlighted ? "bg-primary/10" : ""}
            mb-4 md:mb-0`}
        >
            {/* Avatar */}
            {!isMe && (
                <UserAvatar
                    user={msg.sender}
                    className="w-8 h-8 rounded-full object-cover mb-1 border border-adaptive shadow-sm"
                />
            )}

            <div className={`flex flex-col max-w-[75%] md:max-w-[60%] ${isMe ? "items-end" : "items-start"}`}>

                {/* Sender Name (Group Only) */}
                {!isMe && <span className="text-[10px] text-muted ml-1 mb-1 font-medium">{msg.sender?.full_name}</span>}

                <div className="relative group w-full">

                    {/* 👇 Action Buttons (Reply & React) */}
                    <div className={`absolute top-2 ${isMe ? "-left-16" : "-right-16"} md:opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 z-20`}>
                        {/* Reply Button */}
                        <button
                            onClick={() => setReplyTo(msg)}
                            className="p-1.5 text-muted hover:text-primary bg-surface/80 hover:bg-surface rounded-full transition backdrop-blur-sm shadow-sm"
                        >
                            <Reply size={14} />
                        </button>

                        {/* Reaction Trigger Button */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Toggle logic handled by parent via callback
                                    setActiveReactionId(msg._id);
                                }}
                                className={`p-1.5 rounded-full transition backdrop-blur-sm shadow-sm ${showReactionMenu ? "text-yellow-500 bg-surface" : "text-muted hover:text-yellow-500 bg-surface/80 hover:bg-surface"}`}
                            >
                                <Smile size={14} />
                            </button>

                            {/* 👇 Reaction Menu Popup (Optimized Animation) */}
                            <AnimatePresence>
                                {showReactionMenu && (
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0, y: 10 }}
                                        animate={{ scale: 1, opacity: 1, y: 0 }}
                                        exit={{ scale: 0.8, opacity: 0, y: 10 }}
                                        transition={{ duration: 0.15, ease: "easeOut" }} // Super fast
                                        className={`absolute -top-12 ${isMe ? "right-0" : "left-0"} bg-surface border border-adaptive rounded-full shadow-xl p-1 flex items-center gap-1 z-50`}
                                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                                    >
                                        {REACTIONS.map((emoji) => (
                                            <button
                                                key={emoji}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();

                                                    handleReaction(msg._id, emoji);
                                                }}
                                                className="w-7 h-7 flex items-center justify-center text-lg hover:scale-125 transition-transform cursor-pointer hover:bg-main rounded-full active:scale-95"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* 👇 Message Bubble */}
                    <div className={`p-2.5 shadow-sm text-sm leading-relaxed wrap-break-word w-full flex flex-col gap-1 border transition-colors 
                        ${isMe ? "bg-primary text-white rounded-2xl rounded-br-none border-primary shadow-primary/20"
                            : "bg-surface text-content rounded-2xl rounded-bl-none border-adaptive"}`}>

                        {/* Reply Preview inside Bubble */}
                        {msg.replyTo && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation()
                                    const targetId = msg.replyTo._id || msg.replyTo;
                                    scrollToMessage(String(targetId));
                                }}
                                className={`w-full p-2 rounded-lg mb-1 text-xs border-l-[3px] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition flex flex-col ${isMe ? "bg-white/20 border-white/50" : "bg-main border-primary"}`}
                            >
                                <span className={`font-bold mb-0.5 block ${isMe ? "text-white" : "text-primary"}`}>
                                    {msg.replyTo.sender?.full_name || "User"}
                                </span>
                                <span className="truncate opacity-80 block">
                                    {msg.replyTo.message_type === 'image' ? '📷 Photo' : msg.replyTo.message_type === 'audio' ? '🎤 Voice Message' : msg.replyTo.text}
                                </span>
                            </div>
                        )}

                        {/* Story Reply Preview */}
                        {msg.replyToStoryId && (
                            <div className={`flex items-center gap-2 p-1.5 rounded-lg mb-1.5 border-l-[3px] select-none transition ${isMe ? "bg-white/20 border-white/50" : "bg-black/5 dark:bg-white/5 border-primary"}`}>
                                <div className="h-12 w-9 shrink-0 rounded overflow-hidden bg-black border border-white/10 relative">
                                    {(msg.replyToStoryId.type === 'video' || msg.replyToStoryId.mediaUrl?.endsWith('.mp4')) ? (
                                        <video src={msg.replyToStoryId.mediaUrl} className="h-full w-full object-cover opacity-80" muted />
                                    ) : msg.replyToStoryId.type === 'text' ? (
                                        <div className="h-full w-full flex items-center justify-center p-0.5 text-[6px] text-center text-white/80 overflow-hidden leading-tight" style={{ background: msg.replyToStoryId.background_color || '#333' }}>
                                            {msg.replyToStoryId.content?.slice(0, 10)}
                                        </div>
                                    ) : (
                                        <img src={msg.replyToStoryId.image || msg.replyToStoryId.mediaUrl || "/avatar-placeholder.png"} className="h-full w-full object-cover" alt="story" onError={(e) => { e.target.style.display = 'none' }} />
                                    )}
                                    {msg.replyToStoryId.type !== 'text' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                            <div className="w-3 h-3 rounded-full border-[1.5px] border-white/80"></div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                    <span className={`text-[10px] font-bold mb-0.5 ${isMe ? "text-white/90" : "text-primary"}`}>Replied to story</span>
                                    <span className={`text-[10px] truncate w-32 ${isMe ? "text-white/70" : "text-muted"}`}>{msg.replyToStoryId.content || "Media content"}</span>
                                </div>
                            </div>
                        )}

                        {/* Media Content */}
                        {msg.message_type === "image" && msg.media_url && (
                            <img src={msg.media_url} alt="sent" className="rounded-xl w-full max-w-[280px] h-auto mb-1 border border-black/10 dark:border-white/10 object-cover shadow-sm" />
                        )}
                        {msg.message_type === "audio" && msg.media_url && (
                            <VoiceMessage src={msg.media_url} isMe={isMe} />
                        )}
                        {msg.message_type === "shared_post" && msg.sharedPostId && (
                            <div className="mt-1"><SharedPostCard postId={msg.sharedPostId} /></div>
                        )}

                        {/* Text Content */}
                        {msg.text && (
                            <p dir="auto" className="px-1 whitespace-pre-wrap">
                                {msg.message_type === "shared_post" ? renderWithLinks(msg.text.replace(/https?:\/\/[^\s]+/, "").trim()) : renderWithLinks(msg.text)}
                            </p>
                        )}

                        {/* Footer (Time & Checks) */}
                        <div className={`text-[10px] mt-0.5 flex items-center justify-end gap-1 ${isMe ? "text-white/70" : "text-muted"}`}>
                            {format(new Date(msg.createdAt || Date.now()), "hh:mm a")}
                            {isMe && (
                                <div className="ml-1 flex items-center">
                                    {msg.isSending ? (
                                        <Clock size={12} className="animate-pulse opacity-70" />
                                    ) : readStatus === "read" ? (
                                        <CheckCheck size={16} className="text-white drop-shadow-sm font-bold" strokeWidth={3} />
                                    ) : readStatus === "delivered" ? (
                                        <CheckCheck size={16} className="text-white/60" strokeWidth={2.5} />
                                    ) : (
                                        <Check size={16} className="text-white/60" strokeWidth={2.5} />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Existing Reactions Bar */}
                    {msg.reactions && msg.reactions.length > 0 && (
                        <div
                            onClick={(e) => { e.stopPropagation(); setViewReactionMessage(msg); }}
                            className={`absolute -bottom-3 ${isMe ? "left-2" : "right-2"} flex items-center gap-0.5 bg-surface border border-adaptive rounded-full px-1.5 py-0.5 shadow-sm text-[10px] cursor-pointer hover:scale-105 transition z-10 select-none`}
                        >
                            {[...new Set(msg.reactions.map(r => r.emoji))].slice(0, 3).map((e, i) => (
                                <span key={i} className="animate-in fade-in zoom-in duration-200">
                                    {e}
                                </span>
                            ))}

                            {msg.reactions.length > 1 && (
                                <span className="text-muted font-bold ml-0.5 text-[9px]">
                                    {msg.reactions.length}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// 👇👇👇 SUPER OPTIMIZATION (Custom Comparator) 👇👇👇
const arePropsEqual = (prevProps, nextProps) => {
    const isMsgSame =
        prevProps.msg === nextProps.msg &&
        prevProps.readStatus === nextProps.readStatus &&
        prevProps.highlightedId === nextProps.highlightedId &&
        prevProps.scrollToMessage === nextProps.scrollToMessage;

    const wasActive = prevProps.activeReactionId === prevProps.msg._id;
    const isActive = nextProps.activeReactionId === nextProps.msg._id;

    return isMsgSame && (wasActive === isActive);
};

export default memo(MessageItem, arePropsEqual);