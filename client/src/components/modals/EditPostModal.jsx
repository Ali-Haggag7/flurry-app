/**
 * EditPostModal Component
 * ------------------------------------------------------------------
 * Modal for editing existing posts.
 * Features optimistic updates and clean textarea input.
 */

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢

// Icons
import { X, Save, Loader2 } from "lucide-react";

// API
import api from "../../lib/axios";

const EditPostModal = ({ isOpen, onClose, post, onUpdateSuccess }) => {
    const [content, setContent] = useState(post?.content || "");
    const [loading, setLoading] = useState(false);
    const { getToken } = useAuth();
    const { t } = useTranslation(); // 🟢

    // Reset content when post prop changes
    useEffect(() => {
        if (post) setContent(post.content || "");
    }, [post]);

    const handleUpdate = async () => {
        if (content === post.content) {
            onClose();
            return;
        }

        if (!content.trim()) return toast.error(t("editPost.emptyError")); // 🟢

        try {
            setLoading(true);
            const token = await getToken();
            const { data } = await api.put(`/post/${post._id}`, { content }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                toast.success(t("editPost.success")); // 🟢
                onUpdateSuccess(content);
                onClose();
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || t("editPost.error")); // 🟢
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-surface border border-adaptive w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4 border-b border-adaptive pb-3">
                            <h3 className="text-xl font-bold text-content">{t("editPost.title")}</h3> {/* 🟢 */}
                            <button onClick={onClose} className="p-2 hover:bg-main rounded-full text-muted transition">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Text Area */}
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-40 bg-main p-4 rounded-xl text-content border border-adaptive focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none mb-4 custom-scrollbar font-medium"
                            placeholder={t("editPost.placeholder")} // 🟢
                            autoFocus
                        />

                        {/* Footer Buttons */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="px-5 py-2 rounded-xl text-muted hover:bg-main transition font-medium disabled:opacity-50"
                            >
                                {t("editPost.cancel")} {/* 🟢 */}
                            </button>
                            <button
                                onClick={handleUpdate}
                                disabled={loading || !content.trim()}
                                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm hover:shadow-primary/20 active:scale-95"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                <span>{t("editPost.save")}</span> {/* 🟢 */}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default EditPostModal;