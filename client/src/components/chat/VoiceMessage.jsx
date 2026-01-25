/**
 * VoiceMessage Component
 * ------------------------------------------------------------------
 * Custom audio player for voice notes.
 * Features:
 * - Play/Pause control with smooth progress bar.
 * - Real-time duration tracking using requestAnimationFrame.
 * - Dynamic styling based on sender (me vs others).
 * - Optimized to prevent memory leaks during playback.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";

const VoiceMessage = ({ src, isMe }) => {
    // --- State ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // --- Refs ---
    const audioRef = useRef(null);
    const animationRef = useRef(null);

    // --- Helpers ---
    const formatTime = (time) => {
        if (!time || isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    // --- Playback Logic ---

    // 1. Update progress bar smoothly (60fps)
    const updateProgress = useCallback(() => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            animationRef.current = requestAnimationFrame(updateProgress);
        }
    }, []);

    // 2. Play/Pause Toggle
    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            cancelAnimationFrame(animationRef.current);
            setIsPlaying(false);
        } else {
            audio.play()
                .then(() => {
                    setIsPlaying(true);
                    animationRef.current = requestAnimationFrame(updateProgress);
                })
                .catch((err) => console.error("Playback failed:", err));
        }
    }, [isPlaying, updateProgress]);

    // 3. Manual Seek
    const handleSeek = (e) => {
        const newTime = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    // 4. On Audio End
    const handleAudioEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        cancelAnimationFrame(animationRef.current);
    };

    // --- Cleanup ---
    useEffect(() => {
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    // --- Styles ---
    const activeColor = isMe ? "#ffffff" : "var(--color-primary)";
    const inactiveColor = isMe ? "rgba(255, 255, 255, 0.4)" : "var(--color-border)";
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className={`flex items-center gap-3 p-3 rounded-2xl min-w-[240px] sm:min-w-[280px] border border-adaptive transition-colors ${isMe ? "bg-white/10" : "bg-surface"}`}>

            <audio
                ref={audioRef}
                src={src}
                preload="metadata" // Changed to metadata to save bandwidth
                onEnded={handleAudioEnded}
                onLoadedMetadata={() => setDuration(audioRef.current.duration)}
                hidden
            />

            <button
                onClick={togglePlay}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-transform active:scale-95 shrink-0 shadow-sm
                    ${isMe ? "bg-white text-primary" : "bg-primary text-white"}`}
            >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>

            <div className="flex-1 flex flex-col justify-center gap-1.5">
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="any"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer focus:outline-none transition-none"
                    style={{
                        background: `linear-gradient(to right, ${activeColor} ${progressPercent}%, ${inactiveColor} ${progressPercent}%)`,
                        transition: 'none' // Crucial for smooth dragging
                    }}
                />

                <div className={`text-[10px] font-mono font-medium flex justify-between px-0.5 ${isMe ? "text-white/90" : "text-muted"}`}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{duration ? formatTime(duration) : "0:00"}</span>
                </div>
            </div>
        </div>
    );
};

export default VoiceMessage;