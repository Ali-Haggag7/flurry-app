/**
 * StoriesBar Component (LCP Optimized)
 * ------------------------------------------------------------------
 * Fixes: LCP request discovery issue by prioritizing the first few stories.
 * Strategy: Eager load images for the first 4 items, lazy load the rest.
 */

import { useState, useEffect, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next"; // 🟢 Import translation hook

// API
import api from "../../lib/axios";

// Components
import StoryWindow from "./StoryWindow";
import StoryPlayer from "./StoryPlayer";
import StoryRing from "./StoryRing";

// --- Sub-Components ---

const AddStoryButton = memo(({ onClick, t }) => { // 🟢 Receive t prop
    return (
        <motion.div
            onClick={onClick}
            className="shrink-0 flex flex-col items-center pt-1 cursor-pointer gap-2 group z-10"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            <div className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-[3px] border-primary/30 group-hover:border-primary transition-colors duration-300"></div>
                <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center border-[3px] border-surface z-10 overflow-hidden relative">
                    <div className="w-full h-full bg-surface flex items-center justify-center transition-colors">
                        <Plus className="w-8 h-8 text-primary transition-transform group-hover:scale-110" strokeWidth={2.5} />
                    </div>
                </div>
                <div className="absolute bottom-0 end-0 bg-primary text-white rounded-full p-1 border-[3px] border-surface shadow-md z-20">
                    <Plus size={12} strokeWidth={4} />
                </div>
            </div>
            {/* 🟢 Translated Label */}
            <p className="text-xs text-content font-semibold group-hover:text-primary transition-colors">
                {t("stories.yourStory")}
            </p>
        </motion.div>
    );
});

const StoryItem = memo(({ story, onView, index, t }) => { // 🟢 Receive t prop
    // Optimization: Prioritize the first 4 visible stories for LCP
    const isPriority = index < 4;

    return (
        <motion.div
            className="shrink-0 flex flex-col items-center cursor-pointer gap-2 z-10"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
                onView(story);
            }}
        >
            <div className="pointer-events-none">
                <StoryRing stories={story.stories} userId={story.user._id}>
                    <img
                        src={story.user.profile_picture || "/avatar-placeholder.png"}
                        className="w-full h-full object-cover rounded-full"
                        alt={`${story.user.username}'s story`}

                        // LCP Optimization Attributes
                        // 1. Eager load if it's in the viewport (first 4)
                        // 2. High fetch priority signals the browser to download these immediately
                        loading={isPriority ? "eager" : "lazy"}
                        fetchPriority={isPriority ? "high" : "auto"}
                    />
                </StoryRing>
            </div>

            <p className={`text-xs font-medium truncate w-16 text-center ${story.hasUnseen ? 'text-content font-bold' : 'text-muted'}`}>
                {/* 🟢 Translated Default User Name */}
                {story.user.username?.split(' ')[0] || t("stories.defaultUser")}
            </p>
        </motion.div>
    );
});

// --- Main Component ---

const StoriesBar = () => {
    const [stories, setStories] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [viewStory, setViewStory] = useState(null);
    const { getToken } = useAuth();
    const { t } = useTranslation(); // 🟢 Hook initialization

    const fetchStories = useCallback(async () => {
        try {
            const token = await getToken();
            const { data } = await api.get("/story/feed", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data.success) {
                setStories(data.stories);
            }
        } catch (error) {
            console.error("Failed to fetch stories:", error);
        }
    }, [getToken]);

    const handleViewStory = useCallback((story) => {
        setViewStory(story);
    }, []);

    useEffect(() => {
        fetchStories();
    }, [fetchStories]);

    return (
        <>
            <div className="w-full bg-surface/80 backdrop-blur-xl border-b border-adaptive py-5 rounded-b-2xl mb-6 shadow-sm relative z-0">
                <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide px-4 pb-2">
                    {/* 🟢 Pass t function to children */}
                    <AddStoryButton onClick={() => setShowModal(true)} t={t} />

                    {stories?.map((story, index) => (
                        <StoryItem
                            key={story.user._id}
                            story={story}
                            index={index} // Passing index to determine LCP priority
                            onView={handleViewStory}
                            t={t} // 🟢 Pass t function
                        />
                    ))}
                </div>

                {/* Create Story Modal */}
                {showModal && createPortal(
                    <StoryWindow setShowModal={setShowModal} fetchStories={fetchStories} />,
                    document.body
                )}

                {/* View Story Modal */}
                {viewStory && createPortal(
                    <motion.div
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <StoryPlayer
                            viewStory={viewStory}
                            setViewStory={setViewStory}
                            onClose={() => {
                                setViewStory(null);
                                fetchStories();
                            }}
                        />
                    </motion.div>,
                    document.body
                )}
            </div>
        </>
    );
};

export default memo(StoriesBar);