/**
 * Settings Component
 * ------------------------------------------------------------------
 * Architect: Senior Frontend Architect
 * Purpose: Manages user preferences (Profile, Privacy, Theme, Notifications).
 * * Optimizations:
 * - Memoized all sub-components to prevent re-renders on tab switching.
 * - integrated toast.promise for async form submissions.
 * - Standardized Framer Motion variants for layout transitions.
 * - Strict RTL/LTR logical property usage.
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

// Icons
import {
    User, Lock, Palette, Bell, ShieldAlert, Save, Loader2,
    Moon, Sun, Monitor, Check, Earth, ChevronDown
} from "lucide-react";

// Local Imports
import { updateUser, updatePrivacy, updateNotificationSettings } from "../features/userSlice";
import { useTheme } from "../context/ThemeContext";
import { useSocketContext } from "../context/SocketContext";

// --- Constants & Config ---

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

const tabVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
};

// --- Sub-Components (Memoized) ---

/**
 * Toggle Component
 * Reusable switch with RTL support.
 */
const Toggle = memo(({ label, checked, onChange }) => (
    <div
        className="flex items-center justify-between p-4 bg-surface rounded-xl border border-adaptive hover:border-primary/40 transition-colors group cursor-pointer"
        onClick={() => onChange(!checked)}
    >
        <span className="text-content font-medium group-hover:text-primary transition-colors">
            {label}
        </span>
        <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ease-in-out ${checked ? "bg-primary" : "bg-muted/30"}`}>
            <div className={`absolute top-1 start-1 bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${checked ? "translate-x-6 rtl:-translate-x-6" : "translate-x-0"}`} />
        </div>
    </div>
));

/**
 * TabButton Component
 * Navigation button for settings categories.
 */
const TabButton = memo(({ tab, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 relative overflow-hidden group whitespace-nowrap
      ${isActive ? "text-primary bg-primary/10 shadow-sm" : "text-muted hover:text-content hover:bg-surface"}`}
    >
        <span className="relative z-10 flex items-center gap-2 text-sm md:text-base">
            {tab.icon} {tab.label}
        </span>
        {isActive && (
            <motion.div layoutId="activeSettingTab" className="absolute bottom-0 start-0 end-0 h-0.5 bg-primary" />
        )}
    </button>
));

/**
 * GeneralSettings
 * Manages user profile data. optimized with toast.promise.
 */
const GeneralSettings = memo(({ currentUser }) => {
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const { t } = useTranslation();

    const [formData, setFormData] = useState({
        full_name: currentUser?.full_name || "",
        username: currentUser?.username || "",
        bio: currentUser?.bio || "",
    });

    // Sync state if currentUser updates externally
    useEffect(() => {
        if (currentUser) {
            setFormData({
                full_name: currentUser.full_name || "",
                username: currentUser.username || "",
                bio: currentUser.bio || "",
            });
        }
    }, [currentUser]);

    const handleSaveGeneral = useCallback(async (e) => {
        e.preventDefault();
        const token = await getToken();
        const data = new FormData();
        data.append("full_name", formData.full_name);
        data.append("username", formData.username);
        data.append("bio", formData.bio);

        toast.promise(
            dispatch(updateUser({ formData: data, token })).unwrap(),
            {
                loading: t("settings.general.saving"),
                success: t("settings.general.success"),
                error: t("settings.general.error"),
            }
        );
    }, [dispatch, formData, getToken, t]);

    return (
        <motion.div variants={tabVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3 }}>
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-content border-b border-adaptive pb-4">
                <div className="p-2 bg-primary/10 rounded-sg"><User className="text-primary" size={24} /></div>
                {t("settings.general.title")}
            </h2>
            <form onSubmit={handleSaveGeneral} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted ms-1 uppercase tracking-wider">{t("settings.general.fullName")}</label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full bg-main border border-adaptive rounded-xl px-4 py-3 text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder-muted/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted ms-1 uppercase tracking-wider">{t("settings.general.username")}</label>
                        <div className="relative">
                            <span className="absolute start-4 top-1/2 -translate-y-1/2 text-muted font-bold">@</span>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase() })}
                                className="w-full bg-main border border-adaptive rounded-xl ps-8 pe-4 py-3 text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder-muted/50"
                                placeholder="username"
                                minLength={4}
                                maxLength={20}
                            />
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-muted ms-1 uppercase tracking-wider">{t("settings.general.bio")}</label>
                    <textarea
                        rows="4"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        className="w-full bg-main border border-adaptive rounded-xl px-4 py-3 text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none placeholder-muted/50"
                        placeholder={t("settings.general.bioPlaceholder")}
                    />
                </div>
                <div className="flex justify-end pt-4 border-t border-adaptive">
                    <button type="submit" className="bg-primary hover:opacity-90 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2">
                        <Save size={20} /> {t("settings.general.saveBtn")}
                    </button>
                </div>
            </form>
        </motion.div>
    );
});

/**
 * PrivacySettings
 * Manages account visibility.
 */
const PrivacySettings = memo(({ currentUser }) => {
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const { socket } = useSocketContext();
    const { t } = useTranslation();

    const [privacySettings, setPrivacySettings] = useState({
        isPrivate: currentUser?.isPrivate || false,
        hideOnlineStatus: currentUser?.hideOnlineStatus || false,
    });

    const handlePrivacyUpdate = useCallback(async (key, value) => {
        // Optimistic Update
        setPrivacySettings((prev) => ({ ...prev, [key]: value }));
        try {
            const token = await getToken();
            await dispatch(updatePrivacy({ settings: { [key]: value }, token })).unwrap();
            if (key === "hideOnlineStatus" && socket) {
                socket.emit("toggleOnlineStatus", { isHidden: value });
            }
            toast.success(t("settings.privacy.success"));
        } catch (error) {
            setPrivacySettings((prev) => ({ ...prev, [key]: !value })); // Revert
            toast.error(t("settings.privacy.error"));
        }
    }, [dispatch, getToken, socket, t]);

    return (
        <motion.div variants={tabVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3 }} className="space-y-6">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-content border-b border-adaptive pb-4">
                <div className="p-2 bg-primary/10 rounded-sg"><Lock className="text-primary" size={24} /></div>
                {t("settings.privacy.title")}
            </h2>
            <Toggle label={t("settings.privacy.privateProfile")} checked={privacySettings.isPrivate} onChange={(val) => handlePrivacyUpdate("isPrivate", val)} />
            <Toggle label={t("settings.privacy.hideStatus")} checked={privacySettings.hideOnlineStatus} onChange={(val) => handlePrivacyUpdate("hideOnlineStatus", val)} />
        </motion.div>
    );
});

/**
 * AppearanceSettings
 * Manages Theme and Accent Colors.
 */
const AppearanceSettings = memo(() => {
    const { theme, setTheme, accent, setAccent } = useTheme();
    const { t } = useTranslation();

    const handleThemeChange = useCallback((newTheme) => {
        setTheme(newTheme);
        const defaultAccents = { dark: "purple", light: "blue", fantasy: "pink" };
        setAccent(defaultAccents[newTheme]);
        toast.success(t("settings.appearance.themeChanged", { theme: newTheme }));
    }, [setTheme, setAccent, t]);

    const handleAccentChange = useCallback((accentId) => {
        setAccent(accentId);
        toast.success(t("settings.appearance.accentChanged"));
    }, [setAccent, t]);

    const currentAccents = useMemo(() => ACCENT_OPTIONS[theme] || [], [theme]);

    return (
        <motion.div variants={tabVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3 }} className="space-y-10">
            <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-content">
                    <Palette className="text-primary" size={22} /> {t("settings.appearance.baseTheme")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {THEME_OPTIONS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleThemeChange(item.id)}
                            className={`relative p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-300 group
                ${theme === item.id ? "bg-primary/5 border-primary text-primary shadow-md scale-[1.02]" : "bg-main border-adaptive text-muted hover:border-primary/50 hover:bg-surface"}`}
                        >
                            <item.icon size={32} className={`transition-transform duration-300 group-hover:scale-110 ${theme === item.id ? "text-primary" : "text-muted"}`} />
                            <span className="font-bold">{t(`settings.appearance.themes.${item.id}`)}</span>
                            {theme === item.id && (
                                <div className="absolute top-3 end-3 bg-primary text-white p-1 rounded-full shadow-sm animate-in zoom-in">
                                    <Check size={12} strokeWidth={4} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </section>

            <section className="p-6 bg-main rounded-3xl border border-adaptive relative overflow-hidden">
                <div className="absolute top-0 start-0 w-1 bg-primary h-full"></div>
                <p className="text-xs font-bold text-muted uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    {t("settings.appearance.accentColor")}
                    <span className="w-10 h-0.5 bg-primary block rounded-full opacity-50"></span>
                </p>
                <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
                    {currentAccents.map((option) => (
                        <button key={option.id} onClick={() => handleAccentChange(option.id)} className="group flex flex-col items-center gap-2 transition-transform active:scale-95">
                            <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-[3px]
                  ${accent === option.id ? "border-content scale-110 ring-4 ring-opacity-20 ring-offset-2 ring-offset-surface" : "border-transparent opacity-70 hover:opacity-100 hover:scale-105"}`}
                                style={{ backgroundColor: option.color, boxShadow: accent === option.id ? `0 0 15px ${option.color}60` : "none" }}
                            >
                                {accent === option.id && <Check className="text-white drop-shadow-md" size={20} strokeWidth={3} />}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${accent === option.id ? "text-primary" : "text-muted"}`}>{option.label}</span>
                        </button>
                    ))}
                </div>
            </section>
        </motion.div>
    );
});

/**
 * NotificationSettings
 * Manages push and email preferences.
 */
const NotificationSettings = memo(({ currentUser }) => {
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const { t } = useTranslation();

    const [notifSettings, setNotifSettings] = useState({
        email: currentUser?.notificationSettings?.email ?? true,
        push: currentUser?.notificationSettings?.push ?? false,
    });

    const handleNotificationUpdate = useCallback(async (key, value) => {
        setNotifSettings((prev) => ({ ...prev, [key]: value })); // Optimistic
        try {
            const token = await getToken();
            await dispatch(updateNotificationSettings({ settings: { [key]: value }, token })).unwrap();
            toast.success(t("settings.notifications.success"));
        } catch (error) {
            setNotifSettings((prev) => ({ ...prev, [key]: !value })); // Revert
            toast.error(t("settings.notifications.error"));
        }
    }, [dispatch, getToken, t]);

    return (
        <motion.div variants={tabVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3 }} className="space-y-6">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-content border-b border-adaptive pb-4">
                <div className="p-2 bg-primary/10 rounded-sg"><Bell className="text-primary" size={24} /></div>
                {t("settings.notifications.title")}
            </h2>
            <Toggle label={t("settings.notifications.email")} checked={notifSettings.email} onChange={(val) => handleNotificationUpdate("email", val)} />
            <Toggle label={t("settings.notifications.push")} checked={notifSettings.push} onChange={(val) => handleNotificationUpdate("push", val)} />
            <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-start gap-3">
                <Bell size={20} className="text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-bold text-content">{t("settings.notifications.infoTitle")}</p>
                    <p className="text-xs text-muted leading-relaxed">{t("settings.notifications.infoDesc")}</p>
                </div>
            </div>
        </motion.div>
    );
});

/**
 * LanguageSettings
 * Handles i18n switching.
 */
const LanguageSettings = memo(() => {
    const { i18n, t } = useTranslation();

    const changeLanguage = (lang) => {
        i18n.changeLanguage(lang);
        toast.success(lang === 'ar' ? 'تم تغيير اللغة للعربية' : 'Switched to English');
    };

    return (
        <motion.div variants={tabVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3 }} className="space-y-6">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-content border-b border-adaptive pb-4">
                <div className="p-2 bg-primary/10 rounded-sg"><Earth className="text-primary" size={24} /></div>
                {t("settings.language.title")}
            </h2>
            <div className="grid gap-4">
                <button onClick={() => changeLanguage('en')} className={`p-4 rounded-xl border text-start flex items-center justify-between transition-all ${i18n.language === 'en' ? 'border-primary bg-primary/5' : 'border-adaptive hover:bg-surface'}`}>
                    <span className="font-bold">🇺🇸 English</span>
                    {i18n.language === 'en' && <Check className="text-primary" />}
                </button>
                <button onClick={() => changeLanguage('ar')} className={`p-4 rounded-xl border text-start flex items-center justify-between transition-all ${i18n.language === 'ar' ? 'border-primary bg-primary/5' : 'border-adaptive hover:bg-surface'}`}>
                    <span className="font-bold">🇪🇬 العربية</span>
                    {i18n.language === 'ar' && <Check className="text-primary" />}
                </button>
            </div>
        </motion.div>
    );
});

/**
 * DangerZone
 * Destructive actions section.
 */
const DangerZone = memo(() => {
    const { t } = useTranslation();
    return (
        <motion.div variants={tabVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3 }} className="border border-red-500/20 bg-red-500/5 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-0 end-0 p-3 opacity-10"><ShieldAlert size={100} className="text-red-500" /></div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-red-500">{t("settings.danger.title")}</h2>
            <p className="text-muted mb-8 leading-relaxed max-w-lg">{t("settings.danger.desc")}</p>
            <div className="flex justify-start">
                <button onClick={() => toast.error(t("settings.danger.disabledMsg"))} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-900/20 transition hover:scale-105 active:scale-95 flex items-center gap-2">
                    <ShieldAlert size={18} /> {t("settings.danger.deleteBtn")}
                </button>
            </div>
        </motion.div>
    );
});

// --- Main Settings Component ---

const Settings = () => {
    const { currentUser } = useSelector((state) => state.user);
    const [activeTab, setActiveTab] = useState("general");
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { t } = useTranslation();

    const TABS = useMemo(() => [
        { id: "general", label: t("settings.tabs.general"), icon: <User className="w-4 h-4" /> },
        { id: "privacy", label: t("settings.tabs.privacy"), icon: <Lock className="w-4 h-4" /> },
        { id: "appearance", label: t("settings.tabs.appearance"), icon: <Palette className="w-4 h-4" /> },
        { id: "notifications", label: t("settings.tabs.notifications"), icon: <Bell className="w-4 h-4" /> },
        { id: "language", label: t("settings.tabs.language"), icon: <Earth className="w-4 h-4" /> },
        { id: "danger", label: t("settings.tabs.danger"), icon: <ShieldAlert className="w-4 h-4" /> },
    ], [t]);

    return (
        <div className="min-h-screen bg-main text-content p-4 md:p-8 overflow-x-hidden transition-colors duration-300">
            <div className="max-w-4xl mx-auto mt-6">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-start mb-8 md:mb-10">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-content flex items-center gap-3">{t("settings.header.title")}</h1>
                    <p className="text-muted text-sm md:text-base mt-2 font-medium">{t("settings.header.subtitle")}</p>
                </motion.div>

                {/* Tabs Navigation */}
                <div className="relative mb-10">
                    {/* Mobile Menu */}
                    <div className="sm:hidden relative z-50">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="w-full flex items-center justify-between bg-surface border border-adaptive rounded-xl px-4 py-3 text-content font-bold shadow-sm transition-all active:scale-[0.99]"
                        >
                            <span className="flex items-center gap-2">
                                {TABS.find(t => t.id === activeTab)?.icon}
                                {TABS.find(t => t.id === activeTab)?.label}
                            </span>
                            <ChevronDown size={18} className={`transition-transform duration-300 ${isMobileMenuOpen ? "rotate-180 text-primary" : "text-muted"}`} />
                        </button>
                        <AnimatePresence>
                            {isMobileMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsMobileMenuOpen(false)} />
                                    <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} transition={{ duration: 0.2 }} className="absolute top-full mt-2 left-0 right-0 bg-surface border border-adaptive rounded-xl shadow-xl z-50 overflow-hidden">
                                        {TABS.map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-primary/10 text-primary border-s-4 border-primary" : "text-muted hover:bg-main hover:text-content"}`}
                                            >
                                                {tab.icon} {tab.label}
                                                {activeTab === tab.id && <Check size={16} className="ms-auto" />}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Desktop Tabs */}
                    <div className="hidden sm:flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:flex-wrap md:justify-start gap-3 scrollbar-hide scroll-smooth">
                        {TABS.map((tab) => (
                            <TabButton key={tab.id} tab={tab} isActive={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
                        ))}
                    </div>
                    <div className="hidden sm:block absolute bottom-0 start-0 end-0 h-[1px] bg-adaptive -z-10" />
                </div>

                {/* Content Area */}
                <div className="bg-surface border border-adaptive rounded-3xl p-6 md:p-10 shadow-xl min-h-[400px]">
                    <AnimatePresence mode="wait">
                        {activeTab === "general" && <GeneralSettings key="general" currentUser={currentUser} />}
                        {activeTab === "privacy" && <PrivacySettings key="privacy" currentUser={currentUser} />}
                        {activeTab === "appearance" && <AppearanceSettings key="appearance" />}
                        {activeTab === "notifications" && <NotificationSettings key="notifications" currentUser={currentUser} />}
                        {activeTab === "language" && <LanguageSettings key="language" />}
                        {activeTab === "danger" && <DangerZone key="danger" />}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default Settings;