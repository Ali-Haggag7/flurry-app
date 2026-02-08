/**
 * StoryPlayer Component
 * ------------------------------------------------------------------
 * Full-screen story viewer with playback controls, progress bars,
 * reply functionality, and viewer insights.
 * Optimized to isolate typing re-renders from media playback.
 */

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import { useTranslation } from "react-i18next"; // 🟢 Import translation hook
import { ar, enUS } from "date-fns/locale"; // 🟢 Import locales

// Icons
import {
    BadgeCheck, X, Trash2, Volume2, VolumeX, Eye, Loader2,
    Send, Pause, Play
} from "lucide-react";

// API
import api from "../../lib/axios";

// Constants
const REACTION_EMOJIS = [
    { char: "❤️", name: "love" },
    { char: "😂", name: "haha" },
    { char: "😮", name: "wow" },
    { char: "😢", name: "sad" },
    { char: "🔥", name: "fire" },
];

const IMAGE_DURATION = 5000;

// --- Sub-Components (Memoized) ---

// 1. Media Component (Video/Image) - Prevents re-render while typing
const StoryMedia = memo(({ activeStory, isVideo, isMuted, videoRef, onVideoEnd, fileUrl }) => {
    return (
        <div className="w-full h-full relative flex items-center justify-center bg-[#111]">
            {activeStory.type === "text" ? (
                <div
                    className="w-full h-full flex items-center justify-center p-8 text-center"
                    style={{ background: activeStory.background || activeStory.background_color || '#000' }}
                >
                    <p className="text-white text-2xl font-bold whitespace-pre-wrap">{activeStory.content}</p>
                </div>
            ) : (
                <>
                    {/* Background Blur */}
                    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden opacity-50 blur-3xl scale-125">
                        {isVideo ? (
                            <video src={fileUrl} className="w-full h-full object-cover" muted />
                        ) : (
                            <img src={fileUrl} className="w-full h-full object-cover" alt="blur-bg" />
                        )}
                    </div>
                    {/* Main Media */}
                    <div className="relative z-10 w-full h-full flex items-center justify-center">
                        {isVideo ? (
                            <video
                                ref={videoRef}
                                src={fileUrl}
                                muted={isMuted}
                                playsInline
                                className="max-w-full max-h-full object-contain pointer-events-none"
                                onEnded={onVideoEnd}
                            />
                        ) : (
                            <img
                                src={fileUrl}
                                alt="Story"
                                className="max-w-full max-h-full object-contain pointer-events-none"
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
});

// 2. Viewers Modal - Separated for cleaner code
const ViewersListModal = memo(({ show, onClose, viewers, currentUser, t, currentLocale }) => { // 🟢 Receive t & locale
    if (!show) return null;

    // Filter Logic
    const filteredViewers = viewers?.filter(v => v.user?.username !== currentUser.username) || [];

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-100 bg-black/60 backdrop-blur-sm flex items-end justify-center pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
            <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full max-w-md h-[60vh] bg-[#1a1a1a] rounded-t-3xl border-t border-white/10 overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a]">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <Eye size={20} className="text-blue-500" />
                        {t("stories.player.storyViews")} ({viewers?.length || 0}) {/* 🟢 */}
                    </h3>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white transition">
                        <X size={18} />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-[#1a1a1a]">
                    {filteredViewers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2">
                            <Eye size={40} />
                            <p>{t("stories.player.noViews")}</p> {/* 🟢 */}
                        </div>
                    ) : (
                        filteredViewers.map((viewRecord) => {
                            const viewerData = viewRecord.user;
                            if (!viewerData) return null;
                            return (
                                <div key={viewerData._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition group">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img src={viewerData?.profile_picture || "/avatar-placeholder.png"} className="w-10 h-10 rounded-full object-cover border border-white/10" alt="v" />
                                            {viewRecord.reaction && (
                                                <span className="absolute -bottom-1 -end-1 text-sm bg-[#1a1a1a] rounded-full p-0.5 border border-white/10">
                                                    {viewRecord.reaction}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium text-sm flex items-center gap-2 text-start">{viewerData?.full_name}</p> {/* 🔵 text-start */}
                                            <p className="text-white/40 text-xs text-start">@{viewerData?.username}</p> {/* 🔵 text-start */}
                                        </div>
                                    </div>
                                    <span className="text-white/30 text-xs font-medium">
                                        {formatDistanceToNowStrict(new Date(viewRecord.viewedAt), { addSuffix: true, locale: currentLocale })} {/* 🟢 Localized time */}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
});

// --- Main Component ---

const StoryPlayer = ({ viewStory, setViewStory, onClose }) => {
    // --- State ---
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showViewers, setShowViewers] = useState(false);
    const [floatingEmojis, setFloatingEmojis] = useState([]);
    const [replyText, setReplyText] = useState("");
    const [isSendingReply, setIsSendingReply] = useState(false);

    // --- Refs ---
    const videoRef = useRef(null);
    const progressRef = useRef(null);
    const animationFrameId = useRef(null);
    const startTimeRef = useRef(null);

    // --- Hooks ---
    const { getToken } = useAuth();
    const { user } = useUser();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation(); // 🟢 Hook initialization

    // --- Derived Values ---
    const activeStory = viewStory?.stories[currentIndex];
    const isVideo = activeStory?.type === 'video' || (activeStory?.type === 'media' && activeStory?.mediaUrl?.endsWith(".mp4"));
    const isMyStory = user?.username === viewStory.user.username || user?.fullName === viewStory.user.full_name;
    const fileUrl = activeStory?.image || activeStory?.mediaUrl;
    const currentLocale = i18n.language === 'ar' ? ar : enUS; // 🟢 Select locale

    // --- 1. Mark as Viewed Logic ---
    useEffect(() => {
        const markAsViewed = async () => {
            if (!activeStory?._id || activeStory.isViewed || activeStory.seen) return;

            try {
                // Optimistic Update
                activeStory.isViewed = true;
                activeStory.seen = true;

                const token = await getToken();
                await api.put(`/story/${activeStory._id}/view`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch (error) {
                console.error("Failed to mark viewed");
            }
        };
        markAsViewed();
    }, [activeStory, getToken]);

    // --- Navigation Handlers (Memoized) ---
    const handleClose = useCallback(() => {
        setViewStory(null);
        if (onClose) onClose();
    }, [setViewStory, onClose]);

    const handleNext = useCallback(() => {
        cancelAnimationFrame(animationFrameId.current);
        startTimeRef.current = null;
        if (currentIndex < viewStory.stories.length - 1) setCurrentIndex((p) => p + 1);
        else handleClose();
    }, [currentIndex, viewStory.stories.length, handleClose]);

    const handlePrev = useCallback(() => {
        cancelAnimationFrame(animationFrameId.current);
        startTimeRef.current = null;
        if (currentIndex > 0) setCurrentIndex((p) => p - 1);
    }, [currentIndex]);

    // --- Progress Logic (Kept internal for direct DOM manipulation) ---
    const updateProgress = useCallback(() => {
        if (isPaused || showViewers) return;

        if (isVideo && videoRef.current) {
            const { currentTime, duration } = videoRef.current;
            if (duration > 0 && progressRef.current) {
                progressRef.current.style.width = `${(currentTime / duration) * 100}%`;
            }
        } else if (!isVideo && progressRef.current) {
            if (!startTimeRef.current) startTimeRef.current = Date.now();
            const elapsed = Date.now() - startTimeRef.current;
            const percentage = Math.min((elapsed / IMAGE_DURATION) * 100, 100);
            progressRef.current.style.width = `${percentage}%`;
            if (elapsed >= IMAGE_DURATION) { handleNext(); return; }
        }
        animationFrameId.current = requestAnimationFrame(updateProgress);
    }, [isPaused, showViewers, isVideo, handleNext]);

    useEffect(() => {
        cancelAnimationFrame(animationFrameId.current);
        if (!isPaused && !showViewers && !startTimeRef.current && progressRef.current) progressRef.current.style.width = '0%';

        if (isPaused || showViewers) {
            if (isVideo && videoRef.current) videoRef.current.pause();
        } else {
            if (isVideo && videoRef.current) {
                videoRef.current.play().catch(() => { });
                animationFrameId.current = requestAnimationFrame(updateProgress);
            } else {
                if (!startTimeRef.current) startTimeRef.current = Date.now();
                animationFrameId.current = requestAnimationFrame(updateProgress);
            }
        }
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [currentIndex, isVideo, isPaused, showViewers, updateProgress]);

    const togglePause = useCallback((pause) => {
        if (showViewers) return;
        setIsPaused(pause);
        if (!pause && !isVideo && progressRef.current) {
            const currentWidth = parseFloat(progressRef.current.style.width || 0);
            const elapsedShouldBe = (currentWidth / 100) * IMAGE_DURATION;
            startTimeRef.current = Date.now() - elapsedShouldBe;
        }
    }, [showViewers, isVideo]);

    // --- Action Handlers ---
    const handleDeleteStory = async (e) => {
        e.stopPropagation();
        setIsPaused(true);
        if (!window.confirm(t("stories.player.deleteConfirm"))) { setIsPaused(false); return; } // 🟢
        try {
            const token = await getToken();
            await api.delete(`/story/${activeStory._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("stories.player.deletedSuccess")); // 🟢
            handleClose();
        } catch { toast.error(t("stories.player.deleteError")); setIsPaused(false); } // 🟢
    };

    const handleReaction = async (emoji) => {
        // Local Animation
        const reactionId = Date.now();
        setFloatingEmojis(prev => [...prev, { id: reactionId, char: emoji, x: Math.random() * 80 + 10 }]);
        setTimeout(() => setFloatingEmojis(prev => prev.filter(r => r.id !== reactionId)), 2000);

        // API Call
        try {
            const token = await getToken();
            await api.post(`/story/${activeStory._id}/react`, { emoji }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) { console.error("Reaction failed"); }
    };

    const handleSendReply = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!replyText.trim()) return;

        setIsSendingReply(true);
        setIsPaused(true);

        try {
            const token = await getToken();
            await api.post("/message/send", {
                receiverId: viewStory.user._id,
                text: replyText,
                storyId: activeStory._id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success(t("stories.player.replySuccess")); // 🟢
            setReplyText("");
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            setIsPaused(false);
        } catch (error) {
            console.error("Failed to send reply", error);
            toast.error(t("stories.player.replyError")); // 🟢
            setIsPaused(true);
        } finally {
            setIsSendingReply(false);
        }
    };

    if (!activeStory) return null;

    return (
        <div className="fixed inset-0 z-300 w-screen h-screen flex flex-col items-center justify-center bg-black/95 backdrop-blur-md">
            <div
                className="relative w-full h-full md:aspect-9/16 md:h-[92vh] md:w-auto md:rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/10"
                onMouseDown={() => togglePause(true)}
                onMouseUp={() => togglePause(false)}
                onTouchStart={() => togglePause(true)}
                onTouchEnd={() => togglePause(false)}
            >
                {/* --- 1. Progress Bars --- */}
                <div className="absolute top-3 start-0 w-full z-50 px-2 flex gap-1 pt-1 md:pt-0 pointer-events-none">
                    {viewStory.stories.map((_, idx) => {
                        if (idx < currentIndex) {
                            return <div key={idx} className="h-[3px] flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm"><div className="h-full w-full bg-white rounded-full" /></div>;
                        }
                        if (idx === currentIndex) {
                            return <div key={idx} className="h-[3px] flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm"><div ref={progressRef} className="h-full bg-white rounded-full will-change-[width]" style={{ width: '0%' }} /></div>;
                        }
                        return <div key={idx} className="h-[3px] flex-1 bg-white/30 rounded-full backdrop-blur-sm overflow-hidden"><div className="h-full w-0 bg-white rounded-full" /></div>;
                    })}
                </div>

                {/* --- 2. Header --- */}
                <div className="absolute top-6 start-3 flex items-center justify-between z-40 w-[calc(100%-24px)] pointer-events-none">
                    <div className="flex items-center gap-2 pointer-events-auto bg-black/20 backdrop-blur-md p-1 pe-3 rounded-full cursor-pointer hover:bg-black/40 transition" onClick={(e) => { e.stopPropagation(); handleClose(); navigate(`/profile/${viewStory.user._id}`) }}>
                        <img src={viewStory.user?.profile_picture || "/avatar-placeholder.png"} className="w-8 h-8 rounded-full border border-white/20" alt="User" />
                        <div>
                            <p className="text-white text-xs font-bold flex items-center gap-1">
                                {viewStory.user?.full_name}
                                {viewStory.user?.isVerified && <BadgeCheck size={14} className="text-primary" />}
                            </p>
                            <p className="text-white/60 text-[10px]">
                                {formatDistanceToNowStrict(new Date(activeStory.createdAt), { addSuffix: true, locale: currentLocale })} {/* 🟢 Time Ago */}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 pointer-events-auto">
                        {isVideo && (
                            <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="p-2 bg-black/20 rounded-full text-white backdrop-blur-md hover:bg-white/10">
                                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); togglePause(!isPaused); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            className="p-2 bg-black/20 rounded-full text-white backdrop-blur-md hover:bg-white/10"
                        >
                            {isPaused ? <Play size={20} /> : <Pause size={20} />}
                        </button>
                        <button onClick={handleClose} className="p-2 bg-black/20 rounded-full text-white backdrop-blur-md hover:bg-white/10">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* --- 3. Main Media (Memoized) --- */}
                <StoryMedia
                    activeStory={activeStory}
                    isVideo={isVideo}
                    isMuted={isMuted}
                    videoRef={videoRef}
                    onVideoEnd={handleNext}
                    fileUrl={fileUrl}
                />

                {/* --- 4. Caption --- */}
                {(activeStory.caption || (activeStory.type !== "text" && activeStory.content)) && (
                    <div className="absolute bottom-24 start-0 w-full px-4 z-40 text-center pointer-events-none">
                        <div className="inline-block bg-black/50 backdrop-blur-md px-4 py-2 rounded-2xl">
                            <p className="text-white font-bold text-xl drop-shadow-md shadow-black/20">{activeStory.caption || activeStory.content}</p>
                        </div>
                    </div>
                )}

                {/* --- 5. Touch Navigation Areas --- */}
                <div className="absolute inset-0 z-20 flex">
                    <div className="w-1/3 h-full" onClick={(e) => { e.stopPropagation(); handlePrev(); }}></div>
                    <div className="w-1/3 h-full"></div>
                    <div className="w-1/3 h-full" onClick={(e) => { e.stopPropagation(); handleNext(); }}></div>
                </div>

                {/* --- 6. Footer Controls --- */}
                <div className="absolute bottom-0 start-0 w-full z-50 p-4 pb-8 bg-linear-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center gap-4">
                    {/* Viewers Eye (Owner Only) */}
                    {isMyStory && (
                        <div
                            onClick={(e) => { e.stopPropagation(); setShowViewers(true); setIsPaused(true); }}
                            className="flex flex-col items-center gap-1 cursor-pointer group pointer-events-auto"
                        >
                            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 group-hover:bg-white/20 transition">
                                <Eye size={18} className="text-white" />
                                <span className="text-white font-bold text-sm">{activeStory.viewers?.length || 0}</span>
                            </div>
                            <span className="text-[10px] text-white/60">{t("stories.player.views")}</span> {/* 🟢 */}
                        </div>
                    )}

                    {/* Delete (Owner Only) */}
                    {isMyStory && (
                        <button onClick={handleDeleteStory} className="absolute end-4 bottom-8 p-3 bg-red-500/10 hover:bg-red-500/30 rounded-full text-red-500 backdrop-blur-md pointer-events-auto transition">
                            <Trash2 size={20} />
                        </button>
                    )}

                    {/* Reply & Reactions (Non-Owner) */}
                    {!isMyStory && (
                        <div className="w-full flex justify-between items-center px-2 pointer-events-auto">
                            <form
                                onSubmit={handleSendReply}
                                className="w-full flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                            >
                                <input
                                    type="text"
                                    placeholder={t("stories.player.replyPlaceholder")} // 🟢
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    className="flex-1 bg-transparent border border-white/30 rounded-full px-4 py-3 text-white placeholder-white/50 text-sm focus:outline-none focus:border-white focus:bg-white/5 transition backdrop-blur-md"
                                    onFocus={() => setIsPaused(true)}
                                    onBlur={() => { setTimeout(() => { if (!isSendingReply) setIsPaused(false); }, 200); }}
                                />
                                {replyText.trim() && (
                                    <button
                                        type="submit"
                                        disabled={isSendingReply}
                                        onMouseUp={(e) => e.stopPropagation()}
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-3 bg-white text-black rounded-full hover:scale-105 transition active:scale-95 disabled:opacity-50"
                                    >
                                        {isSendingReply ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="rtl:rotate-180" />} {/* 🟢 RTL Icon */}
                                    </button>
                                )}
                            </form>

                            {/* Emojis */}
                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide w-full mask-linear-fade">
                                {REACTION_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji.name}
                                        onClick={(e) => { e.stopPropagation(); handleReaction(emoji.char); }}
                                        className="text-4xl hover:scale-125 active:scale-90 transition-transform p-1 shrink-0"
                                    >
                                        {emoji.char}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* --- 7. Animations & Modals --- */}
                <AnimatePresence>
                    {floatingEmojis.map((r) => (
                        <motion.div
                            key={r.id}
                            initial={{ opacity: 1, y: 0, scale: 0.5 }}
                            animate={{ opacity: 0, y: -400, scale: 1.5 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="absolute bottom-20 end-10 text-5xl pointer-events-none z-60" // 🔵 right -> end-10
                            style={{ left: `${r.x}%` }} // Keeps random X position logic
                        >
                            {r.char}
                        </motion.div>
                    ))}
                </AnimatePresence>

                <AnimatePresence>
                    <ViewersListModal
                        show={showViewers}
                        onClose={() => { setShowViewers(false); setIsPaused(false); }}
                        viewers={activeStory.viewers}
                        currentUser={user}
                        t={t} // 🟢 Pass t function
                        currentLocale={currentLocale} // 🟢 Pass locale
                    />
                </AnimatePresence>
            </div>
        </div>
    );
};

export default StoryPlayer;