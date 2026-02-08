/**
 * PostCard Component
 * ------------------------------------------------------------------
 * Renders a single social media post with interactions.
 * Refactored for performance (memoization, lazy loading) and strict theming.
 *
 * @component
 */

import React, { useState, useEffect, useCallback, memo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { formatDistanceToNowStrict } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ar, enUS } from "date-fns/locale";

// --- Icons ---
import {
    BadgeCheck, Heart, MessageCircle, Share2, Link2, Trash2, Send,
    Flag, ExternalLink, MoreHorizontal, Bookmark, PenLine, ShieldAlert, Check
} from "lucide-react";

// --- Utils & API ---
import api from "../../lib/axios";
import { optimizeImage } from "../../utils/imageOptimizer";

// --- Components ---
import UserAvatar from "../common/UserDefaultAvatar";

// --- Lazy Loaded Modals ---
const ShareModal = lazy(() => import("../modals/ShareModal"));
const EditPostModal = lazy(() => import("../modals/EditPostModal"));
const ReportModal = lazy(() => import("../modals/ReportModal"));

// --- Sub-Components ---

/**
 * PostHeader: Handles user info, timestamp, and the options menu.
 */
const PostHeader = memo(({
    user, timestamp, locale, isOwner, isSaved, hasReported,
    showOptionsMenu, setShowOptionsMenu,
    onNavigateProfile, onStorySeen,
    onCopyLink, onSave, onEdit, onDelete, onReport, t
}) => (
    <div className="flex items-center justify-between mb-4">
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-3 cursor-pointer group">
            <UserAvatar
                user={user}
                className="w-11 h-11 border rounded-full border-adaptive"
                onCloseStory={onStorySeen}
            />
            <div onClick={onNavigateProfile}>
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-content group-hover:text-primary transition text-[15px]">
                        {user?.full_name || t("stories.defaultUser")}
                    </span>
                    {user?.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
                </div>
                <div className="text-muted text-xs font-medium">
                    @{user?.username || "username"} • {formatDistanceToNowStrict(new Date(timestamp), { locale, addSuffix: true })}
                </div>
            </div>
        </div>

        {/* Options Menu */}
        <div className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setShowOptionsMenu(!showOptionsMenu); }}
                aria-label="More options"
                className="p-2 text-muted hover:text-content hover:bg-main rounded-full transition"
            >
                <MoreHorizontal size={20} />
            </button>

            <AnimatePresence>
                {showOptionsMenu && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowOptionsMenu(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute end-0 top-full mt-2 w-48 bg-surface rounded-xl border border-adaptive shadow-xl z-20 overflow-hidden"
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
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (!hasReported) onReport(); }}
                                    disabled={hasReported}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${hasReported ? "text-muted cursor-not-allowed bg-main" : "text-amber-500 hover:bg-amber-500/10"}`}
                                >
                                    {hasReported ? (
                                        <> <Check size={16} /> <span>{t("post.reported")}</span> </>
                                    ) : (
                                        <> <Flag size={16} /> <span>{t("post.report")}</span> </>
                                    )}
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
 * PostMediaGrid: Handles layout logic for 1, 2, 3, or 4+ images.
 */
const PostMediaGrid = memo(({ images, priority }) => {
    if (!images || images.length === 0) return null;

    const count = images.length;

    // Common Image Props
    const Img = ({ src, className, size = 400 }) => (
        <img
            src={optimizeImage(src, size)}
            alt="Post content"
            className={`w-full h-full object-cover group-hover:scale-105 transition duration-700 ${className}`}
            loading={priority ? "eager" : "lazy"}
        />
    );

    return (
        <div className="rounded-2xl overflow-hidden border border-adaptive bg-main mt-3">
            {count === 1 && (
                <div className="w-full h-auto overflow-hidden cursor-zoom-in group">
                    <Img src={images[0]} size={600} className="max-h-[600px]" />
                </div>
            )}

            {count === 2 && (
                <div className="grid grid-cols-2 gap-0.5 h-[300px]">
                    {images.map((img, i) => (
                        <div key={i} className="overflow-hidden cursor-pointer h-full group">
                            <Img src={img} />
                        </div>
                    ))}
                </div>
            )}

            {count === 3 && (
                <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-[400px]">
                    <div className="overflow-hidden cursor-pointer h-full group">
                        <Img src={images[0]} />
                    </div>
                    <div className="overflow-hidden cursor-pointer h-full group">
                        <Img src={images[1]} />
                    </div>
                    <div className="col-span-2 overflow-hidden cursor-pointer h-full group">
                        <Img src={images[2]} size={600} />
                    </div>
                </div>
            )}

            {count >= 4 && (
                <div className="grid grid-cols-2 gap-0.5 h-[400px]">
                    {images.slice(0, 4).map((img, i) => (
                        <div key={i} className="relative overflow-hidden cursor-pointer h-full group">
                            <Img src={img} size={300} />
                            {i === 3 && count > 4 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
                                    <span className="text-white text-xl font-bold">+{count - 4}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

/**
 * PostFooter: Handles Like, Comment, and Share interactions.
 */
const PostFooter = memo(({
    likesCount, commentsCount, sharesCount, isLiked,
    showShareMenu, setShowShareMenu,
    onLike, onNavigatePost, onInternalShareClick, onExternalShare, t
}) => (
    <div className="flex items-center justify-between pt-4 mt-2 px-2 border-t border-adaptive">
        <div className="flex items-center gap-4">
            <button onClick={onLike} aria-label="Like" className="group flex items-center gap-1.5 focus:outline-none transition-all">
                <Heart size={22} className={`transition-all duration-300 group-hover:scale-110 ${isLiked ? "text-primary fill-primary drop-shadow-[0_0_8px_rgba(var(--color-primary),0.4)]" : "text-muted group-hover:text-primary"}`} />
                <span className={`text-sm font-medium transition-colors ${isLiked ? "text-primary" : "text-muted"}`}>{likesCount}</span>
            </button>
            <button onClick={onNavigatePost} aria-label="Comment" className="group flex items-center gap-1.5 focus:outline-none transition-all">
                <MessageCircle size={22} className="text-muted transition-all duration-300 group-hover:text-primary group-hover:scale-110" />
                <span className="text-sm font-medium text-muted group-hover:text-primary transition-colors">{commentsCount}</span>
            </button>
        </div>

        <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowShareMenu(!showShareMenu); }} aria-label="Share" className="group flex items-center gap-1.5 focus:outline-none transition-all">
                <span className={`text-sm font-medium transition-colors ${sharesCount > 0 ? "text-primary" : "text-muted group-hover:text-primary"}`}>
                    {sharesCount > 0 ? sharesCount : t("post.share")}
                </span>
                <Share2 size={22} className={`transition-all duration-300 group-hover:scale-110 ${sharesCount > 0 ? "text-primary" : "text-muted group-hover:text-primary"}`} />
            </button>
            <AnimatePresence>
                {showShareMenu && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute end-0 bottom-full mb-3 w-48 bg-surface rounded-xl border border-adaptive shadow-xl z-20 overflow-hidden"
                        >
                            <button onClick={onInternalShareClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-content hover:bg-main transition-colors border-b border-adaptive">
                                <Send size={16} className="text-primary rtl:rotate-180" /> <span>{t("post.sendInApp")}</span>
                            </button>
                            <button onClick={onExternalShare} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-content hover:bg-main transition-colors">
                                <ExternalLink size={16} className="text-primary rtl:rotate-180" /> <span>{t("post.shareVia")}</span>
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    </div>
));

// --- Main Component ---

const PostCard = ({ post, onDelete, priority, onReport }) => {
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { currentUser } = useSelector((state) => state.user);
    const { t, i18n } = useTranslation();
    const currentLocale = i18n.language === 'ar' ? ar : enUS;

    // --- Local State ---
    const [likes, setLikes] = useState(post.likes || []);
    const [sharesCount, setSharesCount] = useState(post.shares?.length || 0);
    const [isSaved, setIsSaved] = useState(post.saves?.includes(currentUser?._id) || false);
    const [displayContent, setDisplayContent] = useState(post.content);
    const [postUser, setPostUser] = useState(post.user);
    const [hasReported, setHasReported] = useState(post.reports?.includes(currentUser?._id) || false);

    // UI Toggles
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showInternalShareModal, setShowInternalShareModal] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    // Derived Values
    const isOwner = currentUser?._id === post.user?._id;
    const isLiked = currentUser && likes.includes(currentUser._id);
    const postImages = post.image_urls || post.images || (post.image ? [post.image] : []);

    // Sync user data if prop changes
    useEffect(() => {
        setPostUser(post.user);
    }, [post.user]);

    // --- Action Handlers ---

    const handleDeletePost = useCallback(async () => {
        if (!window.confirm(t("post.deleteConfirm"))) return;
        try {
            const token = await getToken();
            await api.delete(`/post/${post._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("post.deleteSuccess"));
            setShowOptionsMenu(false);
            if (onDelete) onDelete(post._id);
            else window.location.reload();
        } catch (error) {
            console.error(error);
            toast.error(t("post.deleteError"));
        }
    }, [post._id, onDelete, getToken, t]);

    const handleSavePost = useCallback(async (e) => {
        e.stopPropagation();
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
            console.error(error);
            toast.error(t("post.saveError"));
        }
    }, [isSaved, currentUser, post._id, getToken, t]);

    const handleLike = useCallback(async (e) => {
        e.stopPropagation();
        if (!currentUser) return toast.error(t("post.loginRequired"));

        setLikes(prev => {
            if (prev.includes(currentUser._id)) return prev.filter(id => id !== currentUser._id);
            return [...prev, currentUser._id];
        });

        try {
            const token = await getToken();
            await api.put(`/post/like/${post._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) { console.error(error); }
    }, [currentUser, post._id, getToken, t]);

    const handleCopyLink = useCallback(() => {
        const shareUrl = `${window.location.origin}/post/${post._id}`;
        navigator.clipboard.writeText(shareUrl);
        toast.success(t("post.linkCopied"));
        setShowOptionsMenu(false);
    }, [post._id, t]);

    const handleExternalShare = useCallback(async () => {
        setShowShareMenu(false);
        const shareUrl = `${window.location.origin}/post/${post._id}`;
        const shareData = { title: `Post by ${post.user?.full_name}`, text: post.content?.substring(0, 50) + "...", url: shareUrl };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                const token = await getToken();
                await api.put(`/post/share/${post._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                setSharesCount(prev => prev + 1);
                toast.success(t("post.shareSuccess"));
            } else {
                await navigator.clipboard.writeText(shareUrl);
                toast.success(t("post.linkCopied"));
            }
        } catch (err) {
            if (err.name !== 'AbortError') console.error("Share failed", err);
        }
    }, [post, getToken, t]);

    const handleStorySeen = useCallback(() => {
        setPostUser(prev => ({
            ...prev,
            stories: prev.stories?.map(s => ({ ...s, seen: true })) || []
        }));
    }, []);

    const renderContentWithHashtags = useCallback((content) => {
        if (!content) return { __html: "" };
        const processed = content.replace(
            /#(\w+)/g,
            '<span class="text-primary font-bold hover:underline cursor-pointer">#$1</span>'
        );
        return { __html: processed };
    }, []);

    // --- Render ---

    return (
        <div className="relative bg-surface text-content rounded-[2rem] p-5 w-full max-w-2xl mb-6 border border-adaptive transition-all duration-300 shadow-sm hover:shadow-md">

            {post.isHidden && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 bg-red-500/20 rounded-full shrink-0">
                        <ShieldAlert size={18} className="text-red-500" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-red-500">{t("post.hiddenTitle")}</span>
                        <span className="text-xs text-red-500/80">{t("post.hiddenDesc")}</span>
                    </div>
                </div>
            )}

            <PostHeader
                user={postUser}
                timestamp={post.createdAt}
                locale={currentLocale}
                isOwner={isOwner}
                isSaved={isSaved}
                hasReported={hasReported}
                showOptionsMenu={showOptionsMenu}
                setShowOptionsMenu={setShowOptionsMenu}
                onNavigateProfile={() => navigate(`/profile/${postUser?._id || post.user._id}`)}
                onStorySeen={handleStorySeen}
                onCopyLink={handleCopyLink}
                onSave={handleSavePost}
                onEdit={() => { setShowOptionsMenu(false); setShowEditModal(true); }}
                onDelete={handleDeletePost}
                onReport={() => { setShowOptionsMenu(false); setShowReportModal(true); }}
                t={t}
            />

            <div onClick={() => navigate(`/post/${post._id}`)} className="cursor-pointer">
                {displayContent && (
                    <div
                        className="text-content text-sm sm:text-[15px] whitespace-pre-line leading-relaxed mb-3"
                        dangerouslySetInnerHTML={renderContentWithHashtags(displayContent)}
                    />
                )}
                <PostMediaGrid images={postImages} priority={priority} />
            </div>

            <PostFooter
                likesCount={likes.length}
                commentsCount={post.comments?.length || 0}
                sharesCount={sharesCount}
                isLiked={isLiked}
                showShareMenu={showShareMenu}
                setShowShareMenu={setShowShareMenu}
                onLike={handleLike}
                onNavigatePost={() => navigate(`/post/${post._id}`)}
                onInternalShareClick={() => { setShowShareMenu(false); setShowInternalShareModal(true); }}
                onExternalShare={handleExternalShare}
                t={t}
            />

            {/* Lazy Loaded Modals */}
            <Suspense fallback={null}>
                <ShareModal
                    isOpen={showInternalShareModal}
                    onClose={() => setShowInternalShareModal(false)}
                    post={post}
                    onSuccess={async () => {
                        setSharesCount(p => p + 1);
                        try {
                            const token = await getToken();
                            await api.put(`/post/share/${post._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                        } catch (error) { setSharesCount(p => p - 1); }
                    }}
                />
                {showEditModal && (
                    <EditPostModal
                        isOpen={showEditModal}
                        onClose={() => setShowEditModal(false)}
                        post={post}
                        onUpdateSuccess={(newContent) => setDisplayContent(newContent)}
                    />
                )}
                {showReportModal && (
                    <ReportModal
                        postId={post._id}
                        onClose={() => setShowReportModal(false)}
                        onSuccess={() => setHasReported(true)}
                    />
                )}
            </Suspense>
        </div>
    );
};

// Optimised Memo Check
const arePropsEqual = (prev, next) => {
    return (
        prev.post._id === next.post._id &&
        prev.post.likes.length === next.post.likes.length &&
        prev.post.comments.length === next.post.comments.length &&
        prev.post.saves?.length === next.post.saves?.length &&
        prev.post.content === next.post.content &&
        prev.post.image === next.post.image &&
        prev.post.image_urls?.length === next.post.image_urls?.length &&
        prev.priority === next.priority &&
        prev.post.reports?.length === next.post.reports?.length
    );
};

export default memo(PostCard, arePropsEqual);