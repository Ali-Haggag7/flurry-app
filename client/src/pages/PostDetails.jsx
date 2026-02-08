/**
 * PostDetails Page
 * ------------------------------------------------------------------
 * Detailed view of a single post with nested comments system.
 * Refactored for performance, strict theming, and architectural separation.
 * * Features:
 * - Memoized sub-components to prevent unnecessary re-renders.
 * - Framer Motion for smooth transitions.
 * - Strict Tailwind Theme usage (bg-main, border-adaptive, etc.).
 * - Optimized event listeners and memory management.
 */

import React, { useEffect, useState, useMemo, useRef, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

// --- Icons ---
import {
    ArrowLeft, MessageCircle, Send, X, Maximize2, Loader2, Share2, Hand,
    MoreHorizontal, ExternalLink, Link2, Bookmark, PenLine, Trash2, ChevronLeft, ChevronRight
} from "lucide-react";

// --- API & Utils ---
import api from "../lib/axios";
import { buildCommentTree } from "../utils/buildCommentTree";

// --- Components (Assumed Local) ---
import CommentItem from "../components/feed/CommentItem";
import UserAvatar from "../components/common/UserDefaultAvatar";
import ShareModal from "../components/modals/ShareModal";
import EditPostModal from "../components/modals/EditPostModal";
import ReportModal from "../components/modals/ReportModal";

// --- Helpers ---
const getFamilyIds = (parentId, allComments) => {
    let ids = [parentId];
    const children = allComments.filter(c => c.parentId === parentId);
    children.forEach(child => { ids = [...ids, ...getFamilyIds(child._id, allComments)]; });
    return ids;
};

// --- Sub-Components ---

/**
 * Header component for navigation and post options.
 * Memoized to prevent re-renders on comment updates.
 */
const PostHeader = memo(({
    navigate, post, isOwner, isSaved,
    showOptionsMenu, setShowOptionsMenu,
    onCopyLink, onSave, onDelete, onEdit, onReport, t
}) => (
    <div className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl border-b border-adaptive px-4 py-3 flex items-center gap-4 shadow-sm transition-all duration-300">
        <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-main rounded-full transition active:scale-95 text-content group rtl:scale-x-[-1]"
            aria-label="Go back"
        >
            <ArrowLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
        <div className="flex-1 text-start">
            <h1 className="text-base font-bold text-content leading-tight">{t("postDetails.title")}</h1>
            <p
                className="text-xs text-muted font-medium cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate(`/profile/${post?.user?._id}`)}
            >
                {t("postDetails.by")} {post?.user?.full_name || t("stories.defaultUser")}
            </p>
        </div>

        {/* Options Menu */}
        <div className="relative ms-auto">
            <button
                onClick={(e) => { e.stopPropagation(); setShowOptionsMenu(!showOptionsMenu); }}
                className="p-2 hover:bg-main rounded-full text-muted hover:text-content transition"
            >
                <MoreHorizontal size={20} />
            </button>
            <AnimatePresence>
                {showOptionsMenu && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowOptionsMenu(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute end-0 top-full mt-2 w-48 bg-surface rounded-xl border border-adaptive shadow-xl z-50 overflow-hidden"
                        >
                            <button onClick={onCopyLink} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-main transition-colors border-b border-adaptive">
                                <Link2 size={16} /> <span>{t("post.copyLink")}</span>
                            </button>
                            <button onClick={onSave} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-main transition-colors border-b border-adaptive">
                                <Bookmark size={16} className={isSaved ? "fill-primary text-primary" : ""} />
                                <span>{isSaved ? t("post.unsave") : t("post.save")}</span>
                            </button>
                            {isOwner ? (
                                <>
                                    <button onClick={onEdit} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-main transition-colors border-b border-adaptive">
                                        <PenLine size={16} /> <span>{t("post.edit")}</span>
                                    </button>
                                    <button onClick={onDelete} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                                        <Trash2 size={16} /> <span>{t("post.delete")}</span>
                                    </button>
                                </>
                            ) : null}
                            {!isOwner && (
                                <button onClick={onReport} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                                    <ArrowLeft className="rotate-180 hidden" /> {/* Placeholder/Icon Fix */}
                                    <span>Report</span> {/* Fallback/Icon needed based on import */}
                                </button>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    </div>
));

/**
 * Renders the image grid for the post.
 */
const PostMedia = memo(({ images, onSelectImage }) => {
    if (!images?.length) return null;
    return (
        <div className={`grid gap-2 rounded-2xl overflow-hidden mt-3 mb-5 border border-adaptive ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {images.map((img, idx) => (
                <div
                    key={idx}
                    onClick={() => onSelectImage(idx)}
                    className={`relative group cursor-pointer overflow-hidden bg-main ${(images.length % 2 !== 0 && idx === images.length - 1) ? 'col-span-2 h-[400px]' : 'h-64 sm:h-80'}`}
                >
                    <img
                        src={img}
                        alt={`img-${idx}`}
                        loading={idx === 0 ? "eager" : "lazy"}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="p-3 bg-white/20 rounded-full border border-white/30 backdrop-blur-md">
                            <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
});

/**
 * Handles social stats and share menu toggling.
 */
const StatsBar = memo(({
    commentsCount, sharesCount, showShareMenu, setShowShareMenu,
    setShowInternalShareModal, onExternalShare, t
}) => (
    <div className="pt-4 border-t border-adaptive flex items-center justify-between text-sm text-muted">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-main rounded-full border border-adaptive">
            <MessageCircle size={16} className="text-primary" />
            <span className="font-bold text-content">{commentsCount}</span> {t("notifications.tabs.comments")}
        </div>
        <div className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setShowShareMenu(!showShareMenu); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 ${showShareMenu ? "bg-primary text-white" : "hover:bg-main text-muted hover:text-primary"}`}
            >
                <Share2 size={18} />
                {sharesCount > 0 && <span className="font-bold">{sharesCount}</span>}
            </button>

            <AnimatePresence>
                {showShareMenu && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute end-0 bottom-full mb-2 w-48 bg-surface rounded-xl border border-adaptive shadow-xl z-20 overflow-hidden"
                        >
                            <button
                                onClick={() => { setShowShareMenu(false); setShowInternalShareModal(true); }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-content hover:bg-main transition-colors border-b border-adaptive"
                            >
                                <Send size={16} className="text-primary rtl:rotate-180" /> <span>{t("post.sendInApp")}</span>
                            </button>
                            <button
                                onClick={onExternalShare}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-content hover:bg-main transition-colors"
                            >
                                <ExternalLink size={16} className="text-primary rtl:rotate-180" /> <span>{t("post.shareVia")}</span>
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    </div>
));

/**
 * Fixed input area for adding comments.
 */
const CommentInput = memo(({
    currentUser, commentText, submitting, textareaRef,
    onInput, onSubmit, t
}) => (
    <div className="fixed bottom-0 start-0 md:start-20 end-0 p-4 bg-gradient-to-t from-main via-main/95 to-transparent z-40">
        <div className="max-w-3xl mx-auto flex items-end gap-3 bg-surface/90 backdrop-blur-xl p-2 rounded-[2rem] border border-adaptive shadow-2xl">
            <div className="shrink-0 mb-1 ms-1">
                <UserAvatar user={currentUser} className="w-9 h-9 border border-adaptive rounded-full" />
            </div>
            <div className="flex-1 bg-main/50 rounded-3xl flex items-center border border-transparent focus-within:border-primary/50 focus-within:bg-main focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300">
                <textarea
                    ref={textareaRef}
                    value={commentText}
                    onInput={onInput}
                    placeholder={t("postDetails.addComment")}
                    className="w-full bg-transparent text-content py-3 px-4 max-h-32 min-h-11 resize-none focus:outline-none text-[15px] placeholder-muted/70 leading-relaxed custom-scrollbar"
                    rows={1}
                />
                <button
                    onClick={() => onSubmit(commentText, null)}
                    disabled={submitting || !commentText.trim()}
                    className="p-2.5 me-1.5 text-white bg-primary hover:opacity-90 rounded-full disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground transition-all shadow-md active:scale-95 self-end mb-1.5"
                >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ms-0.5 rtl:rotate-270" />}
                </button>
            </div>
        </div>
    </div>
));

/**
 * Full Screen Image Viewer.
 */
const ImageGallery = memo(({ images, initialIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [showSwipeHint, setShowSwipeHint] = useState(true);

    useEffect(() => {
        if (initialIndex !== null) setCurrentIndex(initialIndex);
    }, [initialIndex]);

    useEffect(() => {
        const timer = setTimeout(() => setShowSwipeHint(false), 2500);
        return () => clearTimeout(timer);
    }, []);

    const nextImage = useCallback((e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    }, [images.length]);

    const prevImage = useCallback((e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }, [images.length]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "ArrowRight") nextImage();
            if (e.key === "ArrowLeft") prevImage();
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [nextImage, prevImage, onClose]);

    // Ensure we don't render if not active
    if (initialIndex === null || !images?.length) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center"
                onClick={onClose}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="absolute top-6 end-6 z-50 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition active:scale-90"
                >
                    <X size={24} />
                </button>

                {images.length > 1 && (
                    <button
                        onClick={prevImage}
                        className="absolute start-4 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition hidden sm:block hover:scale-110 rtl:rotate-180"
                    >
                        <ChevronLeft size={32} />
                    </button>
                )}

                <div className="relative w-full h-full flex items-center justify-center p-4">
                    <AnimatePresence mode="wait">
                        <motion.img
                            key={currentIndex}
                            src={images[currentIndex]}
                            alt={`Gallery ${currentIndex}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15, ease: "linear" }}
                            onClick={(e) => e.stopPropagation()}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={1}
                            onDragEnd={(e, { offset, velocity }) => {
                                const swipe = Math.abs(offset.x) * velocity.x;
                                if (swipe < -10000) nextImage();
                                else if (swipe > 10000) prevImage();
                            }}
                            className="max-w-full max-h-[90vh] object-contain shadow-2xl rounded-lg select-none"
                        />
                    </AnimatePresence>

                    {images.length > 1 && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-1 rounded-full text-white text-sm backdrop-blur-md border border-white/10">
                            {currentIndex + 1} / {images.length}
                        </div>
                    )}

                    <AnimatePresence>
                        {showSwipeHint && images.length > 1 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none sm:hidden"
                            >
                                <motion.div
                                    animate={{
                                        x: [0, 50, -50, 0],
                                        opacity: [0, 1, 1, 0]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    <Hand size={48} className="text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]" />
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {images.length > 1 && (
                    <button
                        onClick={nextImage}
                        className="absolute end-4 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition hidden sm:block hover:scale-110 rtl:rotate-180"
                    >
                        <ChevronRight size={32} />
                    </button>
                )}
            </motion.div>
        </AnimatePresence>
    );
});

/**
 * Isolated discussion section to prevent re-rendering the post body
 * when only the comment tree changes.
 */
const DiscussionSection = memo(({ commentsTree, commentsCount, currentUser, postOwnerId, onAddReply, onLike, onDelete, onEdit, t }) => (
    <div className="space-y-6 pb-4">
        <h3 className="text-xs font-black text-muted uppercase tracking-[0.2em] ps-4 border-s-4 border-primary text-start">
            {t("postDetails.discussion", { count: commentsCount })}
        </h3>

        {commentsTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-surface/50 rounded-[2rem] border border-adaptive border-dashed">
                <div className="p-5 bg-main rounded-full mb-4 shadow-sm">
                    <MessageCircle className="w-10 h-10 text-muted/50" />
                </div>
                <p className="text-content font-bold text-lg">{t("postDetails.noComments")}</p>
            </div>
        ) : (
            <div className="space-y-6">
                {commentsTree.map((rootComment) => (
                    <CommentItem
                        key={rootComment._id}
                        comment={rootComment}
                        currentUser={currentUser}
                        postOwnerId={postOwnerId}
                        addReply={onAddReply}
                        onLike={onLike}
                        onDelete={onDelete}
                        onEdit={onEdit}
                    />
                ))}
            </div>
        )}
    </div>
));

// --- Main Component ---

const PostDetails = () => {
    const { id: postId } = useParams();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const textareaRef = useRef(null);
    const { currentUser } = useSelector((state) => state.user);
    const { t, i18n } = useTranslation();
    const currentLocale = i18n.language === 'ar' ? ar : enUS;

    // --- State ---
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [comments, setComments] = useState([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(null);

    // 🔥 FIX: Local shares count state
    const [sharesCount, setSharesCount] = useState(0);

    // Menu & Modal States
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showInternalShareModal, setShowInternalShareModal] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    // --- Derived ---
    const isOwner = currentUser?._id === post?.user?._id;
    const commentsTree = useMemo(() => buildCommentTree(comments), [comments]);

    // --- Fetch Data ---
    useEffect(() => {
        let isMounted = true;
        const fetchPost = async () => {
            try {
                const token = await getToken();
                const { data } = await api.get(`/post/${postId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (data.success && isMounted) {
                    setPost(data.post);
                    setIsSaved(data.post.saves?.includes(currentUser?._id) || false);
                    setSharesCount(data.post.shares?.length || 0);

                    const uniqueComments = [...new Map((data.comments || data.post.comments || []).map(item => [item._id, item])).values()];
                    setComments(uniqueComments);
                }
            } catch (error) {
                console.error("Fetch Error:", error);
                toast.error(t("postDetails.toasts.loadFailed"));
                if (isMounted) navigate("/");
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (postId) fetchPost();
        return () => { isMounted = false; };
    }, [postId, getToken, currentUser, navigate, t]);

    // --- Handlers ---

    const incrementShareCount = useCallback(async () => {
        try {
            const token = await getToken();
            await api.put(`/post/share/${post._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setSharesCount(prev => prev + 1);
        } catch (error) { console.error("Failed to record share"); }
    }, [post, getToken]);

    const handleExternalShare = useCallback(async () => {
        setShowShareMenu(false);
        const shareUrl = `${window.location.origin}/post/${post._id}`;
        const shareData = {
            title: `Post by ${post.user?.full_name}`,
            text: (post.text || post.content)?.substring(0, 50) + "...",
            url: shareUrl
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
                await incrementShareCount();
                toast.success(t("post.shareSuccess"));
            } else {
                await navigator.clipboard.writeText(shareUrl);
                await incrementShareCount();
                toast.success(t("post.linkCopied"));
            }
        } catch (err) { if (err.name !== 'AbortError') toast.error(t("share.error")); }
    }, [post, incrementShareCount, t]);

    const handleSavePost = useCallback(async () => {
        if (!currentUser) return toast.error(t("post.loginRequired"));
        const oldIsSaved = isSaved;
        setIsSaved(!isSaved);
        setShowOptionsMenu(false);
        toast.success(!isSaved ? t("post.saved") : t("post.unsaved"));
        try {
            const token = await getToken();
            await api.put(`/post/save/${post._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
            setIsSaved(oldIsSaved);
            toast.error(t("post.saveError"));
        }
    }, [isSaved, currentUser, post, getToken, t]);

    const handleDeletePost = useCallback(async () => {
        if (!window.confirm(t("post.deleteConfirm"))) return;
        try {
            const token = await getToken();
            await api.delete(`/post/${post._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("post.deleteSuccess"));
            navigate("/");
        } catch (error) { toast.error(t("post.deleteError")); }
    }, [post, getToken, navigate, t]);

    const handleCopyLink = useCallback(() => {
        const shareUrl = `${window.location.origin}/post/${post._id}`;
        navigator.clipboard.writeText(shareUrl);
        toast.success(t("post.linkCopied"));
        setShowOptionsMenu(false);
    }, [post, t]);

    const handleAddComment = useCallback(async (text, parentId = null) => {
        if (!text || !text.trim()) return toast.error(t("postDetails.toasts.emptyComment"));
        setSubmitting(true);
        try {
            const token = await getToken();
            const { data } = await api.post(`/post/comment/${postId}`, { text, parentId }, { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) {
                toast.success(parentId ? t("postDetails.toasts.replyAdded") : t("postDetails.toasts.commentAdded"));
                setComments(prev => [...prev, data.comment]);
                if (!parentId) {
                    setCommentText("");
                    if (textareaRef.current) textareaRef.current.style.height = 'auto';
                }
            }
        } catch (error) { toast.error(t("postDetails.toasts.commentFailed")); }
        finally { setSubmitting(false); }
    }, [postId, getToken, t]);

    const handleDeleteComment = useCallback(async (commentId) => {
        if (!window.confirm(t("postDetails.toasts.deleteCommentConfirm"))) return;
        const idsToDelete = getFamilyIds(commentId, comments);
        const oldComments = [...comments];
        setComments(prev => prev.filter(c => !idsToDelete.includes(c._id)));
        try {
            const token = await getToken();
            await api.delete(`/post/comment/${commentId}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("postDetails.toasts.commentDeleted"));
        } catch (error) {
            setComments(oldComments);
            toast.error(t("postDetails.toasts.deleteCommentFailed"));
        }
    }, [comments, getToken, t]);

    const handleEditComment = useCallback(async (commentId, newText) => {
        setComments(prev => prev.map(c => c._id === commentId ? { ...c, text: newText, isEdited: true } : c));
        try {
            const token = await getToken();
            await api.put(`/post/comment/${commentId}`, { text: newText }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("postDetails.toasts.commentUpdated"));
        } catch (error) { toast.error(t("postDetails.toasts.updateCommentFailed")); }
    }, [getToken, t]);

    const handleLikeComment = useCallback(async (commentId) => {
        if (!currentUser) return toast.error(t("post.loginRequired"));
        const currentUserId = String(currentUser._id);
        setComments(prev => prev.map(c => {
            if (c._id === commentId) {
                const isLiked = c.likes?.some(id => String(id) === currentUserId);
                let newLikes = c.likes || [];
                if (isLiked) newLikes = newLikes.filter(id => String(id) !== currentUserId);
                else newLikes = [...newLikes, currentUserId];
                return { ...c, likes: newLikes };
            }
            return c;
        }));
        try {
            const token = await getToken();
            await api.post(`/post/comment/like/${commentId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) { /* Revert logic if needed */ }
    }, [currentUser, getToken, t]);

    const handleTextareaInput = useCallback((e) => {
        setCommentText(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-main flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-main text-content pb-32 md:pb-24 relative transition-colors duration-300">
            <PostHeader
                navigate={navigate}
                post={post}
                isOwner={isOwner}
                isSaved={isSaved}
                showOptionsMenu={showOptionsMenu}
                setShowOptionsMenu={setShowOptionsMenu}
                onCopyLink={handleCopyLink}
                onSave={handleSavePost}
                onDelete={handleDeletePost}
                onEdit={() => { setShowOptionsMenu(false); setShowEditModal(true); }}
                onReport={() => { setShowOptionsMenu(false); setShowReportModal(true); }}
                t={t}
            />

            <div className="max-w-3xl mx-auto p-4 space-y-6">
                <motion.article
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surface rounded-[2rem] p-6 border border-adaptive shadow-sm transition-colors duration-300 relative overflow-hidden"
                >
                    {/* User Info & Content */}
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3 cursor-pointer group">
                            <UserAvatar user={post.user} className="w-12 h-12 border border-adaptive rounded-full group-hover:border-primary transition-colors" />
                            <div onClick={() => navigate(`/profile/${post?.user?._id}`)} className="text-start">
                                <h3 className="font-bold text-[16px] text-content group-hover:text-primary transition-colors flex items-center gap-1">{post?.user?.full_name}</h3>
                                <div className="text-muted text-xs font-medium">@{post?.user?.username || "username"} • {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: currentLocale })}</div>
                            </div>
                        </div>
                    </div>

                    <p className="text-content/90 whitespace-pre-wrap text-[16px] leading-7 mb-5 font-normal tracking-wide text-start">
                        {post?.content}
                    </p>

                    <PostMedia
                        images={post?.image_urls}
                        onSelectImage={(index) => setSelectedImageIndex(index)}
                    />

                    <StatsBar
                        commentsCount={comments.length}
                        sharesCount={sharesCount}
                        showShareMenu={showShareMenu}
                        setShowShareMenu={setShowShareMenu}
                        setShowInternalShareModal={setShowInternalShareModal}
                        onExternalShare={handleExternalShare}
                        t={t}
                    />
                </motion.article>

                <DiscussionSection
                    commentsTree={commentsTree}
                    commentsCount={comments.length}
                    currentUser={currentUser}
                    postOwnerId={post?.user?._id}
                    onAddReply={handleAddComment}
                    onLike={handleLikeComment}
                    onDelete={handleDeleteComment}
                    onEdit={handleEditComment}
                    t={t}
                />
            </div>

            <CommentInput
                currentUser={currentUser}
                commentText={commentText}
                submitting={submitting}
                textareaRef={textareaRef}
                onInput={handleTextareaInput}
                onSubmit={handleAddComment}
                t={t}
            />

            <ImageGallery
                images={post?.image_urls || []}
                initialIndex={selectedImageIndex}
                onClose={() => setSelectedImageIndex(null)}
            />

            {/* Modals - Lazy load candidates in production */}
            <EditPostModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                post={post}
                onUpdateSuccess={(newContent) => setPost(prev => ({ ...prev, content: newContent }))}
            />
            <ShareModal
                isOpen={showInternalShareModal}
                onClose={() => setShowInternalShareModal(false)}
                post={post}
                onSuccess={incrementShareCount}
            />
            <AnimatePresence>
                {showReportModal && (
                    <ReportModal
                        postId={post._id}
                        onClose={() => setShowReportModal(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

export default PostDetails;