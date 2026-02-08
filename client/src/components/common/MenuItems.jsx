/**
 * MenuItems Component
 * ------------------------------------------------------------------
 * Navigation links for the sidebar/drawer.
 * Data is memoized to prevent recreation on re-renders while allowing localization.
 */

import { memo, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { Home, Search, MessageCircle, User, Settings, Users, Layers, Compass } from 'lucide-react';
import { useTranslation } from "react-i18next"; // 🟢 Import translation hook

const MenuItems = ({ setSidebarOpen }) => {
    const { t } = useTranslation(); // 🟢 Hook initialization

    // 🟢 Configuration moved inside useMemo to allow translation
    const navItems = useMemo(() => [
        { icon: Home, path: "/", label: t("sidebar.home"), color: "text-blue-500" },
        { icon: Search, path: "/search", label: t("sidebar.search"), color: "text-pink-500" },
        { icon: MessageCircle, path: "/messages", label: t("sidebar.messages"), color: "text-yellow-500" },
        { icon: User, path: "/profile", label: t("sidebar.profile"), color: "text-cyan-500" },
        { icon: Users, path: "/connections", label: t("sidebar.connections"), color: "text-green-500" },
        { icon: Layers, path: "/groups", label: t("sidebar.myGroups"), color: "text-indigo-500" },
        { icon: Compass, path: "/groups/available", label: t("sidebar.explore"), color: "text-orange-500" },
        { icon: Settings, path: "/settings", label: t("sidebar.settings"), color: "text-gray-400" },
    ], [t]);

    return (
        <div className="px-4 py-2 space-y-2 font-medium">
            {navItems.map(({ path, label, icon: Icon, color }) => (
                <NavLink
                    key={path}
                    to={path}
                    end={path === "/"}
                    onClick={() => setSidebarOpen && setSidebarOpen(false)} // Optional chaining for safety
                    className={({ isActive }) =>
                        `relative group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300
                        ${isActive
                            ? "bg-primary text-white shadow-lg shadow-primary/30 translate-x-2 rtl:-translate-x-2" // 🔵 Added rtl flip for animation
                            : "text-muted hover:bg-main hover:text-content"
                        }`
                    }
                >
                    {({ isActive }) => (
                        <>
                            <Icon
                                className={`w-5 h-5 transition-colors duration-300 ${isActive ? "text-white" : `group-hover:${color.replace('text-', 'text-')}`}`} // Simplified color logic
                            />
                            <span className="text-sm tracking-wide">{label}</span>

                            {isActive && (
                                <span className="absolute end-3 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse" /> // 🔵 end-3 works automatically for RTL
                            )}
                        </>
                    )}
                </NavLink>
            ))}
        </div>
    );
};

export default memo(MenuItems);