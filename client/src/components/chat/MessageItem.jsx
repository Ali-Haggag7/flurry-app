/**
 * MessageItem Component - Enhanced & Mobile Friendly 📱
 * ---------------------------------------------------
 * Renders a single chat bubble with support for:
 * - Text, Images, Voice Notes 📷 🎤
 * - Shared Posts & Stories (Re-integrated) 🔗
 * - Polls 📊
 * - Smart Toggles for Mobile/Desktop Interactions
 * - Optimized Rendering with React.memo
 */

import React, { memo, useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
    Reply,
    Smile,
    Clock,
    Check,
    CheckCheck,
    MoreVertical,
    Edit2,
    Trash2
} from "lucide-react";

// --- Local Imports ---
import VoiceMessage from "../chat/VoiceMessage";
import SharedPostCard from "../feed/SharedPostCard";
import UserAvatar from "../common/UserDefaultAvatar";
import PollMessage from "./PollMessage";

// --- Constants ---
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🙏"];

// --- Helper Functions ---
const renderWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) =>
        part.match(urlRegex) ? (
            <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all font-medium transition-colors"
                onClick={(e) => e.stopPropagation()}
            >
                {part}
            </a>
        ) : part
    );
};

// --- Sub-Components (Memoized) ---

const SystemMessage = memo(({ text }) => (
    <div className="flex justify-center my-4 w-full">
        <span className="bg-surface/50 border border-adaptive/50 text-muted text-[10px] px-3 py-1 rounded-full shadow-sm backdrop-blur-sm select-none">
            {text}
        </span>
    </div>
));

const ReactionPicker = memo(({ isMe, onSelect, onClose }) => (
    <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: -50 }}
        exit={{ scale: 0.5, opacity: 0, y: 10 }}
        className={`absolute ${isMe ? "end-0" : "start-0"} top-1/2 -translate-y-1/2 bg-surface/95 backdrop-blur-xl border border-adaptive/50 rounded-full p-1.5 flex items-center gap-1 shadow-2xl z-50 whitespace-nowrap`}
        onClick={(e) => e.stopPropagation()}
    >
        {REACTIONS.map((emoji) => (
            <button
                key={emoji}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(emoji);
                }}
                className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 transition-transform cursor-pointer rounded-full active:scale-95 hover:bg-white/10"
            >
                {emoji}
            </button>
        ))}
    </motion.div>
));

const MessageActionMenu = memo(({
    isMe,
    isDeleted,
    isSending,
    showMobileMenu,
    onReply,
    onReact,
    onToggleMenu,
    showMenu,
    onEdit,
    onDelete,
    msg,
    t
}) => {
    if (isDeleted || isSending) return null;

    return (
        <div className={`
            absolute flex items-center gap-1 bg-surface/95 backdrop-blur-md border border-adaptive rounded-full p-1 shadow-lg z-20 transition-all duration-200
            top-1/2 -translate-y-1/2
            ${isMe ? "-start-26 origin-right" : "-end-18 origin-left"}
            ${showMobileMenu ? "opacity-100 visible scale-100" : "opacity-0 invisible scale-90"}
            md:opacity-0 md:invisible md:scale-90
            md:group-hover/bubble:opacity-100 md:group-hover/bubble:visible md:group-hover/bubble:scale-100
        `}>
            {/* Reply Button */}
            <button onClick={onReply} className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-full transition text-muted" title={t("Reply")}>
                <Reply size={14} />
            </button>

            {/* React Button */}
            <button onClick={onReact} className="p-1.5 hover:bg-yellow-500/10 hover:text-yellow-500 rounded-full transition text-muted" title={t("React")}>
                <Smile size={14} />
            </button>

            {/* Edit/Delete (Only for Me) */}
            {isMe && (
                <div className="relative">
                    <button onClick={onToggleMenu} className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-full transition text-muted">
                        <MoreVertical size={14} />
                    </button>

                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                className="absolute bottom-full mb-2 -right-2 w-28 bg-surface border border-adaptive rounded-xl shadow-xl overflow-hidden flex flex-col z-50"
                            >
                                <button onClick={(e) => { e.stopPropagation(); onEdit(msg); }} className="flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-main text-content transition-colors w-full text-start">
                                    <Edit2 size={13} /> {t("Edit")}
                                </button>
                                <div className="h-[1px] bg-border-adaptive w-full" />
                                <button onClick={(e) => { e.stopPropagation(); onDelete(msg._id); }} className="flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-red-500/10 text-red-500 transition-colors w-full text-start">
                                    <Trash2 size={13} /> {t("Delete")}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Menu Backdrop */}
                    {showMenu && <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onToggleMenu(e); }} />}
                </div>
            )}
        </div>
    );
});

const ReplyPreview = memo(({ replyTo, isMe, scrollToMessage }) => {
    if (!replyTo) return null;
    return (
        <div
            onClick={(e) => { e.stopPropagation(); scrollToMessage(String(replyTo._id || replyTo)); }}
            className={`rounded-lg p-2 mb-2 text-xs cursor-pointer overflow-hidden border-s-[3px] transition-colors ${isMe ? "bg-black/20 border-white/40" : "bg-main border-primary/60"}`}
        >
            <span className={`font-bold block mb-0.5 ${isMe ? "text-white/90" : "text-primary"}`}>{replyTo.sender?.full_name}</span>
            <span className="truncate opacity-80 block">{replyTo.message_type === 'image' ? "📷 Photo" : replyTo.text}</span>
        </div>
    );
});

const StoryReplyPreview = memo(({ storyId, isMe }) => {
    if (!storyId) return null;

    const isVideo = storyId.type === 'video' || storyId.mediaUrl?.endsWith('.mp4');
    const isText = storyId.type === 'text';

    return (
        <div className={`flex items-center gap-2 p-1.5 rounded-lg mb-1.5 border-l-[3px] select-none transition ${isMe ? "bg-white/20 border-white/50" : "bg-black/5 dark:bg-white/5 border-primary"}`}>
            <div className="h-12 w-9 shrink-0 rounded overflow-hidden bg-black border border-white/10 relative">
                {isVideo ? (
                    <video src={storyId.mediaUrl} className="h-full w-full object-cover opacity-80" muted />
                ) : isText ? (
                    <div className="h-full w-full flex items-center justify-center p-0.5 text-[6px] text-center text-white/80 overflow-hidden leading-tight" style={{ background: storyId.background_color || '#333' }}>
                        {storyId.content?.slice(0, 10)}
                    </div>
                ) : (
                    <img src={storyId.image || storyId.mediaUrl || "/avatar-placeholder.png"} className="h-full w-full object-cover" alt="story" onError={(e) => { e.target.style.display = 'none' }} />
                )}
            </div>
            <div className="flex flex-col justify-center min-w-0">
                <span className={`text-[10px] font-bold mb-0.5 ${isMe ? "text-white/90" : "text-primary"}`}>Replied to story</span>
                <span className={`text-[10px] truncate w-32 ${isMe ? "text-white/70" : "text-muted"}`}>{storyId.content || "Media content"}</span>
            </div>
        </div>
    );
});

const ReactionPills = memo(({ groupedReactions, isMe, hasMeReacted, onViewReactionMessage, isDeleted }) => {
    if (!groupedReactions.length || isDeleted) return null;

    return (
        <div
            onClick={(e) => { e.stopPropagation(); onViewReactionMessage(); }}
            className={`
                absolute -bottom-4 ${isMe ? "start-0" : "end-0"} 
                flex items-center gap-1.5 
                bg-surface border border-adaptive rounded-full px-2 py-1 shadow-sm 
                cursor-pointer hover:scale-105 transition-transform z-10 select-none
            `}
        >
            {groupedReactions.map((group, i) => (
                <div key={i} className={`flex items-center gap-0.5 ${hasMeReacted(group.emoji) ? "opacity-100" : "opacity-80"}`}>
                    <span className="text-xs leading-none">{group.emoji}</span>
                    {group.count > 1 && (
                        <span className={`text-[10px] font-bold ${hasMeReacted(group.emoji) ? "text-primary" : "text-muted"}`}>
                            {group.count}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
});

// --- Main Component ---
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
    readStatus,
    t,
    currentLocale,
    onEdit,
    onDelete,
    onVote
}) => {

    const [showMenu, setShowMenu] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // 1. 🛡️ Handle System Messages
    if (msg.message_type === "system") {
        return <SystemMessage text={msg.text} />;
    }

    // 2. 🆔 Identification & Status
    const senderId = msg.sender?._id || msg.sender;
    const isMe = String(senderId) === String(userId) || msg.sender?.clerkId === userId;
    const isHighlighted = highlightedId === msg._id;
    const isSending = msg.isSending;
    const showReactionPicker = activeReactionId === msg._id;
    const isDeleted = msg.isDeleted;

    // 3. 🧠 Group Reactions Logic (Memoized)
    const groupedReactions = useMemo(() => {
        if (!msg.reactions || msg.reactions.length === 0) return [];
        const groups = msg.reactions.reduce((acc, r) => {
            const key = r.emoji;
            if (!acc[key]) acc[key] = { emoji: key, count: 0, userIds: [] };
            acc[key].count++;
            acc[key].userIds.push(r.user._id || r.user);
            return acc;
        }, {});
        return Object.values(groups).sort((a, b) => b.count - a.count);
    }, [msg.reactions]);

    const hasMeReacted = useCallback((emoji) => {
        return msg.reactions?.some(r => r.emoji === emoji && (r.user._id === userId || r.user === userId));
    }, [msg.reactions, userId]);

    // 4. 🎮 Interaction Handlers
    const toggleMenu = useCallback((e) => {
        e.stopPropagation();
        setActiveReactionId(null);
        setShowMenu(prev => !prev);
    }, [setActiveReactionId]);

    const handleBubbleClick = useCallback((e) => {
        // Prevent menu toggle when clicking links, images, or interactive elements
        if (e.target.tagName === 'A' || e.target.tagName === 'IMG' || e.target.closest('button')) return;
        setShowMobileMenu(prev => !prev);
    }, []);

    const handleBackdropClick = useCallback((e) => {
        e.stopPropagation();
        setShowMobileMenu(false);
        setActiveReactionId(null);
        setShowMenu(false);
    }, [setActiveReactionId]);

    const onReact = useCallback((e) => {
        e.stopPropagation();
        setActiveReactionId(msg._id);
    }, [setActiveReactionId, msg._id]);

    const onSelectReaction = useCallback((emoji) => {
        handleReaction(msg._id, emoji);
    }, [handleReaction, msg._id]);

    const onEditHandler = useCallback((m) => {
        setShowMenu(false);
        onEdit(m);
    }, [onEdit]);

    const onDeleteHandler = useCallback((id) => {
        setShowMenu(false);
        onDelete(id);
    }, [onDelete]);

    const onReplyHandler = useCallback(() => setReplyTo(msg), [setReplyTo, msg]);
    const onViewReactionHandler = useCallback(() => setViewReactionMessage(msg), [setViewReactionMessage, msg]);

    // ========================================================
    // 🎨 RENDER
    // ========================================================
    return (
        <div
            className={`flex items-end gap-2 transition-all duration-500 p-1 relative group
            ${isMe ? "flex-row-reverse" : "flex-row"} 
            ${isSending ? "opacity-70" : "opacity-100"} 
            ${isHighlighted ? "bg-primary/5 -mx-2 px-4 rounded-lg" : ""}
            ${msg.reactions?.length > 0 ? "mb-5" : "mb-1"} 
            `}
        >
            {/* 🛑 Global Backdrop: Emoji Picker */}
            {showReactionPicker && (
                <div
                    className="fixed inset-0 z-40 bg-transparent cursor-default"
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveReactionId(null);
                    }}
                />
            )}

            {/* 📱 Mobile Backdrop: Menu Toggle */}
            {showMobileMenu && (
                <div
                    className="fixed inset-0 z-10 bg-transparent"
                    onClick={handleBackdropClick}
                />
            )}

            {/* 👤 Avatar (Other User) */}
            {!isMe && (
                <UserAvatar
                    user={msg.sender}
                    className="w-8 h-8 rounded-full object-cover mb-1 border border-adaptive shadow-sm shrink-0"
                />
            )}

            {/* 💬 Message Container */}
            <div className={`flex flex-col max-w-[75%] md:max-w-[65%] ${isMe ? "items-end" : "items-start"} relative`}>

                {/* Name Label */}
                {!isMe && <span className="text-[10px] text-muted ms-1 mb-0.5 font-medium opacity-80">{msg.sender?.full_name}</span>}

                <div
                    className="relative group/bubble"
                    onClick={handleBubbleClick}
                >
                    {/* 🛠️ Floating Action Menu */}
                    <MessageActionMenu
                        isMe={isMe}
                        isDeleted={isDeleted}
                        isSending={isSending}
                        showMobileMenu={showMobileMenu}
                        onReply={onReplyHandler}
                        onReact={onReact}
                        onToggleMenu={toggleMenu}
                        showMenu={showMenu}
                        onEdit={onEditHandler}
                        onDelete={onDeleteHandler}
                        msg={msg}
                        t={t}
                    />

                    {/* 😂 Reaction Picker Modal */}
                    <AnimatePresence>
                        {showReactionPicker && (
                            <ReactionPicker isMe={isMe} onSelect={onSelectReaction} />
                        )}
                    </AnimatePresence>

                    {/* ✨✨ THE BUBBLE ITSELF ✨✨ */}
                    <div className={`px-3 py-2 shadow-sm text-sm leading-relaxed min-w-[80px] relative transition-all
                        ${isDeleted
                            ? "bg-surface/50 border border-dashed border-adaptive text-muted italic rounded-xl"
                            : isMe
                                ? "bg-primary text-white rounded-2xl rounded-br-none border border-primary shadow-primary/10"
                                : "bg-surface text-content rounded-2xl rounded-bl-none border border-adaptive"
                        }
                        ${msg.message_type === "image" ? "min-w-[280px]" : ""}
                    `}>
                        {isDeleted ? (
                            <div className="flex items-center gap-2 opacity-80 select-none py-1">
                                <Trash2 size={14} /> <span>{t("message.deleted")}</span>
                            </div>
                        ) : (
                            <>
                                <ReplyPreview replyTo={msg.replyTo} isMe={isMe} scrollToMessage={scrollToMessage} />
                                <StoryReplyPreview storyId={msg.replyToStoryId} isMe={isMe} />

                                {msg.message_type === "poll" ? (
                                    <PollMessage message={msg} currentUserId={userId} onVote={onVote || msg.onVote} t={t} />
                                ) : (
                                    <>
                                        {msg.message_type === "image" && msg.media_url && (
                                            <img
                                                src={msg.media_url}
                                                alt="media"
                                                className="rounded-lg w-auto h-auto max-w-full sm:max-w-[300px] max-h-[350px] object-cover mb-1.5 cursor-pointer hover:brightness-90 transition border border-black/10 dark:border-white/10"
                                                onClick={() => window.open(msg.media_url, '_blank')}
                                            />
                                        )}
                                        {msg.message_type === "audio" && <VoiceMessage src={msg.media_url} isMe={isMe} />}
                                        {msg.message_type === "shared_post" && msg.sharedPostId && (
                                            <div className="mb-2 max-w-[280px]"><SharedPostCard postId={msg.sharedPostId} /></div>
                                        )}
                                        {msg.text && (
                                            <p dir="auto" className={`whitespace-pre-wrap ${msg.message_type === "shared_post" ? "text-sm mt-1 opacity-90" : ""}`}>
                                                {msg.message_type === "shared_post"
                                                    ? msg.text.replace(/check out this post/i, "").replace(/https?:\/\/[^\s]+/g, "").trim()
                                                    : renderWithLinks(msg.text)}
                                            </p>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {/* Footer */}
                        <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isMe && !isDeleted ? "text-white/70" : "text-muted"}`}>
                            {!isDeleted && msg.isEdited && <span>({t("edited")})</span>}
                            {format(new Date(msg.createdAt || Date.now()), "hh:mm a")}
                            {isMe && !isDeleted && (
                                <div className="ms-0.5">
                                    {(msg.status === "pending" || msg.isSending)
                                        ? <Clock size={11} className="text-white/70" />
                                        : msg.read
                                            ? <CheckCheck size={15} strokeWidth={2.5} className="text-blue-200" />
                                            : msg.delivered
                                                ? <CheckCheck size={15} strokeWidth={2} className="text-white/50" />
                                                : <Check size={15} strokeWidth={2} className="text-white/50" />
                                    }
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ❤️ Reaction Pills */}
                    <ReactionPills
                        groupedReactions={groupedReactions}
                        isMe={isMe}
                        hasMeReacted={hasMeReacted}
                        onViewReactionMessage={onViewReactionHandler}
                        isDeleted={isDeleted}
                    />
                </div>
            </div>
        </div>
    );
};

// ⚡ Performance Optimization
const arePropsEqual = (prevProps, nextProps) => {
    const isMsgSame =
        prevProps.msg === nextProps.msg &&
        prevProps.readStatus === nextProps.readStatus &&
        prevProps.highlightedId === nextProps.highlightedId &&
        prevProps.scrollToMessage === nextProps.scrollToMessage;

    const wasActive = prevProps.activeReactionId === prevProps.msg._id;
    const isActive = nextProps.activeReactionId === nextProps.msg._id;

    const isPollSame = prevProps.msg.poll === nextProps.msg.poll;

    return isMsgSame && (wasActive === isActive) && isPollSame;
};

export default memo(MessageItem, arePropsEqual);