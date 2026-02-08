/**
 * StoryRing Component
 * ------------------------------------------------------------------
 * Renders a segmented SVG ring around a user avatar.
 * Segments indicate the number of stories.
 * Colors change based on viewed/unviewed status.
 */

import { useMemo, memo } from "react";

const StoryRing = ({ stories, userId, children }) => {
    // Unique ID for the gradient to prevent DOM conflicts
    const gradientId = `gradient-${userId}`;

    // --- Geometry Calculations (Memoized) ---
    // Calculates the ring segments based on the number of stories.
    // Only recalculates when the number of stories changes.
    const {
        size,
        center,
        radius,
        strokeWidth,
        circumference,
        segmentLength,
        anglePerSegment
    } = useMemo(() => {
        const size = 72; // Width/Height of the SVG
        const strokeWidth = 3;
        const center = size / 2;

        // Radius adjusted to sit perfectly outside the avatar with padding
        const radius = (center - strokeWidth / 2) - 1.3;
        const circumference = 2 * Math.PI * radius;

        const count = stories.length;
        // Add gaps only if there is more than one story
        const gap = count > 1 ? 4 : 0;
        const totalGap = gap * (count + 1.5); // 1.5 multiplier smoothes the gap visual

        const segmentLength = Math.max(0, (circumference - totalGap) / count);
        const anglePerSegment = 360 / count;

        return { size, center, radius, strokeWidth, circumference, segmentLength, anglePerSegment };
    }, [stories.length]);

    return (
        <div className="relative w-[72px] h-[72px] flex items-center justify-center cursor-pointer hover:scale-105 transition-transform duration-300 group">

            {/* SVG Ring Layer */}
            <svg
                width={size}
                height={size}
                className="absolute top-0 start-0 z-10 pointer-events-none"
                viewBox={`0 0 ${size} ${size}`}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--color-primary)" />
                        <stop offset="100%" stopColor="var(--color-primary)" />
                    </linearGradient>
                </defs>

                {stories.map((story, index) => {
                    // Calculate rotation: Starts at -90deg (12 o'clock)
                    // Added +6deg offset to center segments visually due to round linecaps
                    const rotate = (index * anglePerSegment) - 90 + 6;

                    // Determine segment color (Gray if seen, Primary Gradient if new)
                    const isSeen = story.isViewed || story.seen;
                    const strokeColor = isSeen ? "#64748b" : `url(#${gradientId})`;

                    return (
                        <circle
                            key={story._id || index}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="transparent"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            stroke={strokeColor}
                            // dasharray defines the stroke length vs the gap length
                            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                            transform={`rotate(${rotate} ${center} ${center})`}
                            className={`transition-all duration-300 ${isSeen ? "opacity-60 group-hover:opacity-100" : ""}`}
                        />
                    );
                })}
            </svg>

            {/* Avatar Container Layer */}
            <div className="w-16 h-16 rounded-full overflow-hidden border-[3px] border-surface z-0 bg-surface relative shadow-sm">
                <div className="w-full h-full rounded-full overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
};

// --- Performance Optimization ---
// Custom comparison function for React.memo
// Prevents re-renders unless story count, user ID, or viewed status changes.
const arePropsEqual = (prev, next) => {
    // 1. Check array length (Fastest check)
    if (prev.stories.length !== next.stories.length) return false;

    // 2. Check User ID
    if (prev.userId !== next.userId) return false;

    // 3. Deep check status of each story (seen/unseen changes)
    for (let i = 0; i < prev.stories.length; i++) {
        if (prev.stories[i].isViewed !== next.stories[i].isViewed) return false;
        if (prev.stories[i].seen !== next.stories[i].seen) return false;
    }

    return true; // Props are equal, skip re-render
};

export default memo(StoryRing, arePropsEqual);