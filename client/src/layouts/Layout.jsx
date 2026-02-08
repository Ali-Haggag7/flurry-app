/**
 * @file Layout.jsx
 * @description Main application layout wrapper. Handles global state, 
 * real-time socket notifications, navigation headers, and responsive structures.
 * @module Layouts
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { Menu, Bell, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next"; // 🟢 Import translation hook

// --- Local Imports ---
import Sidebar from "../layouts/Sidebar";
import Loading from "../components/common/Loading";
import Logo from "../components/common/Logo";
import api from "../lib/axios";
import { fetchUser } from "../features/userSlice";
import { fetchMyConnections } from "../features/connectionsSlice";
import { useSocketContext } from "../context/SocketContext";

/**
 * Main Layout Component
 */
const Layout = () => {
    // --- Global State ---
    const { currentUser, status } = useSelector((state) => state.user);
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const { socket } = useSocketContext();
    const { t } = useTranslation(); // 🟢 Hook initialization for Toasts

    // --- Router Hooks ---
    const navigate = useNavigate();
    const location = useLocation();

    // --- Local State ---
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [networkCount, setNetworkCount] = useState(0);
    const [isScrolled, setIsScrolled] = useState(false);
    const [feedType, setFeedType] = useState("for-you");

    // --- Logic: Route Detection ---
    /**
     * Smart Route Detection to toggle header/sidebar states.
     * Memoized to prevent recalculation on unrelated re-renders.
     */
    const { isFeedPage, isChatPage, isPostPage, isNetworkPage } = useMemo(() => {
        const path = location.pathname;

        // Path for discovery pages to exclude from chat logic
        const isGroupsDiscovery = path === "/groups" || path === "/groups/available";

        return {
            isFeedPage: path === "/",
            isChatPage: path.startsWith("/messages/") || (path.startsWith("/groups/") && !isGroupsDiscovery),
            isPostPage: path.startsWith("/post/"),
            isNetworkPage: path.startsWith("/profile/")
        };
    }, [location.pathname]);

    // --- Handlers ---

    /**
     * Fetches notification and network counts from the API.
     */
    const fetchCounts = useCallback(async () => {
        if (!currentUser) return;
        try {
            const token = await getToken();
            if (!token) return;

            const [notifRes, netRes] = await Promise.all([
                api.get("/notifications/unread-count", { headers: { Authorization: `Bearer ${token}` } }),
                api.get("/notifications/network-counts", { headers: { Authorization: `Bearer ${token}` } })
            ]);

            if (notifRes.data.success) setUnreadCount(notifRes.data.count);
            if (netRes.data) setNetworkCount(netRes.data.count);

        } catch (error) {
            console.error("Sync failed", error);
        }
    }, [currentUser, getToken]);

    const handleBellClick = useCallback(() => {
        setUnreadCount(0);
        navigate('/notifications');
    }, [navigate]);

    const handleLogoClick = useCallback(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (!isFeedPage) navigate('/');
    }, [isFeedPage, navigate]);

    const handleMenuClick = useCallback(() => {
        setSidebarOpen(true);
    }, []);

    // --- Effects ---

    // 1. Load User & Initial Data
    useEffect(() => {
        const loadInitialData = async () => {
            const token = await getToken();
            if (token) {
                if (!currentUser) await dispatch(fetchUser(token));
                dispatch(fetchMyConnections(token));
            }
        };
        loadInitialData();
    }, [currentUser, dispatch, getToken]);

    // 2. Socket Logic (Real-time Notifications)
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notification) => {
            // Logic: Distinguish between connection requests and general alerts
            if (["connection_request", "follow_request"].includes(notification.type)) {
                setNetworkCount(prev => prev + 1);
                const toastId = `req-${notification._id}`;
                // 🟢 Translated Toast with dynamic values
                toast(t("layout.toast.newRequest", { name: notification.sender?.full_name || t("layout.toast.someone") }), { icon: '👋', id: toastId });
            } else {
                setUnreadCount(prev => prev + 1);
                // Prevent toast if user is already chatting with sender
                const toastId = `notif-${notification._id}`;
                // 🟢 Translated Toast with dynamic values
                toast(t("layout.toast.newNotification", { name: notification.sender?.full_name }), { icon: '🔔', id: toastId });
            }

            // Play Sound
            const sound = new Audio("/notification.mp3");
            sound.play().catch(() => { });
        };

        socket.on("newNotification", handleNewNotification);

        // Cleanup listener
        return () => socket.off("newNotification", handleNewNotification);
    }, [socket, currentUser, t]); // 🟢 Added 't' to dependencies

    // 3. Polling (Background Sync)
    useEffect(() => {
        if (currentUser) {
            fetchCounts();
            const interval = setInterval(fetchCounts, 60000); // 60 seconds
            return () => clearInterval(interval);
        }
    }, [fetchCounts, currentUser]);

    // 4. Scroll Effect (Performance Optimized)
    useEffect(() => {
        if (!isFeedPage) return;

        const handleScroll = () => {
            const shouldBeScrolled = window.scrollY > 10;
            if (isScrolled !== shouldBeScrolled) {
                setIsScrolled(shouldBeScrolled);
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [isFeedPage, isScrolled]);

    // --- Render Guard ---
    if (status === "loading" && !currentUser) return <Loading />;
    if (!currentUser) return null; // Or redirect logic

    return (
        <div className="min-h-screen bg-main text-content transition-colors duration-300">

            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                networkCount={networkCount}
            />

            {/* Smart Header Render */}
            {!isChatPage && (
                isFeedPage ? (
                    <FeedHeader
                        isScrolled={isScrolled}
                        handleLogoClick={handleLogoClick}
                        feedType={feedType}
                        setFeedType={setFeedType}
                        navigate={navigate}
                        handleBellClick={handleBellClick}
                        handleMenuClick={handleMenuClick}
                        unreadCount={unreadCount}
                        t={t} // 🟢 Pass t function
                    />
                ) : (
                    <div className={isPostPage || isNetworkPage ? "hidden md:block" : "block"}>
                        <SecondaryHeader
                            handleLogoClick={() => navigate('/')}
                            handleBellClick={handleBellClick}
                            handleMenuClick={handleMenuClick}
                            unreadCount={unreadCount}
                            t={t} // 🟢 Pass t function
                        />
                    </div>
                )
            )}

            {/* Main Content Area */}
            <main className={`
                w-full lg:w-[calc(100%-80px)] lg:ms-20 transition-all duration-300
                ${isChatPage ? "h-screen overflow-hidden" : "min-h-screen"}
            `}>
                {/* 🔵 Note: lg:ms-20 ensures margin-start (right in RTL) */}
                <Outlet context={{ setSidebarOpen, sidebarOpen, feedType }} />
            </main>

        </div>
    );
};

// --- Sub-Components (Clean JSX) ---

/**
 * Header for the main feed page (Home).
 * Handles tab switching (For You / Following) and scroll states.
 */
const FeedHeader = React.memo(({
    isScrolled, handleLogoClick, feedType, setFeedType,
    navigate, handleBellClick, handleMenuClick, unreadCount, t // 🟢 Receive t
}) => {
    return (
        <header
            className={`
                fixed top-0 start-0 w-full lg:start-20 lg:w-[calc(100%-80px)] z-40 
                h-[60px] px-3 sm:px-4 transition-all duration-300 ease-in-out 
                flex items-center justify-between
                ${isScrolled
                    ? "bg-surface/90 backdrop-blur-xl border-b border-adaptive shadow-sm"
                    : "bg-transparent border-b border-transparent"
                }
            `}
        >
            <div className="h-14 md:h-20 flex items-center">
                <Logo onClick={handleLogoClick} />
            </div>

            {/* Tabs */}
            <div className="absolute left-1/2 top-0 h-full -translate-x-1/2 flex items-center justify-center gap-3 sm:gap-6 z-10 w-max">
                {["for-you", "following"].map((type) => (
                    <button
                        key={type}
                        onClick={() => setFeedType(type)}
                        className={`
                            relative h-full flex items-center px-2 text-sm sm:text-[16px] font-bold transition-colors 
                            ${feedType === type ? "text-content" : "text-muted hover:text-content/70"}
                        `}
                    >
                        {type === "for-you" ? t("feed.forYou") : t("feed.following")}
                        {feedType === type && (
                            <motion.div
                                layoutId="headerTab"
                                className="absolute bottom-0 start-0 end-0 h-[3px] bg-primary rounded-t-full"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0 z-20">
                <button
                    onClick={() => navigate('/search')}
                    aria-label={t("layout.aria.search")} // 🟢 Translated Aria
                    className="hidden sm:block p-2 rounded-full hover:bg-main text-content transition-colors active:scale-95"
                >
                    <Search size={22} />
                </button>

                <NotificationIcon unreadCount={unreadCount} onClick={handleBellClick} t={t} /> {/* 🟢 Pass t */}

                <button
                    onClick={handleMenuClick}
                    aria-label={t("layout.aria.menu")} // 🟢 Translated Aria
                    className="lg:hidden p-2 rounded-full hover:bg-main text-content transition-colors active:scale-95"
                >
                    <Menu size={24} className="sm:w-[26px] sm:h-[26px]" />
                </button>
            </div>
        </header>
    );
});

/**
 * Header for secondary pages (Profile, Settings, etc.).
 * Simpler version without tabs.
 */
const SecondaryHeader = React.memo(({
    handleLogoClick, handleBellClick, handleMenuClick, unreadCount, t // 🟢 Receive t
}) => {
    return (
        <header className="lg:hidden sticky top-0 w-full h-[60px] z-40 px-4 flex items-center justify-between bg-surface/90 backdrop-blur-xl border-b border-adaptive transition-all">
            <div className="flex items-center">
                <Logo onClick={handleLogoClick} />
            </div>
            <div className="flex items-center gap-2">
                <NotificationIcon unreadCount={unreadCount} onClick={handleBellClick} t={t} /> {/* 🟢 Pass t */}

                <button
                    onClick={handleMenuClick}
                    aria-label={t("layout.aria.menu")} // 🟢 Translated Aria
                    className="p-2 rounded-full hover:bg-main text-content transition-colors active:scale-95"
                >
                    <Menu size={24} className="sm:w-[26px] sm:h-[26px]" />
                </button>
            </div>
        </header>
    );
});

/**
 * Reusable Notification Bell with Badge.
 */
const NotificationIcon = ({ unreadCount, onClick, t }) => ( // 🟢 Receive t
    <button
        onClick={onClick}
        aria-label={t("layout.aria.notifications")} // 🟢 Translated Aria
        className="relative p-2 rounded-full hover:bg-main transition-colors group active:scale-90"
    >
        <Bell
            size={22}
            className={`
                sm:w-6 sm:h-6 transition-all duration-300 
                ${unreadCount > 0 ? "text-content fill-current" : "text-content group-hover:text-primary"}
            `}
        />
        {unreadCount > 0 && (
            <span className="absolute top-1.5 end-1.5 flex h-3.5 w-3.5 sm:h-4 sm:w-4 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-full w-full bg-red-600 text-[9px] sm:text-[10px] font-bold text-white items-center justify-center border-2 border-surface shadow-sm">
                    {unreadCount > 9 ? "9+" : unreadCount}
                </span>
            </span>
        )}
    </button>
);

export default Layout;