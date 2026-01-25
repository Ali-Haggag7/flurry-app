/**
 * SharedPostCard Component
 * ------------------------------------------------------------------
 * Renders a compact preview of a shared post within chat messages.
 * Features:
 * - Fetches post data by ID.
 * - Displays image preview or text snippet.
 * - Optimized for smooth scrolling in chat lists.
 */

import { useEffect, useState, memo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Loader2, Image as ImageIcon } from "lucide-react";

// API
import api from "../../lib/axios";

const SharedPostCard = ({ postId }) => {
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const { getToken } = useAuth();

    useEffect(() => {
        let isMounted = true; // Prevent state update on unmount

        const fetchPostPreview = async () => {
            try {
                const token = await getToken();
                const { data } = await api.get(`/post/${postId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (isMounted && data.success) {
                    setPost(data.post);
                }
            } catch (error) {
                console.error("Failed to load shared post", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (postId) fetchPostPreview();

        return () => { isMounted = false; };
    }, [postId, getToken]);

    // Loading State
    if (loading) return (
        <div className="w-full h-24 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center border border-adaptive animate-pulse my-2">
            <Loader2 className="animate-spin text-primary/50" size={20} />
        </div>
    );

    // Error / Unavailable State
    if (!post) return (
        <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 my-2">
            🚫 Post unavailable
        </div>
    );

    const hasImage = post.image_urls && post.image_urls.length > 0;
    const displayImage = hasImage ? post.image_urls[0] : null;
    const author = post.user || {};

    return (
        <Link to={`/post/${post._id}`} className="block group w-full mt-2 select-none">
            {/* Card Container */}
            <div className="bg-black/20 dark:bg-black/40 hover:bg-black/30 transition-colors border border-white/10 rounded-xl overflow-hidden shadow-sm relative backdrop-blur-sm">

                {/* Visual Header (Image or Accent Line) */}
                {hasImage ? (
                    <div className="h-32 w-full overflow-hidden relative">
                        <img
                            src={displayImage}
                            alt="Post Media"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => e.target.style.display = 'none'}
                        />
                        {post.image_urls.length > 1 && (
                            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] text-white font-medium flex items-center gap-1">
                                <ImageIcon size={10} /> +{post.image_urls.length - 1}
                            </div>
                        )}
                    </div>
                ) : (
                    // Text-only accent line
                    <div className="h-1.5 w-full bg-linear-to-r from-primary to-primary/40" />
                )}

                {/* Content Body */}
                <div className="p-3">
                    {/* Author Info */}
                    <div className="flex items-center gap-2 mb-1.5">
                        <img
                            src={author.profile_picture || "/avatar-placeholder.png"}
                            className="w-5 h-5 rounded-full object-cover ring-1 ring-white/20"
                            alt=""
                        />
                        <span className="text-xs font-bold text-white/90 truncate">{author.full_name || "Unknown"}</span>
                        <span className="text-[10px] text-white/50">• Post</span>
                    </div>

                    {/* Text Preview */}
                    <p className={`text-sm text-white/80 leading-snug ${hasImage ? "line-clamp-2" : "line-clamp-3"}`}>
                        {post.content || (hasImage ? "📷 Photo" : "")}
                    </p>
                </div>
            </div>
        </Link>
    );
};

export default memo(SharedPostCard);