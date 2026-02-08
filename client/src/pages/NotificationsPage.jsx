/**
 * @component NotificationsPage
 * @description Manages and displays user notifications with filtering, grouping by date, and interaction handling.
 */

import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next"; // 🟢
import { ar, enUS } from "date-fns/locale"; // 🟢
import {
    Heart,
    MessageCircle,
    Share2,
    Bell,
    UserPlus,
    Reply,
    Trash2,
    CheckCheck,
    CheckCircle2,
    Loader2
} from "lucide-react";

// --- Local & 3rd Party Imports ---
import api from "../lib/axios";

// --- Constants & Helpers ---

const getNotificationStyle = (type) => {
    switch (type) {
        case "like": return { icon: Heart, color: "text-pink-500", bg: "bg-pink-500/10" };
        case "comment": return { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" };
        case "reply": return { icon: Reply, color: "text-indigo-500", bg: "bg-indigo-500/10" };
        case "share": return { icon: Share2, color: "text-orange-500", bg: "bg-orange-500/10" };
        case "follow": return { icon: UserPlus, color: "text-green-500", bg: "bg-green-500/10" };
        case "connection_accept": return { icon: CheckCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" };
        case "follow_accept": return { icon: CheckCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" };
        default: return { icon: Bell, color: "text-muted", bg: "bg-surface" };
    }
};

// --- Sub-Components ---

/**
 * @component NotificationItem
 * @description Memoized individual notification card to prevent list-wide re-renders.
 */
const NotificationItem = memo(({ notification, onRead, onDelete, onClick, t, currentLocale }) => { // 🟢 Receive t & locale
    const style = useMemo(() => getNotificationStyle(notification.type), [notification.type]);
    const Icon = style.icon;

    // Local handlers to stop propagation
    const handleRead = (e) => {
        e.stopPropagation();
        onRead(notification._id);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        onDelete(notification._id);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
            onClick={() => onClick(notification)}
            className={`
                group relative flex items-start gap-4 p-5 rounded-2xl transition-all cursor-pointer border
                ${!notification.read
                    ? "bg-surface shadow-md border-s-4 border-s-primary border-y-adaptive border-e-adaptive" // 🔵 border-s-4 works for RTL
                    : "bg-main border-transparent opacity-80 hover:opacity-100 hover:bg-surface hover:shadow-sm"
                }
            `}
        >
            {/* Icon Badge & Avatar */}
            <div className="relative shrink-0">
                <div className="relative">
                    <img
                        src={notification.sender?.profile_picture || "/avatar-placeholder.png"}
                        alt="user"
                        className={`w-12 h-12 rounded-full object-cover border-2 transition-transform ${!notification.read ? 'border-primary' : 'border-surface'}`}
                        loading="lazy"
                    />
                    <div className="absolute -bottom-1 -end-1 p-0.5 rounded-full bg-surface border border-adaptive shadow-sm"> {/* 🔵 -end-1 */}
                        <div className={`p-1 rounded-full ${style.bg}`}>
                            <Icon className={`w-3 h-3 ${style.color}`} strokeWidth={3} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
                <p className={`text-sm leading-relaxed pe-8 ${!notification.read ? 'text-content font-semibold' : 'text-muted'}`}> {/* 🔵 pe-8 */}
                    <span className="font-bold hover:underline text-content hover:text-primary transition-colors">
                        {notification.sender?.full_name || t("stories.defaultUser")}
                    </span>
                    <span className="mx-1 font-medium opacity-90">
                        {/* 🟢 Dynamic Translation based on Type */}
                        {t(`notifications.types.${notification.type}`)}
                    </span>
                </p>
                {(notification.type === "comment" || notification.type === "reply") && notification.commentId?.text && (
                    <p className="mt-2 text-sm text-muted/90 italic border-s-2 border-primary/30 ps-3 line-clamp-1 bg-main/50 p-1.5 rounded-e-lg"> {/* 🔵 border-s-2 ps-3 */}
                        "{notification.commentId.text}"
                    </p>
                )}
                <p className="text-xs text-muted/60 mt-1.5 font-bold flex items-center gap-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: currentLocale })} {/* 🟢 Localized Time */}
                </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-end gap-3 shrink-0">
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-surface/80 backdrop-blur-sm rounded-full p-1 border border-adaptive sm:shadow-sm">
                    {!notification.read && (
                        <button
                            onClick={handleRead}
                            className="p-1.5 rounded-full hover:bg-main text-muted hover:text-green-500 transition"
                            title={t("notifications.actions.markRead")} // 🟢
                        >
                            <CheckCheck size={14} />
                        </button>
                    )}
                    <button
                        onClick={handleDelete}
                        className="p-1.5 rounded-full hover:bg-main text-muted hover:text-red-500 transition"
                        title={t("notifications.actions.delete")} // 🟢
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
                {notification.post?.image && (
                    <img
                        src={notification.post.image}
                        alt="post"
                        className="w-12 h-12 rounded-xl object-cover border border-adaptive shadow-sm group-hover:scale-105 transition-transform"
                        loading="lazy"
                    />
                )}
                {!notification.read && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-lg animate-pulse mt-auto sm:hidden border border-white/20"></div>
                )}
            </div>
        </motion.div>
    );
});

NotificationItem.displayName = "NotificationItem";

// --- Main Component ---

const NotificationsPage = () => {
    // --- State & Hooks ---
    const [notifications, setNotifications] = useState([]);
    const [activeTab, setActiveTab] = useState("all");
    const [loading, setLoading] = useState(true);

    const { getToken } = useAuth();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation(); // 🟢
    const currentLocale = i18n.language === 'ar' ? ar : enUS; // 🟢

    // 🟢 Memoized TABS with Translation
    const TABS = useMemo(() => [
        { key: "all", label: t("notifications.tabs.all") },
        { key: "like", label: t("notifications.tabs.likes") },
        { key: "comment", label: t("notifications.tabs.comments") },
        { key: "reply", label: t("notifications.tabs.replies") },
        { key: "share", label: t("notifications.tabs.shares") },
        { key: "follow", label: t("notifications.tabs.follows") },
    ], [t]);


    // --- Effects ---

    const fetchNotifications = useCallback(async () => {
        const controller = new AbortController();
        try {
            const token = await getToken();
            const { data } = await api.get("/notifications?filter=interactions", {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal
            });
            if (data.success) {
                setNotifications(data.notifications);
            }
        } catch (error) {
            if (error.name !== "CanceledError") {
                console.error("Error fetching notifications:", error);
            }
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
        return () => controller.abort();
    }, [getToken]);

    useEffect(() => {
        setLoading(true);
        fetchNotifications();
    }, [fetchNotifications]);

    // --- Derived State (Memoized) ---

    const filteredNotifications = useMemo(() => {
        if (activeTab === "all") return notifications;
        return notifications.filter((n) => {
            if (activeTab === "follow") {
                return n.type === "follow" || n.type === "connection_accept" || n.type === "follow_accept";
            }
            return n.type === activeTab;
        });
    }, [activeTab, notifications]);

    const groupedNotifications = useMemo(() => {
        const groups = {
            [t("notifications.groups.today")]: [],
            [t("notifications.groups.yesterday")]: [],
            [t("notifications.groups.earlier")]: []
        }; // 🟢 Dynamic Keys
        filteredNotifications.forEach(n => {
            const date = new Date(n.createdAt);
            if (isToday(date)) groups[t("notifications.groups.today")].push(n);
            else if (isYesterday(date)) groups[t("notifications.groups.yesterday")].push(n);
            else groups[t("notifications.groups.earlier")].push(n);
        });
        return groups;
    }, [filteredNotifications, t]);

    const getUnreadCount = useCallback((type) => {
        if (type === 'all') return notifications.filter(n => !n.read).length;
        if (type === 'follow') {
            return notifications.filter(n =>
                (n.type === 'follow' || n.type === 'connection_accept' || n.type === 'follow_accept') && !n.read
            ).length;
        }
        return notifications.filter(n => n.type === type && !n.read).length;
    }, [notifications]);

    const hasUnreadInCurrentTab = useMemo(() =>
        filteredNotifications.some(n => !n.read),
        [filteredNotifications]);

    // --- Handlers ---

    const handleMarkAllAsRead = useCallback(async () => {
        // Optimistic UI Update
        const updatedNotifications = notifications.map(n => {
            if (activeTab === "all") return { ...n, read: true };
            if (activeTab === "follow" && (n.type === "follow" || n.type === "connection_accept" || n.type === "follow_accept")) {
                return { ...n, read: true };
            }
            if (n.type === activeTab) return { ...n, read: true };
            return n;
        });

        setNotifications(updatedNotifications);
        toast.promise(
            (async () => {
                const token = await getToken();
                await api.put(`/notifications/read-all?type=${activeTab}`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            })(),
            {
                loading: t("notifications.toasts.markingRead"), // 🟢
                success: t("notifications.toasts.allRead"), // 🟢
                error: t("notifications.toasts.failedSync") // 🟢
            }
        );
    }, [notifications, activeTab, getToken, t]);

    const handleMarkAsRead = useCallback(async (id) => {
        // Optimistic
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
        try {
            const token = await getToken();
            await api.put(`/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) { console.error("Failed to mark as read"); }
    }, [getToken]);

    const handleDelete = useCallback(async (id) => {
        // Optimistic
        setNotifications(prev => prev.filter(n => n._id !== id));
        try {
            const token = await getToken();
            await api.delete(`/notifications/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("notifications.toasts.removed")); // 🟢
        } catch (error) {
            toast.error(t("notifications.toasts.failedDelete")); // 🟢
            fetchNotifications(); // Revert on error
        }
    }, [getToken, fetchNotifications, t]);

    const handleNotificationClick = useCallback((notif) => {
        if (!notif.read) handleMarkAsRead(notif._id);

        if (notif.post) navigate(`/post/${notif.post._id}`);
        else if (notif.sender) navigate(`/profile/${notif.sender._id}`);
    }, [handleMarkAsRead, navigate]);

    // --- Render ---

    return (
        <div className="min-h-screen bg-main text-content relative overflow-x-hidden transition-colors duration-300 scrollbar-hide">
            <div className="max-w-4xl mx-auto p-4 pb-20 pt-8">

                {/* Header */}
                <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
                    <div className="text-start"> {/* 🔵 text-start */}
                        <h1 className="text-3xl md:text-4xl font-extrabold text-content mb-1">{t("notifications.title")}</h1> {/* 🟢 */}
                        <p className="text-sm text-muted font-medium">{t("notifications.subtitle")}</p> {/* 🟢 */}
                    </div>
                    {hasUnreadInCurrentTab && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="flex items-center gap-2 px-5 py-2.5 bg-surface hover:bg-main text-primary rounded-xl border border-adaptive transition-all active:scale-95 text-sm font-bold shadow-sm hover:shadow-md"
                        >
                            <CheckCircle2 size={18} />
                            {t("notifications.markAll")} {/* 🟢 */}
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-3 mb-8 overflow-x-auto pb-4 scrollbar-hide">
                    {TABS.map((tab) => {
                        const count = getUnreadCount(tab.key);
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`
                                    relative px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 border whitespace-nowrap flex items-center gap-2 group
                                    ${activeTab === tab.key
                                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/25 scale-105"
                                        : "bg-surface text-muted border-adaptive hover:bg-main hover:text-content hover:border-primary/30"
                                    }
                                `}
                            >
                                {tab.label}
                                {count > 0 && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${activeTab === tab.key ? "bg-white text-primary" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                                        }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* List Content */}
                <div className="space-y-8">
                    {loading ? (
                        // Skeleton Loader
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-2xl bg-surface animate-pulse border border-adaptive h-28 shadow-sm" />
                        ))
                    ) : filteredNotifications.length > 0 ? (
                        Object.entries(groupedNotifications).map(([label, items]) => (
                            items.length > 0 && (
                                <div key={label} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-xs font-black text-muted mb-4 ps-2 uppercase tracking-[0.2em] flex items-center gap-2"> {/* 🔵 ps-2 */}
                                        <span className="w-2 h-2 rounded-full bg-primary/50"></span> {label}
                                    </h3>
                                    <div className="space-y-3">
                                        <AnimatePresence initial={false}>
                                            {items.map((n) => (
                                                <NotificationItem
                                                    key={n._id}
                                                    notification={n}
                                                    onRead={handleMarkAsRead}
                                                    onDelete={handleDelete}
                                                    onClick={handleNotificationClick}
                                                    t={t} // 🟢 Pass t
                                                    currentLocale={currentLocale} // 🟢 Pass locale
                                                />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )
                        ))
                    ) : (
                        // Empty State
                        <div className="flex flex-col items-center justify-center py-24 text-center opacity-60">
                            <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-6 shadow-sm border border-adaptive animate-in zoom-in duration-500">
                                <Bell className="w-10 h-10 text-muted" />
                            </div>
                            <h3 className="text-xl font-bold text-content">{t("notifications.emptyTitle")}</h3> {/* 🟢 */}
                            <p className="text-muted text-sm mt-2 max-w-xs mx-auto">{t("notifications.emptyDesc")}</p> {/* 🟢 */}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsPage;