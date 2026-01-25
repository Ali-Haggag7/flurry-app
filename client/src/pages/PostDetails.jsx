/**
 * PostDetails Page
 * ------------------------------------------------------------------
 * Detailed view of a single post with nested comments system.
 * * Architecture:
 * - Decomposed into memoized sub-components (Header, Content, Media, Stats, Input).
 * - Optimistic UI updates for high-latency actions (Like, Save, Delete).
 * - Virtualized-style state management for deep comment trees.
 * - Strict Theme System compliance (bg-main, text-content, border-adaptive).
 */

import { useEffect, useState, useMemo, useRef, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

// --- Icons ---
import {
    ArrowLeft, MessageCircle, Send, X, Maximize2, Loader2, Share2,
    MoreHorizontal, ExternalLink, Link2, Bookmark, PenLine, Trash2, Flag
} from "lucide-react";

// --- API & Utils ---
import api from "../lib/axios";
import { buildCommentTree } from "../utils/buildCommentTree";

// --- Components ---
import CommentItem from "../components/feed/CommentItem";
import UserAvatar from "../components/common/UserDefaultAvatar";
import ShareModal from "../components/modals/ShareModal";
import EditPostModal from "../components/modals/EditPostModal";
import ReportModal from "../components/modals/ReportModal";

// --- Helpers ---

// Recursive State Update for Replies (Preserved)
const addReplyToState = (comments, parentId, newReply) => {
    return comments.map(comment => {
        if (comment._id === parentId) {
            return { ...comment, children: [...(comment.children || []), newReply] };
        }
        if (comment.children && comment.children.length > 0) {
            return { ...comment, children: addReplyToState(comment.children, parentId, newReply) };
        }
        return comment;
    });
};

// Recursive Deletion (Preserved)
const getFamilyIds = (parentId, allComments) => {
    let ids = [parentId];
    const children = allComments.filter(c => c.parentId === parentId);
    children.forEach(child => { ids = [...ids, ...getFamilyIds(child._id, allComments)]; });
    return ids;
};

// --- Sub-Components (Local & Memoized) ---

/**
 * PostHeader: Navigation and Options Menu
 */
const PostHeader = memo(({
    navigate, post, isOwner, isSaved,
    showOptionsMenu, setShowOptionsMenu,
    onCopyLink, onSave, onDelete, onEdit, onReport
}) => (
    <div className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl border-b border-adaptive px-4 py-3 flex items-center gap-4 shadow-sm transition-all duration-300">
        <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="p-2 hover:bg-main rounded-full transition active:scale-95 text-content group"
        >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="flex-1">
            <h1 className="text-base font-bold text-content leading-tight">Post Details</h1>
            <p
                className="text-xs text-muted font-medium cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate(`/profile/${post?.user?._id}`)}
            >
                By @{post?.user?.username || "username"}
            </p>
        </div>

        {/* Options Menu */}
        <div className="relative ml-auto">
            <button
                onClick={(e) => { e.stopPropagation(); setShowOptionsMenu(!showOptionsMenu); }}
                className="p-2 hover:bg-main rounded-full text-muted hover:text-content transition"
            >
                <MoreHorizontal size={20} />
            </button>

            <AnimatePresence>
                {showOptionsMenu && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowOptionsMenu(false)}></div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute right-0 top-full mt-2 w-48 bg-surface rounded-xl border border-adaptive shadow-xl z-50 overflow-hidden"
                        >
                            <button onClick={onCopyLink} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-main transition-colors border-b border-adaptive">
                                <Link2 size={16} /> <span>Copy Link</span>
                            </button>
                            <button onClick={onSave} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-main transition-colors border-b border-adaptive">
                                <Bookmark size={16} className={isSaved ? "fill-primary text-primary" : ""} />
                                <span>{isSaved ? "Unsave Post" : "Save Post"}</span>
                            </button>
                            {isOwner ? (
                                <>
                                    <button onClick={onEdit} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-main transition-colors border-b border-adaptive">
                                        <PenLine size={16} /> <span>Edit</span>
                                    </button>
                                    <button onClick={onDelete} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                                        <Trash2 size={16} /> <span>Delete</span>
                                    </button>
                                </>
                            ) : (
                                <button onClick={onReport} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-amber-500 hover:bg-amber-500/20 transition-colors">
                                    <Flag size={16} /> <span>Report</span>
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
 * PostMedia: Handles the image grid display
 */
const PostMedia = memo(({ images, onSelectImage }) => {
    if (!images?.length) return null;

    return (
        <div className={`grid gap-2 rounded-2xl overflow-hidden mt-3 mb-5 border border-adaptive ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {images.map((img, idx) => (
                <div
                    key={idx}
                    className={`relative group cursor-pointer overflow-hidden bg-main ${(images.length % 2 !== 0 && idx === images.length - 1) ? 'col-span-2 h-[400px]' : 'h-64 sm:h-80'}`}
                    onClick={() => onSelectImage(img)}
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
 * StatsBar: Likes, Comments, Shares interaction
 */
const StatsBar = memo(({
    commentsCount, shares, currentUser, post,
    showShareMenu, setShowShareMenu, showInternalShareModal, setShowInternalShareModal,
    onExternalShare, incrementShareCount
}) => (
    <div className="pt-4 border-t border-adaptive flex items-center justify-between text-sm text-muted">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-main rounded-full border border-adaptive">
            <MessageCircle size={16} className="text-primary" />
            <span className="font-bold text-content">{commentsCount}</span> Comments
        </div>
        <div className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setShowShareMenu(!showShareMenu); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 ${showShareMenu ? "bg-primary text-white" : "hover:bg-main text-muted hover:text-primary"}`}
            >
                <Share2 size={18} />
                {shares?.length > 0 && <span className="font-bold">{shares.length}</span>}
            </button>

            <AnimatePresence>
                {showShareMenu && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)}></div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 bottom-full mb-2 w-48 bg-surface rounded-xl border border-adaptive shadow-xl z-20 overflow-hidden"
                        >
                            <button onClick={() => { setShowShareMenu(false); setShowInternalShareModal(true); }} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-content hover:bg-main transition-colors border-b border-adaptive">
                                <Send size={16} className="text-primary" /> <span>Send in App</span>
                            </button>
                            <button onClick={onExternalShare} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-content hover:bg-main transition-colors">
                                <ExternalLink size={16} className="text-primary" /> <span>Share via...</span>
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
        <ShareModal
            isOpen={showInternalShareModal}
            onClose={() => setShowInternalShareModal(false)}
            post={post}
            onSuccess={incrementShareCount}
        />
    </div>
));

/**
 * CommentInput: Fixed bottom bar
 */
const CommentInput = memo(({
    currentUser, commentText, submitting, textareaRef,
    onInput, onSubmit
}) => (
    <div className="fixed bottom-0 left-0 md:left-20 right-0 p-4 bg-gradient-to-t from-main via-main/95 to-transparent z-40">
        <div className="max-w-3xl mx-auto flex items-end gap-3 bg-surface/90 backdrop-blur-xl p-2 rounded-4xl border border-adaptive shadow-2xl">
            <div className="shrink-0 mb-1 ml-1">
                <UserAvatar user={currentUser} className="w-9 h-9 border border-adaptive rounded-full" />
            </div>
            <div className="flex-1 bg-main/50 rounded-3xl flex items-center border border-transparent focus-within:border-primary/50 focus-within:bg-main focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300">
                <textarea
                    ref={textareaRef}
                    value={commentText}
                    onInput={onInput}
                    placeholder="Add a comment..."
                    className="w-full bg-transparent text-content py-3 px-4 max-h-32 min-h-[44px] resize-none focus:outline-none text-[15px] placeholder-muted/70 leading-relaxed custom-scrollbar"
                    rows={1}
                />
                <button
                    onClick={() => onSubmit(commentText, null)}
                    disabled={submitting || !commentText.trim()}
                    className="p-2.5 mr-1.5 text-white bg-primary hover:opacity-90 rounded-full disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground transition-all shadow-md active:scale-95 self-end mb-1.5"
                >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                </button>
            </div>
        </div>
    </div>
));

/**
 * Lightbox: Full screen image viewer
 */
const Lightbox = ({ selectedImage, onClose }) => (
    <AnimatePresence>
        {selectedImage && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
                onClick={onClose}
            >
                <button onClick={onClose} className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition active:scale-90">
                    <X size={24} />
                </button>
                <motion.img
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    src={selectedImage}
                    alt="Full Screen"
                    className="max-w-full max-h-[90vh] object-contain shadow-2xl rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                />
            </motion.div>
        )}
    </AnimatePresence>
);

// --- Main Component ---

const PostDetails = () => {
    // --- Hooks ---
    const { id: postId } = useParams();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const textareaRef = useRef(null);
    const { currentUser } = useSelector((state) => state.user);

    // --- State ---
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [comments, setComments] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);

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

                    // Deduplicate comments
                    const uniqueComments = [...new Map((data.comments || data.post.comments || []).map(item => [item._id, item])).values()];
                    setComments(uniqueComments);
                }
            } catch (error) {
                console.error("Fetch Error:", error);
                toast.error("Failed to load post.");
                if (isMounted) navigate("/");
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (postId) fetchPost();

        return () => { isMounted = false; };
    }, [postId, getToken, currentUser, navigate]);

    // --- Handlers (Memoized) ---

    // 1. Post Actions
    const handleSavePost = useCallback(async () => {
        if (!currentUser) return toast.error("Please login first");

        const oldIsSaved = isSaved;
        setIsSaved(!isSaved); // Optimistic
        setShowOptionsMenu(false);
        toast.success(!isSaved ? "Post Saved 💾" : "Removed from Saved");

        try {
            const token = await getToken();
            await api.put(`/post/save/${post._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
            setIsSaved(oldIsSaved);
            toast.error("Failed to save post");
        }
    }, [isSaved, currentUser, post, getToken]);

    const handleDeletePost = useCallback(async () => {
        if (!window.confirm("Are you sure you want to delete this post?")) return;
        try {
            const token = await getToken();
            await api.delete(`/post/${post._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Post deleted successfully");
            navigate("/");
        } catch (error) { toast.error("Failed to delete post"); }
    }, [post, getToken, navigate]);

    const handleCopyLink = useCallback(() => {
        const shareUrl = `${window.location.origin}/post/${post._id}`;
        navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard");
        setShowOptionsMenu(false);
    }, [post]);

    // 2. Share Actions
    const incrementShareCount = useCallback(async () => {
        try {
            const token = await getToken();
            await api.put(`/post/share/${post._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setPost(prev => ({
                ...prev,
                shares: [...(prev.shares || []), currentUser._id]
            }));
        } catch (error) { console.error("Failed to record share"); }
    }, [post, currentUser, getToken]);

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
                toast.success("Thanks for sharing! 🚀");
            } else {
                await navigator.clipboard.writeText(shareUrl);
                await incrementShareCount();
                toast.success("Link copied! 📋");
            }
        } catch (err) { if (err.name !== 'AbortError') toast.error("Failed to share"); }
    }, [post, incrementShareCount]);

    // 3. Comment Actions
    const handleAddComment = useCallback(async (text, parentId = null) => {
        if (!text || !text.trim()) return toast.error("Comment cannot be empty.");

        setSubmitting(true);
        try {
            const token = await getToken();
            const { data } = await api.post(`/post/comment/${postId}`, { text, parentId }, { headers: { Authorization: `Bearer ${token}` } });

            if (data.success) {
                toast.success(parentId ? "Reply added!" : "Comment added!");
                setComments(prev => [...prev, data.comment]);

                if (!parentId) {
                    setCommentText("");
                    if (textareaRef.current) textareaRef.current.style.height = 'auto';
                }
            }
        } catch (error) { toast.error("Failed to add comment."); }
        finally { setSubmitting(false); }
    }, [postId, getToken]);

    const handleDeleteComment = useCallback(async (commentId) => {
        if (!window.confirm("Delete this comment?")) return;

        const idsToDelete = getFamilyIds(commentId, comments);
        const oldComments = [...comments];
        setComments(prev => prev.filter(c => !idsToDelete.includes(c._id)));

        try {
            const token = await getToken();
            await api.delete(`/post/comment/${commentId}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Comment deleted");
        } catch (error) {
            setComments(oldComments);
            toast.error("Failed to delete comment");
        }
    }, [comments, getToken]);

    const handleEditComment = useCallback(async (commentId, newText) => {
        setComments(prev => prev.map(c => c._id === commentId ? { ...c, text: newText, isEdited: true } : c));
        try {
            const token = await getToken();
            await api.put(`/post/comment/${commentId}`, { text: newText }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Comment updated");
        } catch (error) { toast.error("Failed to update comment"); }
    }, [getToken]);

    const handleLikeComment = useCallback(async (commentId) => {
        if (!currentUser) return toast.error("Please login first");
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
    }, [currentUser, getToken]);

    const handleTextareaInput = useCallback((e) => {
        setCommentText(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    }, []);

    // --- Render ---

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
            />

            <div className="max-w-3xl mx-auto p-4 space-y-6">

                {/* Main Post Article */}
                <motion.article
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surface rounded-4xl p-6 border border-adaptive shadow-sm transition-colors duration-300 relative overflow-hidden"
                >
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3 cursor-pointer group">
                            <UserAvatar user={post.user} className="w-12 h-12 border border-adaptive rounded-full group-hover:border-primary transition-colors" />
                            <div onClick={() => navigate(`/profile/${post?.user?._id}`)}>
                                <h3 className="font-bold text-[16px] text-content group-hover:text-primary transition-colors flex items-center gap-1">{post?.user?.full_name}</h3>
                                <div className="text-muted text-xs font-medium">@{post?.user?.username || "username"} • {formatDistanceToNow(new Date(post.createdAt))}</div>
                            </div>
                        </div>
                    </div>

                    <p className="text-content/90 whitespace-pre-wrap text-[16px] leading-7 mb-5 font-normal tracking-wide">
                        {post?.content}
                    </p>

                    <PostMedia
                        images={post?.image_urls}
                        onSelectImage={setSelectedImage}
                    />

                    <StatsBar
                        commentsCount={comments.length}
                        shares={post.shares}
                        currentUser={currentUser}
                        post={post}
                        showShareMenu={showShareMenu}
                        setShowShareMenu={setShowShareMenu}
                        showInternalShareModal={showInternalShareModal}
                        setShowInternalShareModal={setShowInternalShareModal}
                        onExternalShare={handleExternalShare}
                        incrementShareCount={incrementShareCount}
                    />
                </motion.article>

                {/* Discussion Section */}
                <div className="space-y-6 pb-4">
                    <h3 className="text-xs font-black text-muted uppercase tracking-[0.2em] pl-4 border-l-4 border-primary">
                        Discussion ({comments.length})
                    </h3>

                    {commentsTree.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center bg-surface/50 rounded-4xl border border-adaptive border-dashed">
                            <div className="p-5 bg-main rounded-full mb-4 shadow-sm">
                                <MessageCircle className="w-10 h-10 text-muted/50" />
                            </div>
                            <p className="text-content font-bold text-lg">No comments yet</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {commentsTree.map((rootComment) => (
                                <CommentItem
                                    key={rootComment._id}
                                    comment={rootComment}
                                    currentUser={currentUser}
                                    postOwnerId={post?.user?._id}
                                    addReply={handleAddComment}
                                    onLike={handleLikeComment}
                                    onDelete={handleDeleteComment}
                                    onEdit={handleEditComment}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <CommentInput
                currentUser={currentUser}
                commentText={commentText}
                submitting={submitting}
                textareaRef={textareaRef}
                onInput={handleTextareaInput}
                onSubmit={handleAddComment}
            />

            <Lightbox
                selectedImage={selectedImage}
                onClose={() => setSelectedImage(null)}
            />

            {/* Modals */}
            <EditPostModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                post={post}
                onUpdateSuccess={(newContent) => setPost(prev => ({ ...prev, content: newContent }))}
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