/**
 * Loading Component
 * ------------------------------------------------------------------
 * A centralized loader component used across the application.
 * Features a pulsing ring animation styled with the app's primary theme.
 * Optimized with React.memo to prevent unnecessary re-renders.
 */

import { memo } from 'react';

const Loading = ({ height = "100vh", transparent = false }) => {
    return (
        <div
            className={`flex items-center justify-center w-full transition-colors duration-300
                ${transparent ? "bg-transparent" : "bg-main"}`}
            style={{ height }}
            role="status"
            aria-label="Loading"
        >
            <div className="relative w-16 h-16">
                {/* 🌈 Outer Pulse (Primary Theme Color) */}
                <div className="absolute inset-0 rounded-full bg-primary/40 animate-ping blur-xl" />

                {/* 🔁 Spinning Ring */}
                <div className="w-full h-full rounded-full border-4 border-transparent border-t-primary border-b-primary/30 animate-spin" />

                {/* 💫 Core Glow */}
                {/* 🛠️ FIX: Use 'left-1/2' instead of 'start-1/2' to force physical centering in RTL & LTR */}
                <div className="absolute top-1/2 left-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 bg-primary rounded-full animate-pulse shadow-[0_0_20px_var(--color-primary)]" />
            </div>
        </div>
    );
};

export default memo(Loading);