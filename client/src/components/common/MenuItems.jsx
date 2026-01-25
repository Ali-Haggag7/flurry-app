/**
 * MenuItems Component
 * ------------------------------------------------------------------
 * Navigation links for the sidebar/drawer.
 * Data is static to prevent recreation on re-renders.
 */

import { memo } from "react";
import { NavLink } from "react-router-dom";
import { Home, Search, MessageCircle, User, Settings, Users, Layers, Compass } from 'lucide-react';

// Static Configuration
const NAV_ITEMS = [
    { icon: Home, path: "/", label: "Home", color: "text-blue-500" },
    { icon: Search, path: "/search", label: "Search", color: "text-pink-500" },
    { icon: MessageCircle, path: "/messages", label: "Messages", color: "text-yellow-500" },
    { icon: User, path: "/profile", label: "Profile", color: "text-cyan-500" },
    { icon: Users, path: "/connections", label: "Connections", color: "text-green-500" },
    { icon: Layers, path: "/groups", label: "My Groups", color: "text-indigo-500" },
    { icon: Compass, path: "/groups/discovery", label: "Explore", color: "text-orange-500" },
    { icon: Settings, path: "/settings", label: "Settings", color: "text-gray-400" },
];

const MenuItems = ({ setSidebarOpen }) => {
    return (
        <div className="px-4 py-2 space-y-2 font-medium">
            {NAV_ITEMS.map(({ path, label, icon: Icon, color }) => (
                <NavLink
                    key={path}
                    to={path}
                    end={path === "/"}
                    onClick={() => setSidebarOpen && setSidebarOpen(false)} // Optional chaining for safety
                    className={({ isActive }) =>
                        `relative group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300
                        ${isActive
                            ? "bg-primary text-white shadow-lg shadow-primary/30 translate-x-2"
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
                                <span className="absolute right-3 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse" />
                            )}
                        </>
                    )}
                </NavLink>
            ))}
        </div>
    );
};

export default memo(MenuItems);