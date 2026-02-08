/**
 * CreateGroupModal Component
 * ------------------------------------------------------------------
 * Modal for creating a new group chat.
 * Features:
 * - Image upload with preview.
 * - Form validation.
 * - Optimized state management.
 */

import { useState, useCallback } from "react";
import api from "../../lib/axios"
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next"; // 🟢

// Icons
import { X, Upload, Loader2, Users, Type } from "lucide-react";

const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
    const { getToken } = useAuth();
    const { t } = useTranslation(); // 🟢
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState("");
    const [loading, setLoading] = useState(false);

    const handleImageChange = useCallback((e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error(t("createGroup.nameRequired")); // 🟢

        setLoading(true);
        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);
        if (image) formData.append("image", image);

        try {
            const token = await getToken();

            const res = await api.post(`/group/create`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                withCredentials: true,
            });

            toast.success(t("createGroup.success")); // 🟢
            if (onGroupCreated) onGroupCreated(res.data);

            // Reset & Close
            setName("");
            setDescription("");
            setImage(null);
            setPreview("");
            onClose();

        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || t("createGroup.error")); // 🟢
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
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="bg-surface border border-adaptive w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-5 border-b border-adaptive bg-main/50 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary/10 rounded-xl">
                                    <Users className="text-primary" size={22} />
                                </div>
                                <h3 className="text-xl font-extrabold text-content">{t("createGroup.title")}</h3> {/* 🟢 */}
                            </div>
                            <button onClick={onClose} className="text-muted hover:text-content transition bg-transparent hover:bg-main p-2 rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">

                            {/* Image Upload */}
                            <div className="flex flex-col items-center gap-3">
                                <label className="relative w-28 h-28 rounded-full border-2 border-dashed border-muted/50 flex items-center justify-center overflow-hidden hover:border-primary transition-colors cursor-pointer bg-main group shadow-inner">
                                    {preview ? (
                                        <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <Upload className="text-muted group-hover:text-primary transition-colors" size={32} />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 backdrop-blur-[1px]">
                                        <span className="text-xs text-white font-bold bg-black/50 px-2 py-1 rounded-md">{t("createGroup.change")}</span> {/* 🟢 */}
                                    </div>
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                </label>
                                <span className="text-xs text-muted font-bold uppercase tracking-widest">{t("createGroup.iconLabel")}</span> {/* 🟢 */}
                            </div>

                            {/* Inputs */}
                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted uppercase ms-1">{t("createGroup.nameLabel")}</label> {/* 🟢 */}
                                    <div className="relative group focus-within:text-primary transition-colors">
                                        <Type className="absolute start-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={18} /> {/* 🔵 start-3 */}
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-main border border-adaptive rounded-xl py-3 ps-10 pe-4 text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder-muted/70" // 🔵 ps-10 pe-4
                                            placeholder={t("createGroup.namePlaceholder")} // 🟢
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted uppercase ms-1">{t("createGroup.descLabel")}</label> {/* 🟢 */}
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full bg-main border border-adaptive rounded-xl px-4 py-3 text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none h-24 placeholder-muted/70 leading-relaxed custom-scrollbar"
                                        placeholder={t("createGroup.descPlaceholder")} // 🟢
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-primary hover:bg-primary/90 rounded-xl text-white font-bold shadow-lg shadow-primary/25 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : t("createGroup.createBtn")} {/* 🟢 */}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CreateGroupModal;