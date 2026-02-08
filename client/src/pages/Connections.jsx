import React, {
    useEffect,
    useState,
    useMemo,
    useCallback,
    memo
} from "react";

// --- Router & Redux ---
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

// --- Third Party Libraries ---
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
    Users,
    MessageSquare,
    UserCheck,
    UserMinus,
    UserPlus,
    Clock,
    Search,
    X,
} from "lucide-react";

// --- Local Imports ---
import api from "../lib/axios";
import { fetchMyConnections } from "../features/connectionsSlice";
import { fetchUser } from "../features/userSlice";
import { useSocketContext } from "../context/SocketContext";
import ConnectionsSkeleton from "../components/skeletons/ConnectionsSkeleton";
import UserAvatar from "../components/common/UserDefaultAvatar";

/**
 * Connections Component
 * ---------------------
 * Manages the user's network: Followers, Following, Connections, 
 * Pending Requests, and Sent Requests.
 */
const Connections = () => {
    // ========================================================
    // 🌍 Global Hooks
    // ========================================================
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { socket } = useSocketContext();
    const { t } = useTranslation();

    // ========================================================
    // 📊 State & Selectors
    // ========================================================
    const [currentTab, setCurrentTab] = useState("Followers");
    const [searchQuery, setSearchQuery] = useState("");

    const { currentUser } = useSelector((state) => state.user);
    const { connections, pendingRequests, sentRequests, status } = useSelector(
        (state) => state.connections
    );

    // ========================================================
    // 🧠 Derived Data (Memoized)
    // ========================================================

    // 1. Incoming Requests
    const connectionRequests = useMemo(
        () => (pendingRequests || []).map((u) => ({ ...u, requestType: "connection" })),
        [pendingRequests]
    );

    const followRequests = useMemo(
        () => (currentUser?.followRequests || []).map((u) => ({ ...u, requestType: "follow" })),
        [currentUser?.followRequests]
    );

    const combinedReceived = useMemo(
        () => [...connectionRequests, ...followRequests],
        [connectionRequests, followRequests]
    );

    // 2. Outgoing Requests
    const mySentRequests = useMemo(
        () => (sentRequests || []).map((u) => ({ ...u, requestType: "connection" })),
        [sentRequests]
    );

    // 3. Tab Configuration
    const tabs = useMemo(
        () => [
            { id: "Followers", label: t("connections.tabs.followers"), data: currentUser?.followers || [], icon: Users },
            { id: "Following", label: t("connections.tabs.following"), data: currentUser?.following || [], icon: UserPlus },
            { id: "Connections", label: t("connections.tabs.friends"), data: connections, icon: MessageSquare },
            { id: "Pending", label: t("connections.tabs.requests"), data: combinedReceived, icon: UserCheck },
            { id: "Sent", label: t("connections.tabs.sent"), data: mySentRequests, icon: Clock },
        ],
        [currentUser, connections, combinedReceived, mySentRequests, t]
    );

    // 4. Filtered Data
    const activeData = useMemo(() => {
        const currentTabData = tabs.find((t) => t.id === currentTab)?.data || [];
        if (!searchQuery) return currentTabData;

        const lowerQuery = searchQuery.toLowerCase();
        return currentTabData.filter(
            (user) =>
                user.full_name?.toLowerCase().includes(lowerQuery) ||
                user.username?.toLowerCase().includes(lowerQuery)
        );
    }, [tabs, currentTab, searchQuery]);

    // ========================================================
    // ⚡ Handlers & Actions
    // ========================================================

    const handleRefresh = useCallback(() => {
        getToken().then((token) => {
            if (token) {
                dispatch(fetchMyConnections(token));
                dispatch(fetchUser(token));
            }
        });
    }, [getToken, dispatch]);

    const handleMarkAsSeen = useCallback(async () => {
        try {
            const token = await getToken();
            await api.put(
                "/notifications/mark-network-read",
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error("Failed to mark network as read", error);
        }
    }, [getToken]);

    // --- Follow Actions ---
    const handleAcceptFollow = useCallback(async (userId) => {
        try {
            const token = await getToken();
            await api.post(`/user/follow-request/accept/${userId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("connections.toasts.followAccepted"));
            dispatch(fetchUser(token));
        } catch (error) { toast.error(t("connections.toasts.failed")); }
    }, [getToken, dispatch, t]);

    const handleDeclineFollow = useCallback(async (userId) => {
        try {
            const token = await getToken();
            await api.post(`/user/follow-request/decline/${userId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("connections.toasts.followDeclined"));
            dispatch(fetchUser(token));
        } catch (error) { toast.error(t("connections.toasts.failed")); }
    }, [getToken, dispatch, t]);

    const handleUnfollow = useCallback(async (userId) => {
        try {
            const token = await getToken();
            await api.post(`/user/unfollow/${userId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("connections.toasts.unfollowed"));
            dispatch(fetchMyConnections(token));
            dispatch(fetchUser(token));
        } catch (error) { toast.error(t("connections.toasts.failed")); }
    }, [getToken, dispatch, t]);

    // --- Connection Actions ---
    const handleAcceptConnection = useCallback(async (userId) => {
        const toastId = toast.loading(t("connections.toasts.accepting"));
        try {
            const token = await getToken();
            const { data } = await api.post(`/connection/accept/${userId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) {
                toast.success(t("connections.toasts.connected"), { id: toastId });
                dispatch(fetchMyConnections(token));
            }
        } catch (error) { toast.error(t("connections.toasts.failed"), { id: toastId }); }
    }, [getToken, dispatch, t]);

    const handleRejectConnection = useCallback(async (userId) => {
        if (!confirm(t("connections.toasts.rejectConfirm"))) return;
        try {
            const token = await getToken();
            await api.post(`/connection/reject/${userId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("connections.toasts.requestRemoved"));
            dispatch(fetchMyConnections(token));
        } catch (error) { toast.error(t("connections.toasts.failed")); }
    }, [getToken, dispatch, t]);

    // ========================================================
    // 🔄 Effects
    // ========================================================

    useEffect(() => {
        if (!socket) return;
        const onNotification = (notification) => {
            if (["connection_request", "connection_accept", "follow_request"].includes(notification.type)) {
                handleRefresh();
            }
        };
        socket.on("newNotification", onNotification);
        socket.on("connectionRemoved", handleRefresh);
        return () => {
            socket.off("newNotification", onNotification);
            socket.off("connectionRemoved", handleRefresh);
        };
    }, [socket, handleRefresh]);

    useEffect(() => { handleMarkAsSeen(); }, [handleMarkAsSeen]);
    useEffect(() => { handleRefresh(); }, [handleRefresh]);

    // ========================================================
    // 🎨 Render
    // ========================================================

    return (
        <div className="min-h-dvh flex flex-col bg-main text-content pt-8 pb-20 overflow-x-hidden transition-colors duration-300">
            <div className="flex-1 max-w-6xl w-full mx-auto px-4 flex flex-col">

                {/* --- Header & Search --- */}
                <ConnectionsHeader
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    currentTab={currentTab}
                    t={t}
                />

                {/* --- Tabs --- */}
                <ConnectionsTabs
                    tabs={tabs}
                    currentTab={currentTab}
                    setCurrentTab={setCurrentTab}
                    setSearchQuery={setSearchQuery}
                />

                {/* --- Grid Content --- */}
                <div className="flex-1">
                    {status === "loading" && activeData.length === 0 ? (
                        <ConnectionsSkeleton />
                    ) : (
                        <motion.div
                            key={currentTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-full items-start"
                        >
                            <AnimatePresence mode="popLayout">
                                {activeData.length === 0 ? (
                                    <EmptyState searchQuery={searchQuery} currentTab={currentTab} t={t} />
                                ) : (
                                    activeData.map((user, index) => (
                                        <ConnectionCard
                                            key={user._id || user.id || `user-${index}`}
                                            user={user}
                                            type={currentTab}
                                            requestType={user.requestType}
                                            onUnfollow={handleUnfollow}
                                            onAccept={handleAcceptConnection}
                                            onReject={handleRejectConnection}
                                            onAcceptFollow={handleAcceptFollow}
                                            onDeclineFollow={handleDeclineFollow}
                                            navigate={navigate}
                                            t={t}
                                        />
                                    ))
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ========================================================
// 🧩 Sub-Components
// ========================================================

/**
 * Header Section (Title + Search)
 */
const ConnectionsHeader = memo(({ searchQuery, setSearchQuery, currentTab, t }) => (
    <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="w-full text-start md:text-start">
            <h1 className="text-3xl md:text-4xl font-extrabold text-content mb-1">
                {t("connections.pageTitle")}
            </h1>
            <p className="text-muted text-sm font-medium">
                {t("connections.pageSubtitle")}
            </p>
        </div>

        <div className="relative w-full md:w-72 group">
            <div className="relative flex items-center bg-surface rounded-xl p-1 border border-adaptive focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300 shadow-sm">
                <Search className="ms-3 text-muted w-4 h-4 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder={t("connections.searchPlaceholder", { tab: currentTab })}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-content px-3 py-2 text-sm focus:outline-none border-none outline-none ring-0 placeholder-muted/70"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery("")}
                        className="p-1 me-1 text-muted hover:text-primary hover:bg-main rounded-full transition"
                        aria-label="Clear search"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>
    </header>
));

/**
 * Tabs Navigation
 */
const ConnectionsTabs = memo(({ tabs, currentTab, setCurrentTab, setSearchQuery }) => (
    <div className="relative mb-8">
        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible gap-2 border-b border-adaptive scrollbar-hide scroll-smooth">
            {tabs.map((tab) => {
                const hasPendingAction = tab.id === "Pending" && tab.data?.length > 0;
                const isActive = currentTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setCurrentTab(tab.id);
                            setSearchQuery("");
                        }}
                        className={`shrink-0 flex items-center gap-2 px-4 py-3 rounded-t-xl font-bold transition-all relative group whitespace-nowrap
                            ${isActive
                                ? "text-primary bg-primary/5"
                                : "text-muted hover:text-content hover:bg-surface/50"
                            }`}
                    >
                        <tab.icon
                            size={18}
                            className={`transition-colors ${isActive ? "text-primary" : "text-muted group-hover:text-content"}`}
                        />
                        <span className="text-sm md:text-base">{tab.label}</span>

                        <span className={`text-[10px] h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full font-extrabold transition-all duration-300
                            ${hasPendingAction
                                ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30 scale-110"
                                : isActive
                                    ? "bg-primary text-white shadow-sm shadow-primary/30"
                                    : "bg-adaptive text-muted group-hover:bg-main group-hover:text-content"
                            }`}
                        >
                            {tab.data?.length || 0}
                        </span>

                        {isActive && (
                            <motion.div
                                layoutId="activeConnectionTab"
                                className="absolute bottom-0 start-0 end-0 h-0.5 bg-primary rounded-t-full"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    </div>
));

/**
 * Empty State Component
 */
const EmptyState = ({ searchQuery, currentTab, t }) => (
    <div className="col-span-full flex flex-col items-center justify-center h-full min-h-[40vh] opacity-60">
        <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mb-4 border border-adaptive group hover:border-primary/50 transition-colors">
            <Users size={32} className="text-muted group-hover:text-primary transition-colors" />
        </div>
        <p className="text-lg font-bold text-muted">
            {searchQuery
                ? t("connections.noResults", { query: searchQuery })
                : t("connections.emptyTab", { tab: currentTab })}
        </p>
    </div>
);

/**
 * Individual User Card (Memoized)
 */
const ConnectionCard = memo(({
    user, type, requestType, onUnfollow, onAccept, onReject,
    onAcceptFollow, onDeclineFollow, navigate, t
}) => {

    const handleProfileClick = useCallback((e) => {
        e.stopPropagation();
        navigate(`/profile/${user._id}`);
    }, [navigate, user._id]);

    return (
        <motion.div
            layout // Smooth layout transitions
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            whileHover={{ y: -4 }}
            className="group relative bg-surface hover:bg-surface/80 border border-adaptive hover:border-primary/40 rounded-2xl p-4 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-primary/5"
        >
            <div className="flex items-start gap-4">
                <div className="relative shrink-0 cursor-pointer" onClick={handleProfileClick}>
                    <UserAvatar
                        user={user}
                        className="w-14 h-14 rounded-full border border-adaptive group-hover:border-primary transition-colors"
                    />
                </div>

                <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-bold text-content text-base truncate cursor-pointer hover:text-primary transition-colors" onClick={handleProfileClick}>
                        {user?.full_name}
                    </h3>
                    <p className="text-xs text-muted truncate">{user?.username}</p>
                    {type === "Pending" && (
                        <span className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded border ${requestType === "follow" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"}`}>
                            {requestType === "follow" ? t("connections.types.follow") : t("connections.types.connection")}
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-adaptive flex gap-2">
                {type === "Followers" && (
                    <button onClick={handleProfileClick} className="flex-1 py-2 rounded-xl bg-main hover:bg-surface border border-adaptive text-content text-xs font-bold transition hover:text-primary">
                        {t("connections.actions.viewProfile")}
                    </button>
                )}

                {type === "Following" && (
                    <>
                        <button onClick={handleProfileClick} className="flex-1 py-2 rounded-xl bg-main hover:bg-surface border border-adaptive text-content text-xs font-bold transition hover:text-primary">
                            {t("connections.actions.view")}
                        </button>
                        <button onClick={() => onUnfollow(user._id)} className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-eed-500/20 text-xs font-bold transition" aria-label="Unfollow">
                            <UserMinus size={16} />
                        </button>
                    </>
                )}

                {type === "Pending" && (
                    <>
                        {requestType === "follow" ? (
                            <>
                                <button onClick={() => onAcceptFollow(user._id)} className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold transition flex items-center justify-center gap-2 hover:opacity-90">
                                    <UserPlus size={16} /> {t("connections.actions.confirm")}
                                </button>
                                <button onClick={() => onDeclineFollow(user._id)} className="px-3 py-2 rounded-xl bg-surface border border-adaptive hover:bg-red-50 text-muted hover:text-red-500 text-xs font-bold transition">
                                    <X size={18} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => onAccept(user._id)} className="flex-1 py-2 rounded-xl bg-green-600 text-white text-xs font-bold transition flex items-center justify-center gap-2 hover:bg-green-700 shadow-lg shadow-green-900/20">
                                    <UserCheck size={16} /> {t("connections.actions.accept")}
                                </button>
                                <button onClick={() => onReject(user._id)} className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-eed-500/20 text-xs font-bold transition">
                                    <X size={18} />
                                </button>
                            </>
                        )}
                    </>
                )}

                {type === "Sent" && (
                    <button onClick={() => requestType === "follow" ? onUnfollow(user._id) : onReject(user._id)} className="flex-1 py-2 rounded-xl bg-surface/50 hover:bg-red-500/10 hover:text-red-500 text-muted border border-adaptive hover:border-eed-500/20 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer">
                        <Clock size={16} />
                        {requestType === "follow" ? t("connections.actions.cancelFollow") : t("connections.actions.cancelRequest")}
                    </button>
                )}

                {type === "Connections" && (
                    <button onClick={() => navigate(`/messages/${user._id}`)} className="flex-1 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                        <MessageSquare size={16} /> {t("connections.actions.message")}
                    </button>
                )}
            </div>
        </motion.div>
    );
});

export default Connections;