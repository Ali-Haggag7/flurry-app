import { useEffect, useState, useCallback, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { Feather } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢

// --- Components ---
import StoriesBar from "../components/story/StoriesBar";
import PostCard from "../components/feed/PostCard";
import PostSkeleton from "../components/skeletons/PostSkeleton";
import RecentMessages from "../components/chat/ResentMessages";
import Footer from "../components/common/Footer";

// --- Libs/Utils ---
import api from "../lib/axios";

/**
 * EmptyFeedState Component
 * Displays when the feed has no posts.
 */
const EmptyFeedState = ({ feedType, t }) => ( // 🟢 Receive t
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 text-center bg-surface rounded-3xl border border-adaptive border-dashed shadow-sm mt-8"
    >
        <div className="p-4 bg-main rounded-full mb-4">
            <Feather size={32} className="text-primary opacity-50" />
        </div>
        <h3 className="text-lg font-bold text-content">{t("feed.emptyTitle")}</h3> {/* 🟢 */}
        <p className="text-muted text-sm mt-1">
            {feedType === 'following'
                ? t("feed.emptyFollowing") // 🟢
                : t("feed.emptyForYou")} {/* 🟢 */}
        </p>
    </motion.div>
);

/**
 * Feed Component
 * ------------------------------------------------------------------
 * Main feed container. Handles data fetching, layout, and LCP prioritization.
 */
const Feed = () => {
    // --- State & Context ---
    const { feedType } = useOutletContext();
    const { getToken } = useAuth();
    const { t } = useTranslation(); // 🟢

    const [feeds, setFeeds] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- Handlers ---

    /**
     * Fetches posts based on active tab.
     * Uses AbortController to cancel stale requests on tab switch.
     */
    const fetchFeeds = useCallback(async (signal) => {
        try {
            setLoading(true);
            setFeeds([]);

            const token = await getToken();

            const { data } = await api.get("/post/feed", {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    type: feedType === "following" ? "following" : "for-you",
                    page: 1,
                    limit: 10
                },
                signal
            });

            if (!signal.aborted && data.success) {
                setFeeds(data.posts);
                setLoading(false);
            }

        } catch (error) {
            if (error.name !== 'CanceledError') {
                console.error("Feed Error:", error);
                toast.error(t("feed.loadError")); // 🟢
                setLoading(false);
            }
        }
    }, [feedType, getToken, t]);

    /**
     * Optimistic UI: Removes deleted post immediately.
     */
    const handleDeletePostFromFeed = useCallback((postId) => {
        setFeeds(prev => prev.filter(p => p._id !== postId));
    }, []);

    // --- Effects ---

    useEffect(() => {
        // Create controller to cancel previous requests if feedType changes quickly
        const controller = new AbortController();

        setLoading(true);
        fetchFeeds(controller.signal);

        return () => {
            controller.abort();
        };
    }, [fetchFeeds]);

    // --- Memoized Helpers ---
    const skeletonLoader = useMemo(() => [1, 2, 3].map((n) => <PostSkeleton key={n} />), []);

    return (
        <div className="w-full min-h-screen relative pt-[60px] bg-main">
            <div className="w-full px-2 sm:px-4 py-2">
                <div className="w-full max-w-[1350px] mx-auto flex justify-center gap-6 lg:gap-8">

                    {/* --- Middle Feed Section --- */}
                    <div className="w-full max-w-2xl flex-1 space-y-6">

                        {/* Stories Bar (Horizontal Scroll) */}
                        <StoriesBar />

                        <div className="space-y-5 min-h-[500px]">

                            {loading && (
                                <div className="space-y-5">
                                    {skeletonLoader}
                                </div>
                            )}

                            {!loading && feeds.length > 0 && (
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {feeds.map((post, index) => (
                                        <motion.div
                                            key={post._id}
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                            transition={{ duration: 0.4, delay: index === 0 ? 0 : 0.1 }}
                                        >
                                            <PostCard
                                                post={post}
                                                // Critical for LCP: Prioritize images for first 3 posts
                                                priority={index < 3}
                                                onDelete={handleDeletePostFromFeed}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}

                            {!loading && feeds.length === 0 && (
                                <EmptyFeedState feedType={feedType} t={t} /> // 🟢 Pass t
                            )}
                        </div>
                    </div>

                    {/* --- Right Sidebar Section (Desktop Only) --- */}
                    <div className="hidden xl:block w-[320px] shrink-0">
                        <div className="sticky top-20 h-[calc(100vh-100px)] flex flex-col gap-4">
                            <div className="flex-1 min-h-0 bg-surface rounded-xl border border-adaptive shadow-sm overflow-hidden">
                                <RecentMessages />
                            </div>
                            <div className="shrink-0 pb-2">
                                <Footer />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Feed;