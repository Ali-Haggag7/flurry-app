/**
 * ConnectionsSkeleton Component
 * ------------------------------------------------------------------
 * Loading placeholder for the connections grid.
 * Features:
 * - Responsive grid layout.
 * - Shimmer effect using theme variables.
 * - Optimized with React.memo.
 */

import { memo } from "react";

const ConnectionsSkeleton = () => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                    key={n}
                    className="relative bg-surface border border-adaptive rounded-2xl p-4 flex flex-col gap-4 overflow-hidden shadow-sm"
                >
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-linear-to-r from-transparent via-white/5 to-transparent z-10 pointer-events-none" />

                    <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                            <div className="w-14 h-14 bg-main rounded-full border border-adaptive animate-pulse" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 space-y-2 py-1">
                            {/* Name */}
                            <div className="h-4 bg-main rounded w-3/4 animate-pulse" />
                            {/* Username */}
                            <div className="h-3 bg-main rounded w-1/2 animate-pulse" />
                            {/* Bio Line */}
                            <div className="h-2 bg-main rounded w-full mt-2 animate-pulse" />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-auto pt-3 border-t border-adaptive flex gap-2">
                        {/* Primary Button */}
                        <div className="flex-1 h-9 bg-main rounded-xl animate-pulse" />
                        {/* Secondary Button (Icon) */}
                        <div className="w-9 h-9 bg-main rounded-xl animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default memo(ConnectionsSkeleton);