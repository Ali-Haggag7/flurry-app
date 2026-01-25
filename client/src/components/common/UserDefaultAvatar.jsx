/**
 * UserAvatar Component
 * ------------------------------------------------------------------
 * Displays user profile image with story ring indicator.
 * Handles story viewing on click if available (and not own story).
 * Optimized to prevent unnecessary portal rendering.
 */

import { useState, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import StoryPlayer from "../story/StoryPlayer";

const UserAvatar = ({ user, className = "w-10 h-10", onCloseStory }) => {
    const [viewStory, setViewStory] = useState(null);
    const { currentUser } = useSelector((state) => state.user);

    // Derived State
    const stories = user?.stories || [];
    const isOwner = currentUser?._id === user?._id;
    const hasStories = !isOwner && stories.length > 0;

    // Memoize gradient ID to keep it stable across renders
    const gradientId = useMemo(() => `avatar-grad-${user?._id || Math.random()}`, [user?._id]);

    // Check for unseen stories
    const hasUnseen = useMemo(() => {
        if (!hasStories) return false;
        return stories.some(s => {
            const isSeen = s.seen !== undefined ? s.seen : s.isViewed;
            return isSeen === false;
        });
    }, [hasStories, stories]);

    const handleAvatarClick = (e) => {
        if (hasStories) {
            e.stopPropagation();
            setViewStory({
                user: {
                    _id: user._id,
                    username: user.username,
                    full_name: user.full_name,
                    profile_picture: user.profile_picture || user.image,
                    isVerified: user.isVerified
                },
                stories: stories.map(s => ({
                    ...s,
                    isViewed: s.seen !== undefined ? s.seen : s.isViewed
                }))
            });
        }
    };

    return (
        <>
            <div
                className={`relative inline-block shrink-0 ${className} ${hasStories ? "cursor-pointer" : ""}`}
                onClick={handleAvatarClick}
            >
                {/* Story Ring (Only if has stories & not owner) */}
                {hasStories && (
                    <svg
                        className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                        viewBox="0 0 100 100"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="var(--color-primary)" />
                                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.5" />
                            </linearGradient>
                        </defs>
                        <circle
                            cx="50" cy="50" r="48"
                            strokeWidth="5"
                            stroke={hasUnseen ? `url(#${gradientId})` : "var(--color-border)"}
                            strokeLinecap="round"
                            fill="transparent"
                        />
                    </svg>
                )}

                <img
                    src={user?.profile_picture || user?.image || "/avatar-placeholder.png"}
                    alt="user"
                    className={`
                        w-full h-full rounded-full object-cover 
                        ${hasStories ? "border-2 border-surface p-[2px]" : ""} 
                        bg-surface
                    `}
                    loading="lazy"
                />
            </div>

            {/* Story Modal (Rendered only when active) */}
            {viewStory && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <StoryPlayer
                        viewStory={viewStory}
                        setViewStory={setViewStory}
                        onClose={() => {
                            setViewStory(null);
                            if (onCloseStory) onCloseStory();
                        }}
                    />
                </div>,
                document.body
            )}
        </>
    );
};

export default memo(UserAvatar);