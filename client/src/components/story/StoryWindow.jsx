/**
 * StoryWindow Component
 * ------------------------------------------------------------------
 * Modal for creating new stories (Text or Media).
 * Features:
 * - Text mode with gradient backgrounds.
 * - Media mode (Image/Video) with duration validation (max 60s).
 * - Drag & Drop support and real-time previews.
 * - Memory leak prevention for object URLs.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢 Import translation hook

// Icons
import { Sparkles, Type, Image as ImageIcon, X, UploadCloud, Trash2, Send } from "lucide-react";

// API
import api from "../../lib/axios";

// --- Constants ---
const BG_GRADIENTS = [
    "linear-gradient(to bottom right, #09090b, #18181b, #27272a)", // Carbon Stealth
    "linear-gradient(to bottom right, #020617, #172554, #1e1b4b)", // Deep Space
    "linear-gradient(to bottom right, #450a0a, #7f1d1d, #991b1b)", // Royal Vampire
    "linear-gradient(to bottom right, #022c22, #14532d, #166534)", // Dark Forest
    "linear-gradient(to bottom right, #0f172a, #0e7490, #155e75)", // Mystic Abyss
    "linear-gradient(to bottom right, #7c3aed, #a855f7, #db2777)", // Hyper Violet
    "linear-gradient(to bottom right, #c2410c, #ea580c, #f59e0b)", // Sunset Vibes
    "linear-gradient(to bottom right, #312e81, #6366f1, #2dd4bf)", // Northern Lights
];

const StoryWindow = ({ setShowModal, fetchStories }) => {
    // --- State ---
    const [mode, setMode] = useState("text"); // 'text' | 'media'
    const [background, setBackground] = useState(BG_GRADIENTS[0]);
    const [media, setMedia] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);

    // --- Hooks ---
    const { getToken } = useAuth();
    const { t } = useTranslation(); // 🟢 Hook initialization
    const fileInputRef = useRef(null);

    // --- Cleanup Effect (Memory Management) ---
    useEffect(() => {
        // Revoke object URL when component unmounts or preview changes
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    // --- Handlers ---

    // 1. Handle File Upload & Validation
    const handleMediaUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Cleanup previous preview
        if (previewUrl) URL.revokeObjectURL(previewUrl);

        if (file.type.startsWith("video/")) {
            const video = document.createElement('video');
            video.preload = 'metadata';

            video.onloadedmetadata = function () {
                window.URL.revokeObjectURL(video.src);
                if (video.duration > 60) {
                    toast.error(t("stories.window.videoTooLong")); // 🟢 Translated Toast
                    return;
                }
                setMedia(file);
                setPreviewUrl(URL.createObjectURL(file));
                setMode("media");
            };
            video.src = URL.createObjectURL(file);
        } else {
            setMedia(file);
            setPreviewUrl(URL.createObjectURL(file));
            setMode("media");
        }
    };

    // 2. Submit Story
    const handleCreateStory = async () => {
        if (mode === "text" && !text.trim()) return toast.error(t("stories.window.emptyTextError")); // 🟢
        if (mode === "media" && !media) return toast.error(t("stories.window.noMediaError")); // 🟢

        try {
            setLoading(true);
            const token = await getToken();
            const formData = new FormData();

            if (mode === "text") {
                formData.append("type", "text");
                formData.append("content", text);
                formData.append("backgroundColor", background);
            } else {
                const fileType = media.type.startsWith("image/") ? "image" : "video";
                formData.append("type", fileType);
                formData.append("media", media);
                if (text.trim()) formData.append("caption", text);
            }

            const { data } = await api.post("/story/add", formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                toast.success(t("stories.window.success")); // 🟢
                fetchStories(); // Refresh list
                setShowModal(false); // Close modal
            }
        } catch (error) {
            console.error("Story upload failed:", error);
            toast.error(t("stories.window.error")); // 🟢
        } finally {
            setLoading(false);
        }
    };

    // 3. Reset Handler
    const resetMedia = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setMedia(null);
        setPreviewUrl(null);
        setMode("text");
        setText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] w-full h-full bg-black/80 backdrop-blur-sm flex items-center justify-center sm:p-4"
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
                className="relative w-full h-full sm:max-w-[450px] sm:h-[85vh] bg-main sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-adaptive"
            >
                {/* --- Header --- */}
                <div className="absolute top-0 start-0 w-full z-50 p-4 flex items-center justify-between bg-linear-to-b from-black/60 to-transparent">
                    <button onClick={() => setShowModal(false)} className="p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-white/10 text-white transition">
                        <X size={24} />
                    </button>
                    <button
                        onClick={handleCreateStory}
                        disabled={loading}
                        className="px-5 py-2 rounded-full bg-primary text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
                    >
                        {loading ? t("stories.window.posting") : <>{t("stories.window.share")} <Send size={16} className="rtl:rotate-180" /></>} {/* 🟢 Translated & RTL Icon */}
                    </button>
                </div>

                {/* --- Canvas Area --- */}
                <div
                    className="flex-1 w-full relative flex items-center justify-center overflow-hidden transition-colors duration-500"
                    style={{ background: mode === 'text' ? background : '#000' }}
                >
                    <AnimatePresence mode="wait">

                        {/* 1. Text Mode Editor */}
                        {mode === "text" && (
                            <motion.div
                                key="text-editor"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="w-full h-full flex flex-col items-center justify-center p-6"
                            >
                                <textarea
                                    className="w-full max-w-[85%] bg-transparent text-white p-2 resize-none outline-none text-center text-3xl font-bold placeholder-white/50
                                    leading-relaxed font-sans caret-white overflow-hidden focus:placeholder:opacity-0"
                                    placeholder={t("stories.window.textPlaceholder")} // 🟢
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    maxLength={300}
                                    style={{ height: 'auto' }}
                                    rows={4}
                                />
                            </motion.div>
                        )}

                        {/* 2. Media Mode Preview */}
                        {mode === "media" && previewUrl && (
                            <motion.div
                                key="media-preview"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="w-full h-full relative flex flex-col bg-black"
                            >
                                <div className="flex-1 relative flex items-center justify-center">
                                    {media?.type.startsWith("image/") ? (
                                        <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                                    ) : (
                                        <video src={previewUrl} autoPlay loop muted playsInline className="max-w-full max-h-full object-contain" />
                                    )}
                                </div>

                                {/* Caption Input for Media */}
                                <div className="absolute bottom-0 w-full p-4 bg-linear-to-t from-black/90 via-black/50 to-transparent">
                                    <input
                                        type="text"
                                        placeholder={t("stories.window.captionPlaceholder")} // 🟢
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-full py-3 px-4 text-white placeholder-white/50 focus:outline-none focus:border-primary transition-all text-sm"
                                        maxLength={150}
                                    />
                                </div>

                                <button
                                    onClick={(e) => { e.stopPropagation(); resetMedia(); }}
                                    className="absolute top-4 end-4 p-2 bg-black/40 rounded-full text-white hover:bg-red-500 transition z-50 mt-12"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </motion.div>
                        )}

                        {/* 3. Upload Placeholder */}
                        {mode === "media" && !previewUrl && (
                            <motion.div
                                key="upload-placeholder"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                onClick={() => fileInputRef.current.click()}
                                className="flex flex-col items-center justify-center gap-4 text-content/50 cursor-pointer hover:text-content transition w-full h-full bg-surface"
                            >
                                <div className="p-6 rounded-full border-2 border-dashed border-adaptive bg-main hover:bg-surface transition group">
                                    <UploadCloud size={40} className="text-primary group-hover:scale-110 transition-transform" />
                                </div>
                                <p className="font-bold text-muted">{t("stories.window.uploadPlaceholder")}</p> {/* 🟢 */}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* --- Background Controls (Text Mode Only) --- */}
                <div className="absolute bottom-20 start-0 w-full z-40 px-6 flex justify-center pointer-events-none">
                    {mode === "text" && (
                        <div className="flex gap-3 overflow-x-auto p-2 pointer-events-auto max-w-full scrollbar-hide">
                            {BG_GRADIENTS.map((grad, index) => (
                                <button
                                    key={index}
                                    onClick={() => setBackground(grad)}
                                    className={`w-8 h-8 rounded-full border-2 transition-transform ${background === grad ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                                    style={{ background: grad }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* --- Mode Switcher (Footer) --- */}
                <div className="bg-surface p-4 border-t border-adaptive">
                    <div className="bg-main p-1 rounded-xl flex relative border border-adaptive">
                        <motion.div
                            layoutId="activeTab"
                            className="absolute top-1 bottom-1 bg-surface rounded-sg shadow-sm"
                            initial={false}
                            style={{
                                // 🔵 Handle RTL for the slider position
                                // Logic: If text (left/start), if media (right/end)
                                // In RTL, "left" becomes "right". We use inline style with logic or class based.
                                // For simplicity with framer motion layoutId, we can rely on standard positioning if directions are flipped via CSS.
                                // But here we use 'left' property which needs flip.
                                insetInlineStart: mode === "text" ? "4px" : "50%",
                                width: "calc(50% - 4px)",
                            }}
                        />
                        <button
                            onClick={() => { setMode("text"); setText(""); }}
                            className={`flex-1 py-2 text-sm font-bold flex items-center justify-center gap-2 relative z-10 transition-colors ${mode === "text" ? "text-primary" : "text-muted hover:text-content"}`}
                        >
                            <Type size={16} /> {t("stories.window.textMode")} {/* 🟢 */}
                        </button>
                        <button
                            onClick={() => { setMode("media"); setText(""); }}
                            className={`flex-1 py-2 text-sm font-bold flex items-center justify-center gap-2 relative z-10 transition-colors ${mode === "media" ? "text-primary" : "text-muted hover:text-content"}`}
                        >
                            <ImageIcon size={16} /> {t("stories.window.mediaMode")} {/* 🟢 */}
                        </button>
                    </div>
                    <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
                </div>
            </motion.div>
        </motion.div>
    );
};

export default StoryWindow;