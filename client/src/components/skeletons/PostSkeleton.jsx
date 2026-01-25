/**
 * PostSkeleton Component
 * ------------------------------------------------------------------
 * Loading placeholder for social media posts.
 * Mimics the structure of PostCard for layout stability.
 * Optimized with React.memo.
 */

import { memo } from "react";

const PostSkeleton = () => {
    return (
        <div className="bg-surface rounded-2xl p-5 mb-6 border border-adaptive shadow-sm relative overflow-hidden">

            {/* Shimmer Overlay */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10 pointer-events-none" />

            {/* Header: User Info */}
            <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-full bg-main animate-pulse shrink-0 border border-adaptive" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-main rounded w-1/3 animate-pulse" />
                    <div className="h-3 bg-main rounded w-1/4 animate-pulse" />
                </div>
                {/* Menu Dots Placeholder */}
                <div className="w-8 h-8 rounded-full bg-main animate-pulse" />
            </div>

            {/* Text Content */}
            <div className="space-y-2.5 mb-5">
                <div className="h-4 bg-main rounded w-full animate-pulse" />
                <div className="h-4 bg-main rounded w-[90%] animate-pulse" />
                <div className="h-4 bg-main rounded w-[95%] animate-pulse" />
            </div>

            {/* Media Placeholder (Image) */}
            <div className="w-full h-[300px] bg-main rounded-xl mb-5 animate-pulse border border-adaptive" />

            {/* Footer: Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-adaptive">
                <div className="flex gap-6">
                    {/* Like */}
                    <div className="h-5 w-12 bg-main rounded-md animate-pulse" />
                    {/* Comment */}
                    <div className="h-5 w-12 bg-main rounded-md animate-pulse" />
                </div>
                {/* Share */}
                <div className="h-5 w-12 bg-main rounded-md animate-pulse" />
            </div>
        </div>
    );
};

export default memo(PostSkeleton);