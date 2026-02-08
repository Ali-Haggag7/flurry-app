/**
 * CommentItem Component
 * ------------------------------------------------------------------
 * Recursive component for rendering comments and their replies.
 */

import { useState, useMemo, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢
import { ar, enUS } from "date-fns/locale"; // 🟢

// Icons
import {
    Heart, MessageCircle, Reply, ChevronUp, MoreHorizontal,
    Trash2, Edit2, X, Check, BadgeCheck
} from "lucide-react";

// Components
import UserAvatar from "../common/UserDefaultAvatar";

// --- Helper Functions ---
const getReplyCount = (node) => {
    if (!node.children || node.children.length === 0) return 0;
    return node.children.reduce((acc, child) => acc + 1 + getReplyCount(child), 0);
};

const CommentItem = ({
    comment,
    currentUser,
    postOwnerId,
    addReply,
    onLike,
    onDelete,
    onEdit
}) => {
    // --- State ---
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [showReplies, setShowReplies] = useState(false);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment.text);
    const [showMenu, setShowMenu] = useState(false);

    const { t, i18n } = useTranslation(); // 🟢
    const currentLocale = i18n.language === 'ar' ? ar : enUS; // 🟢

    // --- Derived Values (Memoized) ---
    const likesCount = comment.likes?.length || 0;
    const isLiked = useMemo(() => comment.likes?.some(id => String(id) === String(currentUser?._id)), [comment.likes, currentUser]);

    const isCommentOwner = String(currentUser?._id) === String(comment.user?._id);
    const isPostOwner = String(currentUser?._id) === String(postOwnerId);
    const canAction = isCommentOwner || isPostOwner;

    const replyCount = useMemo(() => getReplyCount(comment), [comment]);
    const hasReplies = replyCount > 0;

    // --- Handlers (Memoized) ---

    const handleReplySubmit = useCallback((e) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        addReply(replyText, comment._id);
        setReplyText("");
        setShowReplyInput(false);
        setShowReplies(true);
    }, [replyText, addReply, comment._id]);

    const handleEditSubmit = useCallback(() => {
        if (editText.trim() !== comment.text) {
            onEdit(comment._id, editText);
        }
        setIsEditing(false);
        setShowMenu(false);
    }, [editText, comment.text, comment._id, onEdit]);

    const toggleLike = useCallback(() => {
        onLike(comment._id);
    }, [onLike, comment._id]);

    const toggleDelete = useCallback(() => {
        onDelete(comment._id);
    }, [onDelete, comment._id]);

    // --- Render ---

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative group w-full"
        >
            <div className="flex gap-3 mb-2 relative z-10">
                {/* Avatar Column */}
                <div className="flex flex-col items-center shrink-0">
                    <UserAvatar
                        user={comment.user}
                        className="w-9 h-9 border border-adaptive rounded-full shadow-sm"
                    />
                    {/* Connection Line for Replies */}
                    {hasReplies && showReplies && (
                        <div className="w-0.5 h-full mt-2 rounded-full bg-linear-to-b from-white/20 to-transparent min-h-5"></div>
                    )}
                </div>

                {/* Comment Content Column */}
                <div className="flex-1 min-w-0">

                    {/* Bubble */}
                    {/* 🔵 RTL: rounded-tl-none needs logic or logical prop `rounded-ss-none` if supported, otherwise conditional class */}
                    <div className={`bg-main/50 hover:bg-main border border-transparent hover:border-adaptive/50 rounded-2xl px-4 py-3 inline-block transition-all max-w-full shadow-sm relative group/bubble ${i18n.language === 'ar' ? 'rounded-tr-none' : 'rounded-tl-none'}`}>

                        {/* Header: Name & Time */}
                        <div className="flex items-center gap-2 mb-1 justify-between">
                            <div className="flex items-center gap-2">
                                <Link to={`/profile/${comment.user?._id}`} className="font-bold text-[14px] text-content hover:text-primary decoration-primary cursor-pointer transition-all">
                                    {comment.user?.full_name || t("stories.defaultUser")} {/* 🟢 */}
                                    {comment.user?.isVerified && (
                                        <BadgeCheck size={14} className="text-primary inline-block ms-1 mb-0.5" />
                                    )}
                                </Link>
                                <span className="text-[11px] text-muted font-medium">
                                    {formatDistanceToNowStrict(new Date(comment.createdAt), { locale: currentLocale, addSuffix: true })} {/* 🟢 Localized time */}
                                </span>
                                {comment.isEdited && (
                                    <span className="text-[10px] text-muted/70 italic">({t("comment.edited")})</span>
                                )}
                            </div>

                            {/* Actions Menu (Three Dots) */}
                            {canAction && !isEditing && (
                                <div className="relative ms-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                                        className="sm:opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1 hover:bg-surface rounded-full text-muted"
                                    >
                                        <MoreHorizontal size={14} />
                                    </button>

                                    {showMenu && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                                            <div className="absolute end-0 top-6 bg-surface border border-adaptive rounded-sg shadow-xl z-20 w-32 py-1 overflow-hidden animate-in fade-in zoom-in-95"> {/* 🔵 end-0 */}
                                                {isCommentOwner && (
                                                    <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="w-full text-start px-3 py-2 text-xs hover:bg-main flex items-center gap-2 text-content transition-colors">
                                                        <Edit2 size={12} /> {t("comment.edit")} {/* 🟢 */}
                                                    </button>
                                                )}
                                                <button onClick={toggleDelete} className="w-full text-start px-3 py-2 text-xs hover:bg-red-500/10 text-red-500 flex items-center gap-2 transition-colors">
                                                    <Trash2 size={12} /> {t("comment.delete")} {/* 🟢 */}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Comment Body / Edit Input */}
                        {isEditing ? (
                            <div className="min-w-50 mt-1">
                                <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="w-full bg-surface border border-primary/50 rounded-sg p-2 text-sm focus:outline-none resize-none text-content custom-scrollbar"
                                    rows={2}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => { setIsEditing(false); setEditText(comment.text); }} className="p-1 hover:bg-red-500/10 text-red-500 rounded transition-colors"><X size={16} /></button>
                                    <button onClick={handleEditSubmit} className="p-1 hover:bg-green-500/10 text-green-500 rounded transition-colors"><Check size={16} /></button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-content/90 text-[15px] leading-relaxed whitespace-pre-wrap font-normal wrap-break-word">
                                {comment.text}
                            </p>
                        )}
                    </div>

                    {/* Interaction Buttons */}
                    <div className="flex items-center flex-wrap gap-4 mt-1.5 ms-2 select-none">
                        <button
                            onClick={toggleLike}
                            className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${isLiked ? "text-pink-600" : "text-muted hover:text-pink-500"}`}
                        >
                            <Heart size={14} fill={isLiked ? "currentColor" : "none"} />
                            <span>{likesCount}</span>
                        </button>

                        <button onClick={() => setShowReplyInput(!showReplyInput)} className={`flex items-center gap-1.5 text-xs font-bold text-muted hover:text-primary transition-colors ${showReplyInput ? "text-primary" : ""}`}>
                            <MessageCircle size={14} />
                            <span>{t("comment.reply")}</span> {/* 🟢 */}
                        </button>

                        {hasReplies && (
                            <button onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-1 text-xs font-bold text-muted hover:text-primary transition-colors ms-auto sm:ms-2 px-2 py-0.5 rounded-full hover:bg-main/50">
                                {showReplies ? <><ChevronUp size={14} /> {t("comment.hideReplies")}</> : <><div className="w-4 h-px bg-current me-1 opacity-50"></div> {t("comment.viewReplies", { count: replyCount })}</>} {/* 🟢 */}
                            </button>
                        )}
                    </div>

                    {/* Reply Input Form */}
                    <AnimatePresence>
                        {showReplyInput && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 ps-2 overflow-hidden">
                                <form
                                    onSubmit={handleReplySubmit}
                                    className="flex gap-2 items-end"
                                >
                                    <div className="w-6 h-6 border-s-2 border-b-2 border-adaptive rounded-bl-xl me-1 mb-3 self-end opacity-30"></div> {/* 🔵 border-s-2 handles RTL */}

                                    <div className="flex-1 relative">
                                        <textarea
                                            value={replyText}
                                            onChange={(e) => {
                                                setReplyText(e.target.value);
                                                e.target.style.height = 'auto';
                                                e.target.style.height = `${e.target.scrollHeight}px`;
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    if (window.innerWidth < 768) return;
                                                    if (e.shiftKey) return;
                                                    e.preventDefault();
                                                    handleReplySubmit(e);
                                                }
                                            }}
                                            placeholder={t("comment.replyPlaceholder", { name: comment.user?.full_name?.split(" ")[0] })} // 🟢
                                            rows={1}
                                            className="w-full bg-main text-content text-sm rounded-xl ps-4 pe-12 py-2.5 border border-adaptive focus:border-primary focus:outline-none transition-all placeholder-muted shadow-sm resize-none overflow-hidden block"
                                            autoFocus
                                        />

                                        <button
                                            type="submit"
                                            disabled={!replyText.trim()}
                                            className="absolute end-2 bottom-2 p-1.5 bg-primary hover:opacity-90 rounded-sg text-white disabled:opacity-50 transition-all shadow-sm active:scale-95 z-10" // 🔵 end-2
                                        >
                                            <Reply size={14} className="rtl:rotate-180" /> {/* 🔵 RTL icon */}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Recursive Replies Rendering */}
            {hasReplies && showReplies && (
                <div className="ms-5 sm:ms-11 ps-0 relative animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Vertical Line for threading */}
                    <div className="absolute top-0 bottom-0 start-[-1.3rem] w-0.5 rounded-full bg-white/10 group-hover/comment:bg-primary/50 transition-colors duration-300 hidden sm:block"></div> {/* 🔵 start-[-1.3rem] */}

                    {comment.children.map((childComment) => (
                        <CommentItem
                            key={childComment._id}
                            comment={childComment}
                            currentUser={currentUser}
                            postOwnerId={postOwnerId}
                            addReply={addReply}
                            onLike={onLike}
                            onDelete={onDelete}
                            onEdit={onEdit}
                        />
                    ))}
                </div>
            )}
        </motion.div>
    );
};

export default memo(CommentItem);