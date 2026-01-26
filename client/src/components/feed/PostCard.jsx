/**
 * PostCard Component
 * ------------------------------------------------------------------
 * Renders a single social media post with interactions.
 * Features media handling, user actions, and optimized rendering.
 */

import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { formatDistanceToNowStrict } from "date-fns";
import { AnimatePresence } from "framer-motion";

// Icons
import {
    BadgeCheck, Heart, MessageCircle, Share2, Link2, Trash2, Send,
    Flag, ExternalLink, MoreHorizontal, Bookmark, PenLine, ShieldAlert
} from "lucide-react";

// Components & Utils
import api from "../../lib/axios";
import { optimizeImage } from "../../utils/imageOptimizer";
import UserAvatar from "../common/UserDefaultAvatar";
import ShareModal from "../modals/ShareModal";
import EditPostModal from "../modals/EditPostModal";
import ReportModal from "../modals/ReportModal";

const PostCard = ({ post, onDelete, priority, onReport }) => {
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { currentUser } = useSelector((state) => state.user);

    // --- Local State ---
    const [likes, setLikes] = useState(post.likes || []);
    const [sharesCount, setSharesCount] = useState(post.shares?.length || 0);
    const [isSaved, setIsSaved] = useState(post.saves?.includes(currentUser?._id) || false);
    const [displayContent, setDisplayContent] = useState(post.content);
    const [postUser, setPostUser] = useState(post.user);

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

    // --- Action Handlers (Memoized) ---

    // 1. Delete Post
    const handleDeletePost = useCallback(async () => {
        if (!window.confirm("Are you sure you want to delete this post?")) return;
        try {
            const token = await getToken();
            await api.delete(`/post/${post._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Post deleted successfully");
            setShowOptionsMenu(false);
            if (onDelete) onDelete(post._id);
            else window.location.reload();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete post");
        }
    }, [post._id, onDelete, getToken]);

    // 2. Toggle Save (Optimistic)
    const handleSavePost = useCallback(async (e) => {
        e.stopPropagation();
        if (!currentUser) return toast.error("Please login first");

        const oldIsSaved = isSaved;
        setIsSaved(!isSaved); // Immediate UI update
        setShowOptionsMenu(false);
        toast.success(!isSaved ? "Post Saved 💾" : "Removed from Saved");

        try {
            const token = await getToken();
            await api.put(`/post/save/${post._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
            setIsSaved(oldIsSaved); // Rollback on error
            console.error(error);
            toast.error("Failed to save post");
        }
    }, [isSaved, currentUser, post._id, getToken]);

    // 3. Toggle Like (Optimistic)
    const handleLike = useCallback(async (e) => {
        e.stopPropagation();
        if (!currentUser) return toast.error("Please login first");

        // Optimistic Update
        setLikes(prev => {
            if (prev.includes(currentUser._id)) return prev.filter(id => id !== currentUser._id);
            return [...prev, currentUser._id];
        });

        try {
            const token = await getToken();
            await api.put(`/post/like/${post._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
            console.error(error);
        }
    }, [currentUser, post._id, getToken]);

    // 4. Copy Link
    const handleCopyLink = useCallback(() => {
        const shareUrl = `${window.location.origin}/post/${post._id}`;
        navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard");
        setShowOptionsMenu(false);
    }, [post._id]);

    // 5. External Share
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
                toast.success("Thanks for sharing! 🚀");
            } else {
                await navigator.clipboard.writeText(shareUrl);
                toast.success("Link copied! 📋");
            }
        } catch (err) {
            if (err.name !== 'AbortError') console.error("Share failed", err);
        }
    }, [post, getToken]);

    // 6. Update Story Status (Local UI only)
    const handleStorySeen = useCallback(() => {
        setPostUser(prev => ({
            ...prev,
            stories: prev.stories?.map(s => ({ ...s, seen: true })) || []
        }));
    }, []);

    // --- Render Helpers ---
    const renderContentWithHashtags = (content) => {
        if (!content) return { __html: "" };
        const processed = content.replace(
            /#(\w+)/g,
            '<span class="text-primary font-bold hover:underline cursor-pointer">#$1</span>'
        );
        return { __html: processed };
    };

    return (
        <div className="relative bg-surface text-content rounded-2xl p-5 w-full max-w-2xl mb-6 border border-black/5 dark:border-white/5 transition-all duration-300 shadow-sm hover:shadow-md">

            {/* Hidden Post Warning */}
            {post.isHidden && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 bg-red-500/20 rounded-full shrink-0">
                        <ShieldAlert size={18} className="text-red-500" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-red-500">Post Hidden</span>
                        <span className="text-xs text-red-500/80">This post is hidden from others due to community reports.</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-3 cursor-pointer group">
                    <UserAvatar
                        user={postUser}
                        className="w-11 h-11"
                        onCloseStory={handleStorySeen}
                    />
                    <div onClick={() => navigate(`/profile/${postUser?._id || post.user._id}`)}>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-content group-hover:text-primary transition text-[15px]">
                                {postUser?.full_name || "User"}
                            </span>
                            {(post.user?.isVerified || postUser?.isVerified) && (
                                <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                            )}
                        </div>
                        <div className="text-muted text-xs font-medium">
                            @{postUser?.username || "username"} • {formatDistanceToNowStrict(new Date(post.createdAt))}
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

                    {showOptionsMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowOptionsMenu(false)}></div>
                            <div className="absolute right-0 top-full mt-2 w-40 bg-main rounded-xl border border-black/5 dark:border-white/10 shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <button onClick={handleCopyLink} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-surface transition-colors border-b border-black/5 dark:border-white/5">
                                    <Link2 size={16} /> <span>Copy Link</span>
                                </button>
                                <button onClick={handleSavePost} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-surface transition-colors border-b border-black/5 dark:border-white/5">
                                    <Bookmark size={16} className={isSaved ? "fill-primary text-primary" : ""} />
                                    <span>{isSaved ? "Unsave Post" : "Save Post"}</span>
                                </button>
                                {isOwner ? (
                                    <>
                                        <button onClick={(e) => { e.stopPropagation(); setShowOptionsMenu(false); setShowEditModal(true); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-surface transition-colors border-b border-black/5 dark:border-white/5">
                                            <PenLine size={16} /> <span>Edit</span>
                                        </button>
                                        <button onClick={handleDeletePost} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                                            <Trash2 size={16} /> <span>Delete</span>
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={(e) => { e.stopPropagation(); setShowOptionsMenu(false); setShowReportModal(true); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-amber-500 hover:bg-amber-500/20 transition-colors">
                                        <Flag size={16} /> <span>Report</span>
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Post Content */}
            <div onClick={() => navigate(`/post/${post._id}`)} className="cursor-pointer">
                {displayContent && (
                    <div
                        className="text-content text-sm sm:text-[15px] whitespace-pre-line leading-relaxed mb-3"
                        dangerouslySetInnerHTML={renderContentWithHashtags(displayContent)}
                    />
                )}

                {/* Images Grid */}
                {postImages.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 mt-3">

                        {/* CASE 1: Single Image */}
                        {postImages.length === 1 && (
                            <div className="w-full h-auto overflow-hidden cursor-zoom-in group">
                                <img
                                    src={optimizeImage(postImages[0], 600)}
                                    alt="Post content"
                                    className="w-full h-auto max-h-[600px] object-cover group-hover:scale-105 transition duration-500"
                                    loading={priority ? "eager" : "lazy"}
                                />
                            </div>
                        )}

                        {/* CASE 2: Two Images (Side by Side) */}
                        {postImages.length === 2 && (
                            <div className="grid grid-cols-2 gap-0.5 h-[300px]">
                                {postImages.map((img, i) => (
                                    <div key={i} className="overflow-hidden cursor-pointer h-full group">
                                        <img
                                            src={optimizeImage(img, 400)}
                                            alt={`Slide ${i}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* CASE 3: Three Images (2 Top, 1 Bottom Big) */}
                        {postImages.length === 3 && (
                            <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-[400px]">

                                {/* الصورة الأولى (فوق شمال) */}
                                <div className="overflow-hidden cursor-pointer h-full group">
                                    <img
                                        src={optimizeImage(postImages[0], 400)}
                                        alt="Top Left"
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                    />
                                </div>

                                {/* الصورة الثانية (فوق يمين) */}
                                <div className="overflow-hidden cursor-pointer h-full group">
                                    <img
                                        src={optimizeImage(postImages[1], 400)}
                                        alt="Top Right"
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                    />
                                </div>

                                {/* الصورة الثالثة (تحت واخدة العرض كله) */}
                                <div className="col-span-2 overflow-hidden cursor-pointer h-full group">
                                    <img
                                        src={optimizeImage(postImages[2], 600)}
                                        alt="Bottom Full"
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                    />
                                </div>

                            </div>
                        )}

                        {/* CASE 4+: Four or more Images (Grid) */}
                        {postImages.length >= 4 && (
                            <div className="grid grid-cols-2 gap-0.5 h-[400px]">
                                {postImages.slice(0, 4).map((img, i) => (
                                    <div key={i} className="relative overflow-hidden cursor-pointer h-full group">
                                        <img
                                            src={optimizeImage(img, 300)}
                                            alt={`Slide ${i}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                        />
                                        {/* Overlay for +More images on the last one */}
                                        {i === 3 && postImages.length > 4 && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <span className="text-white text-xl font-bold">+{postImages.length - 4}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 mt-2 px-2 border-t border-adaptive">
                <div className="flex items-center gap-4">
                    <button onClick={handleLike} aria-label="Like" className="group flex items-center gap-1.5 focus:outline-none transition-all">
                        <Heart size={22} className={`transition-all duration-300 group-hover:scale-110 ${isLiked ? "text-primary fill-primary drop-shadow-[0_0_8px_rgba(var(--color-primary),0.4)]" : "text-muted group-hover:text-primary"}`} />
                        <span className={`text-sm font-medium transition-colors ${isLiked ? "text-primary" : "text-muted"}`}>{likes.length || 0}</span>
                    </button>
                    <button onClick={() => navigate(`/post/${post._id}`)} aria-label="Comment" className="group flex items-center gap-1.5 focus:outline-none transition-all">
                        <MessageCircle size={22} className="text-muted transition-all duration-300 group-hover:text-primary group-hover:scale-110" />
                        <span className="text-sm font-medium text-muted group-hover:text-primary transition-colors">{post.comments?.length || 0}</span>
                    </button>
                </div>

                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setShowShareMenu(!showShareMenu); }} aria-label="Share" className="group flex items-center gap-1.5 focus:outline-none transition-all">
                        <span className={`text-sm font-medium transition-colors ${sharesCount > 0 ? "text-primary" : "text-muted group-hover:text-primary"}`}>{sharesCount > 0 ? sharesCount : "Share"}</span>
                        <Share2 size={22} className={`transition-all duration-300 group-hover:scale-110 ${sharesCount > 0 ? "text-primary" : "text-muted group-hover:text-primary"}`} />
                    </button>
                    {showShareMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)}></div>
                            <div className="absolute right-0 bottom-full mb-3 w-48 bg-surface rounded-xl border border-adaptive shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <button onClick={() => { setShowShareMenu(false); setShowInternalShareModal(true); }} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-content hover:bg-main transition-colors border-b border-adaptive">
                                    <Send size={16} className="text-primary" /> <span>Send in App</span>
                                </button>
                                <button onClick={handleExternalShare} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-content hover:bg-main transition-colors">
                                    <ExternalLink size={16} className="text-primary" /> <span>Share via...</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            <ShareModal
                isOpen={showInternalShareModal}
                onClose={() => setShowInternalShareModal(false)}
                post={post}
                onSuccess={async () => {
                    // 1. تحديث الـ UI لحظياً
                    setSharesCount(p => p + 1);

                    // 2. تحديث الداتابيز (ده اللي كان ناقص)
                    try {
                        const token = await getToken();
                        await api.put(`/post/share/${post._id}`, {}, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                    } catch (error) {
                        console.error("Failed to update share count", error);
                        // لو فشل ممكن ترجع تنقص العدد تاني لو حابب الدقة أوي
                        setSharesCount(p => p - 1);
                    }
                }}
            />
            <EditPostModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} post={post} onUpdateSuccess={(newContent) => setDisplayContent(newContent)} />
            <AnimatePresence>
                {showReportModal && <ReportModal postId={post._id} onClose={() => setShowReportModal(false)} />}
            </AnimatePresence>
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

        prev.priority === next.priority
    );
};

export default memo(PostCard, arePropsEqual);