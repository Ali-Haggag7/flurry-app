/**
 * UpdateProfileModal Component
 * ------------------------------------------------------------------
 * Modal for editing user profile information (Name, Bio, Location, Images).
 * Features:
 * - Image preview for profile & cover photos.
 * - Form validation and loading states.
 * - Integration with Redux for state management.
 */

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢

// Icons
import { Camera, X, Loader2, User, MapPin, AlignLeft } from "lucide-react";

// Actions
import { updateUser } from "../../features/userSlice";

const UpdateProfileModal = ({ setShowEdit }) => {
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const user = useSelector((state) => state.user.currentUser);
    const { t } = useTranslation(); // 🟢

    // --- State ---
    const [loading, setLoading] = useState(false);
    const [editForm, setEditForm] = useState({
        username: user?.username || "",
        full_name: user?.full_name || "",
        bio: user?.bio || "",
        location: user?.location || "",
        profile_picture: null,
        cover_photo: null,
    });

    const [previewProfile, setPreviewProfile] = useState(user?.profile_picture);
    const [previewCover, setPreviewCover] = useState(user?.cover_photo);

    if (!user) return null;

    // --- Handlers ---

    const handleImageChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            setEditForm(prev => ({ ...prev, [type]: file }));
            if (type === "profile_picture") setPreviewProfile(URL.createObjectURL(file));
            else setPreviewCover(URL.createObjectURL(file));
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setLoading(true);

        const userData = new FormData();
        // Append only changed fields (Optional but cleaner)
        if (editForm.username !== user.username) userData.append("username", editForm.username);
        if (editForm.full_name !== user.full_name) userData.append("full_name", editForm.full_name);
        if (editForm.bio !== user.bio) userData.append("bio", editForm.bio);
        if (editForm.location !== user.location) userData.append("location", editForm.location);
        if (editForm.profile_picture) userData.append("profile_picture", editForm.profile_picture);
        if (editForm.cover_photo) userData.append("cover", editForm.cover_photo);

        try {
            const token = await getToken();

            // Dispatch Redux Action
            const actionPromise = dispatch(updateUser({ formData: userData, token })).unwrap();

            await toast.promise(actionPromise, {
                loading: t("updateProfile.toasts.updating"), // 🟢
                success: t("updateProfile.toasts.success"), // 🟢
                error: (err) => err?.message || t("updateProfile.toasts.error"), // 🟢
            });

            setShowEdit(false);
        } catch (error) {
            console.error("Failed to update:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
                onClick={() => setShowEdit(false)}
            >
                <motion.div
                    initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                    className="w-full max-w-xl bg-surface border border-adaptive rounded-2xl shadow-2xl overflow-hidden relative transition-colors duration-300"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* --- Header --- */}
                    <div className="flex justify-between items-center p-4 px-6 border-b border-adaptive bg-main/50 backdrop-blur-md">
                        <h2 className="text-lg font-bold text-content">{t("updateProfile.title")}</h2> {/* 🟢 */}
                        <button
                            onClick={() => setShowEdit(false)}
                            className="p-2 hover:bg-main rounded-full text-muted hover:text-primary transition-colors"
                            aria-label="Close Modal"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSaveProfile} className="relative">

                        {/* --- 📸 Cover Photo --- */}
                        <div className="h-40 bg-main relative group overflow-hidden">
                            {previewCover ? (
                                <img src={previewCover} className="w-full h-full object-cover opacity-90 group-hover:opacity-75 transition duration-500" alt="cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-r from-primary/80 to-primary/20"></div>
                            )}

                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 cursor-pointer bg-black/30 backdrop-blur-[2px]">
                                <label className="p-3 bg-surface/20 backdrop-blur-md border border-white/20 rounded-full cursor-pointer hover:bg-primary hover:border-primary hover:text-white transition transform hover:scale-110 group/icon">
                                    <Camera size={24} className="text-white group-hover/icon:text-white" />
                                    <input type="file" hidden accept="image/*" onChange={(e) => handleImageChange(e, "cover_photo")} />
                                </label>
                            </div>
                        </div>

                        {/* --- 👤 Profile Picture --- */}
                        <div className="px-6 relative -mt-16 mb-6">
                            <div className="relative w-32 h-32 rounded-full border-4 border-surface group inline-block shadow-xl">
                                <img
                                    src={previewProfile || "/avatar-placeholder.png"}
                                    className="w-full h-full rounded-full object-cover bg-main"
                                    alt="profile"
                                />
                                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition duration-300 backdrop-blur-[1px]">
                                    <Camera size={28} className="text-white drop-shadow-md" />
                                    <input type="file" hidden accept="image/*" onChange={(e) => handleImageChange(e, "profile_picture")} />
                                </label>
                            </div>
                        </div>

                        {/* --- 📝 Input Fields --- */}
                        <div className="px-6 pb-8 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {/* Full Name */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted uppercase ms-1">{t("updateProfile.fullName")}</label> {/* 🟢 */}
                                    <div className="relative group focus-within:text-primary transition-colors">
                                        <User className="absolute start-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={18} /> {/* 🔵 start-3 */}
                                        <input
                                            type="text"
                                            className="w-full ps-10 pe-4 py-3 bg-main border border-adaptive rounded-xl text-content placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all" // 🔵 ps-10 pe-4
                                            value={editForm.full_name}
                                            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                            placeholder="John Doe"
                                        />
                                    </div>
                                </div>

                                {/* Username */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted uppercase ms-1">{t("updateProfile.username")}</label> {/* 🟢 */}
                                    <div className="relative group focus-within:text-primary transition-colors">
                                        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary font-bold transition-colors">@</span> {/* 🔵 start-3 */}
                                        <input
                                            type="text"
                                            className="w-full ps-8 pe-4 py-3 bg-main border border-adaptive rounded-xl text-content placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all" // 🔵 ps-8 pe-4
                                            value={editForm.username}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const sanitized = val.replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase();

                                                setEditForm({ ...editForm, username: sanitized });
                                            }}
                                            placeholder="username"
                                            minLength={4}
                                            maxLength={20}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bio */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted uppercase ms-1">{t("updateProfile.bio")}</label> {/* 🟢 */}
                                <div className="relative group focus-within:text-primary transition-colors">
                                    <AlignLeft className="absolute start-3 top-3.5 text-muted group-focus-within:text-primary transition-colors" size={18} /> {/* 🔵 start-3 */}
                                    <textarea
                                        rows="3"
                                        className="w-full ps-10 pe-4 py-3 bg-main border border-adaptive rounded-xl text-content placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none leading-relaxed custom-scrollbar" // 🔵 ps-10 pe-4
                                        placeholder={t("updateProfile.bioPlaceholder")} // 🟢
                                        value={editForm.bio}
                                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Location */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted uppercase ms-1">{t("updateProfile.location")}</label> {/* 🟢 */}
                                <div className="relative group focus-within:text-primary transition-colors">
                                    <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={18} /> {/* 🔵 start-3 */}
                                    <input
                                        type="text"
                                        className="w-full ps-10 pe-4 py-3 bg-main border border-adaptive rounded-xl text-content placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all" // 🔵 ps-10 pe-4
                                        placeholder={t("updateProfile.locationPlaceholder")} // 🟢
                                        value={editForm.location}
                                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* --- Footer Buttons --- */}
                            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-adaptive">
                                <button
                                    type="button"
                                    onClick={() => setShowEdit(false)}
                                    className="px-5 py-2.5 rounded-xl text-muted hover:text-content hover:bg-main transition font-medium border border-transparent hover:border-adaptive"
                                >
                                    {t("updateProfile.cancel")} {/* 🟢 */}
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white font-bold shadow-lg shadow-primary/20 active:scale-95 transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : t("updateProfile.save")} {/* 🟢 */}
                                </button>
                            </div>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default UpdateProfileModal;