import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
    User,
    Lock,
    Palette,
    Bell,
    ShieldAlert,
    Save,
    Loader2,
    Moon,
    Sun,
    Monitor,
    Check,
    Settings as SettingsIcon,
} from "lucide-react";

// --- Local Imports ---
import { updateUser, updatePrivacy, updateNotificationSettings } from "../features/userSlice";
import { useTheme } from "../context/ThemeContext";
import { useSocketContext } from "../context/SocketContext";

// --- Constants ---
const TABS = [
    { id: "general", label: "General", icon: <User className="w-4 h-4" /> },
    { id: "privacy", label: "Privacy", icon: <Lock className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "danger", label: "Danger Zone", icon: <ShieldAlert className="w-4 h-4" /> },
];

const ACCENT_OPTIONS = {
    dark: [
        { id: "purple", label: "Amethyst", color: "#9333ea" },
        { id: "green", label: "Emerald", color: "#10b981" },
        { id: "red", label: "Crimson", color: "#f43f5e" },
    ],
    light: [
        { id: "blue", label: "Sky", color: "#2563eb" },
        { id: "green", label: "Leaf", color: "#059669" },
        { id: "orange", label: "Sunset", color: "#f97316" },
    ],
    fantasy: [
        { id: "pink", label: "Neon Rose", color: "#d946ef" },
        { id: "cyan", label: "Cyber Cyan", color: "#22d3ee" },
        { id: "yellow", label: "Royal Gold", color: "#fbbf24" },
    ],
};

const THEME_OPTIONS = [
    { id: "dark", label: "Dark Mode", icon: Moon },
    { id: "light", label: "Light Mode", icon: Sun },
    { id: "fantasy", label: "Fantasy Mode", icon: Monitor },
];

/**
 * Settings Component
 *
 * Manages user preferences including Profile, Privacy, Appearance, Notifications, and Account Security.
 * Utilizes Redux for state management and Socket.io for real-time status updates.
 */
const Settings = () => {
    const { currentUser } = useSelector((state) => state.user);
    const [activeTab, setActiveTab] = useState("general");

    return (
        <div className="min-h-screen bg-main text-content p-4 md:p-8 overflow-x-hidden transition-colors duration-300">
            <div className="max-w-4xl mx-auto mt-6">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-left mb-8 md:mb-10"
                >
                    <h1 className="text-3xl md:text-4xl font-extrabold text-content flex items-center gap-3">
                        <SettingsIcon className="text-primary w-8 h-8 md:w-10 md:h-10 animate-spin-slow" />
                        Settings
                    </h1>
                    <p className="text-muted text-sm md:text-base mt-2 font-medium">
                        Customize your experience and manage your account.
                    </p>
                </motion.div>

                {/* Tabs Navigation */}
                <div className="relative mb-10">
                    <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:flex-wrap md:justify-start gap-3 no-scrollbar scroll-smooth">
                        {TABS.map((tab) => (
                            <TabButton
                                key={tab.id}
                                tab={tab}
                                isActive={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                            />
                        ))}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-adaptive -z-10 md:hidden" />
                </div>

                {/* Content Area */}
                <div className="bg-surface border border-adaptive rounded-3xl p-6 md:p-10 shadow-xl min-h-[400px]">
                    <AnimatePresence mode="wait">
                        {activeTab === "general" && <GeneralSettings key="general" currentUser={currentUser} />}
                        {activeTab === "privacy" && <PrivacySettings key="privacy" currentUser={currentUser} />}
                        {activeTab === "appearance" && <AppearanceSettings key="appearance" />}
                        {activeTab === "notifications" && <NotificationSettings key="notifications" currentUser={currentUser} />}
                        {activeTab === "danger" && <DangerZone key="danger" />}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

// --- Sub-Components ---

/**
 * Toggle Component (Memoized)
 * Reusable switch component with smooth animations.
 */
const Toggle = memo(({ label, checked, onChange }) => (
    <div
        className="flex items-center justify-between p-4 bg-surface rounded-xl border border-adaptive hover:border-primary/40 transition-colors group cursor-pointer"
        onClick={() => onChange(!checked)}
    >
        <span className="text-content font-medium group-hover:text-primary transition-colors">
            {label}
        </span>
        <div
            className={`relative w-12 h-6 rounded-full transition-colors duration-300 ease-in-out ${checked ? "bg-primary" : "bg-muted/30"
                }`}
        >
            <div
                className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${checked ? "translate-x-6" : "translate-x-0"
                    }`}
            />
        </div>
    </div>
));

/**
 * TabButton (Memoized)
 * Individual navigation tab.
 */
const TabButton = memo(({ tab, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 relative overflow-hidden group whitespace-nowrap
      ${isActive
                ? "text-primary bg-primary/10 shadow-sm"
                : "text-muted hover:text-content hover:bg-surface"
            }`}
    >
        <span className="relative z-10 flex items-center gap-2 text-sm md:text-base">
            {tab.icon} {tab.label}
        </span>
        {isActive && (
            <motion.div
                layoutId="activeSettingTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
            />
        )}
    </button>
));

/**
 * GeneralSettings
 * Manages Profile Info (Name, Username, Bio).
 */
const GeneralSettings = ({ currentUser }) => {
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        full_name: "",
        username: "",
        bio: "",
    });

    useEffect(() => {
        if (currentUser) {
            setFormData({
                full_name: currentUser.full_name || "",
                username: currentUser.username || "",
                bio: currentUser.bio || "",
            });
        }
    }, [currentUser]);

    const handleSaveGeneral = useCallback(
        async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
                const token = await getToken();
                const data = new FormData();
                data.append("full_name", formData.full_name);
                data.append("username", formData.username);
                data.append("bio", formData.bio);

                await dispatch(updateUser({ formData: data, token })).unwrap();
                toast.success("Profile updated successfully! 🚀");
            } catch (error) {
                toast.error("Failed to update profile ❌");
            } finally {
                setLoading(false);
            }
        },
        [dispatch, formData, getToken]
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
        >
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-content border-b border-adaptive pb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <User className="text-primary" size={24} />
                </div>
                General Profile
            </h2>
            <form onSubmit={handleSaveGeneral} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted ml-1 uppercase tracking-wider">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) =>
                                setFormData({ ...formData, full_name: e.target.value })
                            }
                            className="w-full bg-main border border-adaptive rounded-xl px-4 py-3 text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder-muted/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted ml-1 uppercase tracking-wider">
                            Username
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">
                                @
                            </span>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) =>
                                    setFormData({ ...formData, username: e.target.value })
                                }
                                className="w-full bg-main border border-adaptive rounded-xl pl-8 pr-4 py-3 text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder-muted/50"
                            />
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-muted ml-1 uppercase tracking-wider">
                        Bio
                    </label>
                    <textarea
                        rows="4"
                        value={formData.bio}
                        onChange={(e) =>
                            setFormData({ ...formData, bio: e.target.value })
                        }
                        className="w-full bg-main border border-adaptive rounded-xl px-4 py-3 text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none placeholder-muted/50"
                        placeholder="Tell the world about yourself..."
                    />
                </div>
                <div className="flex justify-end pt-4 border-t border-adaptive">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-primary hover:opacity-90 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        Save Changes
                    </button>
                </div>
            </form>
        </motion.div>
    );
};

/**
 * PrivacySettings
 * Manages Account Privacy and Status Visibility.
 */
const PrivacySettings = ({ currentUser }) => {
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const { socket } = useSocketContext();
    const [privacySettings, setPrivacySettings] = useState({
        isPrivate: false,
        hideOnlineStatus: false,
    });

    useEffect(() => {
        if (currentUser) {
            setPrivacySettings({
                isPrivate: currentUser.isPrivate || false,
                hideOnlineStatus: currentUser.hideOnlineStatus || false,
            });
        }
    }, [currentUser]);

    const handlePrivacyUpdate = useCallback(
        async (key, value) => {
            // Optimistic Update
            setPrivacySettings((prev) => ({ ...prev, [key]: value }));

            try {
                const token = await getToken();
                await dispatch(
                    updatePrivacy({
                        settings: { [key]: value },
                        token,
                    })
                ).unwrap();

                if (key === "hideOnlineStatus" && socket) {
                    socket.emit("toggleOnlineStatus", { isHidden: value });
                }

                toast.success(
                    `${key === "isPrivate" ? "Private Profile" : "Online Status"} updated!`
                );
            } catch (error) {
                // Revert on failure
                setPrivacySettings((prev) => ({ ...prev, [key]: !value }));
                toast.error("Failed to update settings");
            }
        },
        [dispatch, getToken, socket]
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-content border-b border-adaptive pb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Lock className="text-primary" size={24} />
                </div>
                Privacy & Security
            </h2>
            <Toggle
                label="Private Profile (Only followers can see posts)"
                checked={privacySettings.isPrivate}
                onChange={(val) => handlePrivacyUpdate("isPrivate", val)}
            />
            <Toggle
                label="Hide Online Status & Last Seen"
                checked={privacySettings.hideOnlineStatus}
                onChange={(val) => handlePrivacyUpdate("hideOnlineStatus", val)}
            />
        </motion.div>
    );
};

/**
 * AppearanceSettings
 * Manages Theme and Accent Colors.
 */
const AppearanceSettings = () => {
    const { theme, setTheme, accent, setAccent } = useTheme();

    const handleThemeChange = useCallback(
        (newTheme) => {
            setTheme(newTheme);
            const defaultAccents = { dark: "purple", light: "blue", fantasy: "pink" };
            setAccent(defaultAccents[newTheme]);
            toast.success(`Switched to ${newTheme} mode!`);
        },
        [setTheme, setAccent]
    );

    const handleAccentChange = useCallback(
        (accentId) => {
            setAccent(accentId);
            toast.success("Accent color updated! ✨");
        },
        [setAccent]
    );

    const currentAccents = useMemo(() => ACCENT_OPTIONS[theme] || [], [theme]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-10"
        >
            <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-content">
                    <Palette className="text-primary" size={22} /> Base Theme
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {THEME_OPTIONS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleThemeChange(item.id)}
                            className={`relative p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-300 group
                                    ${theme === item.id
                                    ? "bg-primary/5 border-primary text-primary shadow-md scale-[1.02]"
                                    : "bg-main border-adaptive text-muted hover:border-primary/50 hover:bg-surface"
                                }`}
                        >
                            <item.icon
                                size={32}
                                className={`transition-transform duration-300 group-hover:scale-110 ${theme === item.id ? "text-primary" : "text-muted"
                                    }`}
                            />
                            <span className="font-bold">{item.label}</span>
                            {theme === item.id && (
                                <div className="absolute top-3 right-3 bg-primary text-white p-1 rounded-full shadow-sm animate-in zoom-in">
                                    <Check size={12} strokeWidth={4} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </section>

            <section className="p-6 bg-main rounded-3xl border border-adaptive relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 bg-primary h-full"></div>
                <p className="text-xs font-bold text-muted uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    Accent Color
                    <span className="w-10 h-0.5 bg-primary block rounded-full opacity-50"></span>
                </p>
                <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
                    {currentAccents.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleAccentChange(option.id)}
                            className="group flex flex-col items-center gap-2 transition-transform active:scale-95"
                        >
                            <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-[3px]
                                        ${accent === option.id
                                        ? "border-content scale-110 ring-4 ring-opacity-20 ring-offset-2 ring-offset-surface"
                                        : "border-transparent opacity-70 hover:opacity-100 hover:scale-105"
                                    }`}
                                style={{
                                    backgroundColor: option.color,
                                    boxShadow: accent === option.id ? `0 0 15px ${option.color}60` : "none",
                                }}
                            >
                                {accent === option.id && (
                                    <Check className="text-white drop-shadow-md" size={20} strokeWidth={3} />
                                )}
                            </div>
                            <span
                                className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${accent === option.id ? "text-primary" : "text-muted"
                                    }`}
                            >
                                {option.label}
                            </span>
                        </button>
                    ))}
                </div>
            </section>
        </motion.div>
    );
};

/**
 * NotificationSettings
 * Manages Email and Push notifications.
 */
const NotificationSettings = ({ currentUser }) => {
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const [notifSettings, setNotifSettings] = useState({ email: true, push: false });

    useEffect(() => {
        if (currentUser?.notificationSettings) {
            setNotifSettings({
                email: currentUser.notificationSettings.email,
                push: currentUser.notificationSettings.push,
            });
        }
    }, [currentUser]);

    const handleNotificationUpdate = useCallback(
        async (key, value) => {
            setNotifSettings((prev) => ({ ...prev, [key]: value }));

            try {
                const token = await getToken();
                await dispatch(
                    updateNotificationSettings({
                        settings: { [key]: value },
                        token,
                    })
                ).unwrap();

                toast.success(
                    `${key === "email" ? "Email" : "Push"} notifications ${value ? "enabled" : "disabled"
                    }`
                );
            } catch (error) {
                setNotifSettings((prev) => ({ ...prev, [key]: !value }));
                toast.error("Failed to update settings");
            }
        },
        [dispatch, getToken]
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-content border-b border-adaptive pb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Bell className="text-primary" size={24} />
                </div>
                Notification Preferences
            </h2>
            <Toggle
                label="Email Notifications"
                checked={notifSettings.email}
                onChange={(val) => handleNotificationUpdate("email", val)}
            />
            <Toggle
                label="Push Notifications (Browser)"
                checked={notifSettings.push}
                onChange={(val) => handleNotificationUpdate("push", val)}
            />
            <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-start gap-3">
                <Bell size={20} className="text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-bold text-content">Stay in the loop</p>
                    <p className="text-xs text-muted leading-relaxed">
                        Enable notifications to get updates about new followers, comments, and messages. You can change these settings at any time.
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

/**
 * DangerZone
 * Manages deletion or irreversible actions.
 */
const DangerZone = () => (
    <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="border border-red-500/20 bg-red-500/5 rounded-3xl p-8 relative overflow-hidden"
    >
        <div className="absolute top-0 right-0 p-3 opacity-10">
            <ShieldAlert size={100} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-red-500">
            Danger Zone
        </h2>
        <p className="text-muted mb-8 leading-relaxed max-w-lg">
            Deleting your account is permanent. All your data, posts, and connections will be wiped out immediately and cannot be recovered.
        </p>
        <div className="flex justify-start">
            <button
                onClick={() => toast.error("Delete functionality disabled for safety.")}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-900/20 transition hover:scale-105 active:scale-95 flex items-center gap-2"
            >
                <ShieldAlert size={18} /> Delete My Account
            </button>
        </div>
    </motion.div>
);

export default Settings;