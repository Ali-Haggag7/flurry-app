import React, { useMemo, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useClerk, UserButton } from '@clerk/clerk-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Home, Search, MessageCircle, User, Settings,
    CirclePlus, LogOut, Users, Layers, Compass, X
} from 'lucide-react';
import { useTranslation } from "react-i18next";

// --- Local Imports ---
import Logo from '../components/common/Logo';
import Footer from '../components/common/Footer';

/**
 * @component Sidebar
 * @description Main navigation sidebar. Handles responsive states (mobile drawer vs desktop rail),
 * navigation links, user actions, and badge notifications.
 * * @param {boolean} sidebarOpen - State to toggle mobile sidebar.
 * @param {function} setSidebarOpen - Setter for sidebarOpen.
 * @param {number} networkCount - Notification count for connections.
 */
const Sidebar = React.memo(({ sidebarOpen, setSidebarOpen, networkCount }) => {
    const location = useLocation();
    const { signOut } = useClerk();
    const { t } = useTranslation();

    // --- Data ---

    // Memoized navigation config to prevent recreation on every render
    const NAV_ITEMS = useMemo(() => [
        { icon: Home, path: "/", label: t("sidebar.home") },
        { icon: Search, path: "/search", label: t("sidebar.search") },
        { icon: MessageCircle, path: "/messages", label: t("sidebar.messages") },
        { icon: User, path: "/profile", label: t("sidebar.profile") },
        { icon: Users, path: "/connections", label: t("sidebar.connections") },
        { icon: Layers, path: "/groups", label: t("sidebar.groups") },
        { icon: Compass, path: "/groups/available", label: t("sidebar.explore") },
        { icon: Settings, path: "/settings", label: t("sidebar.settings") },
    ], [t]);

    // --- Handlers ---

    const handleClose = useCallback(() => {
        setSidebarOpen(false);
    }, [setSidebarOpen]);

    // --- Render Helpers ---

    const renderOverlay = () => (
        <AnimatePresence>
            {sidebarOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={handleClose}
                />
            )}
        </AnimatePresence>
    );

    return (
        <>
            {renderOverlay()}

            {/* Sidebar Container */}
            <aside
                className={`
                    fixed top-0 start-0 h-full w-72 lg:w-20 flex flex-col py-4 gap-4 
                    bg-surface border-e border-adaptive shadow-2xl z-50
                    transition-transform duration-300 ease-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 rtl:translate-x-full lg:rtl:translate-x-0'}
                `}
            >
                {/* 1. Mobile Header */}
                <div className="lg:hidden flex items-center justify-between px-4 mb-4 mt-2">
                    <div className="flex items-center">
                        <div className="scale-100">
                            <Logo />
                        </div>
                        <span
                            className="text-2xl font-black tracking-tight bg-clip-text text-transparent leading-none ms-1"
                            style={{
                                backgroundImage: 'linear-gradient(to right, var(--color-primary), var(--color-content))'
                            }}
                        >
                            FLURRY
                        </span>
                    </div>

                    <button
                        onClick={handleClose}
                        className="p-2 rounded-full hover:bg-main text-muted transition-colors"
                        aria-label={t("sidebar.close")}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* 2. Navigation Items */}
                <div className="flex-1 w-full flex flex-col gap-2 px-3 overflow-y-auto custom-scrollbar pt-2">
                    {NAV_ITEMS.map((item) => (
                        <NavItem
                            key={item.path}
                            item={item}
                            isActive={location.pathname === item.path}
                            networkCount={networkCount}
                            onClick={handleClose}
                        />
                    ))}
                </div>

                {/* 3. Mobile Footer Wrapper */}
                <div className="p-4 mt-auto border-t border-adaptive lg:hidden">
                    <Footer />
                </div>

                {/* 4. Bottom Actions (Create, Profile, Logout) */}
                <div className="flex lg:flex-col flex-row justify-evenly lg:justify-center items-center gap-4 lg:gap-5 w-full pt-4 pb-4 border-t border-adaptive bg-surface mt-auto lg:mt-0 px-2 lg:px-0">

                    {/* Create Post */}
                    <Link
                        to="/create-post"
                        onClick={handleClose}
                        className="relative group"
                        title={t("sidebar.createPost")}
                    >
                        <motion.div
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center justify-center w-12 h-12 lg:w-10 lg:h-10 rounded-full bg-primary text-white shadow-lg shadow-primary/30"
                        >
                            <CirclePlus size={24} className="lg:w-5.5 lg:h-5.5" />
                        </motion.div>
                    </Link>

                    {/* User Avatar */}
                    <div className="w-12 h-12 lg:w-10 lg:h-10 rounded-full p-0.5 border-2 border-transparent hover:border-primary transition-colors flex items-center justify-center overflow-hidden">
                        <UserButton
                            appearance={{
                                elements: {
                                    userButtonAvatarBox: "w-full h-full rounded-full",
                                    userButtonTrigger: "focus:shadow-none focus:outline-none"
                                }
                            }}
                            afterSignOutUrl="/sign-in"
                        />
                    </div>

                    {/* Logout */}
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => signOut()}
                        className="text-muted hover:text-red-500 p-3 lg:p-2 rounded-xl hover:bg-red-500/10 transition-colors"
                        title={t("sidebar.logout")}
                    >
                        <LogOut size={24} className="lg:w-5 lg:h-5" />
                    </motion.button>
                </div>
            </aside>
        </>
    );
});

// --- Sub-Components ---

/**
 * Individual Navigation Item
 * Memoized to prevent re-renders of the entire list when unrelated state changes.
 */
const NavItem = React.memo(({ item, isActive, networkCount, onClick }) => {
    const Icon = item.icon;
    const showBadge = (item.label === "Connections" || item.label === "الشبكة") && networkCount > 0;

    return (
        <Link
            to={item.path}
            onClick={onClick}
            title={item.label}
            className={`
                relative group p-3 rounded-xl transition-all duration-300
                flex items-center gap-4 lg:justify-center lg:gap-0 lg:w-12 lg:h-12 mx-auto w-full
                ${isActive
                    ? "bg-primary text-white shadow-lg shadow-primary/30 lg:scale-110"
                    : "text-muted hover:text-primary hover:bg-primary/10"
                }
            `}
        >
            <div className="relative">
                <Icon size={24} className="transition-transform duration-300 group-hover:scale-110" />

                {/* Red Notification Dot */}
                {showBadge && (
                    <span className="absolute -top-1 -end-1 w-3 h-3 bg-red-500 rounded-full border-2 border-surface animate-pulse" />
                )}
            </div>

            <span className="font-medium lg:hidden flex-1">
                {item.label}
            </span>

            {/* Mobile Badge Number */}
            {showBadge && (
                <span className="lg:hidden bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold ms-auto">
                    {networkCount}
                </span>
            )}

            {/* Desktop Active Indicator */}
            {!isActive && (
                <span className="hidden lg:block absolute start-0 w-1 h-0 rounded-e-full bg-primary transition-all duration-300 group-hover:h-2/3 opacity-0 group-hover:opacity-100" />
            )}
        </Link>
    );
});

export default Sidebar;