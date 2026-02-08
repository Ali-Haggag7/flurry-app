import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { ArrowLeft, Search, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢

// --- Local Imports ---
import api from "../lib/axios";
import UserAvatar from "../components/common/UserDefaultAvatar";

/**
 * NetworkPage Component
 *
 * Displays a list of users (Followers or Following) based on the URL path.
 * Includes search functionality, skeleton loading states, and optimized rendering.
 */
const NetworkPage = () => {
    const { userId } = useParams();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation(); // 🟢

    // Determine view type based on URL
    const type = useMemo(
        () => (location.pathname.includes("followers") ? "followers" : "following"),
        [location.pathname]
    );

    // --- State ---
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // --- Effects ---

    useEffect(() => {
        let isMounted = true;

        const fetchNetwork = async () => {
            try {
                setLoading(true);
                const token = await getToken();
                const { data } = await api.get(`/user/${userId}/${type}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (isMounted && data.success) {
                    setUsers(data.users);
                }
            } catch (error) {
                console.error("Fetch Network Error:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (userId) fetchNetwork();

        return () => {
            isMounted = false;
        };
    }, [userId, type, getToken]);

    // --- Memoized Logic ---

    // Optimized filtering
    const filteredUsers = useMemo(() => {
        if (!searchQuery) return users;
        const lowerQuery = searchQuery.toLowerCase();
        return users.filter(
            (u) =>
                u.full_name?.toLowerCase().includes(lowerQuery) ||
                u.username?.toLowerCase().includes(lowerQuery)
        );
    }, [users, searchQuery]);

    // --- Handlers ---

    const handleBack = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    const handleUserClick = useCallback(
        (id) => {
            navigate(`/profile/${id}`);
        },
        [navigate]
    );

    // --- Render ---

    return (
        <div className="min-h-screen bg-main text-content pt-6 px-4 pb-20 transition-colors duration-300">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <header className="flex items-center gap-4 mb-8">
                    <button
                        onClick={handleBack}
                        aria-label="Back"
                        className="p-2 hover:bg-surface rounded-full transition text-muted hover:text-content border border-transparent hover:border-adaptive rtl:scale-x-[-1]" // 🔵 RTL flip
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold capitalize text-content">{t(`network.${type}`)}</h1> {/* 🟢 */}
                        <p className="text-muted text-sm font-medium">
                            {loading ? t("network.loading") : t("network.peopleCount", { count: users.length })} {/* 🟢 */}
                        </p>
                    </div>
                </header>

                {/* Search Bar */}
                <div className="relative mb-6 group">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted w-5 h-5 group-focus-within:text-primary transition-colors" /> {/* 🔵 start-3 */}
                    <input
                        type="text"
                        placeholder={t("network.searchPlaceholder", { type: t(`network.${type}`) })} // 🟢
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-surface border border-adaptive rounded-xl py-3 ps-10 pe-4 text-content placeholder-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition shadow-sm" // 🔵 ps-10 pe-4
                    />
                </div>

                {/* Content Area */}
                {loading ? (
                    <NetworkSkeletonList />
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence initial={false}>
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user, index) => (
                                    <NetworkUserCard
                                        key={user._id}
                                        user={user}
                                        index={index}
                                        onClick={handleUserClick}
                                    />
                                ))
                            ) : (
                                <EmptyState type={t(`network.${type}`)} /> // 🟢
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sub-Components ---

/**
 * NetworkUserCard (Memoized)
 * Renders a single user row.
 */
const NetworkUserCard = React.memo(({ user, index, onClick }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        onClick={() => onClick(user._id)}
        className="flex items-center justify-between p-4 bg-surface border border-adaptive rounded-2xl cursor-pointer hover:bg-surface/80 hover:border-primary/30 transition-all duration-300 group shadow-sm hover:shadow-md"
    >
        <div className="flex items-center gap-4">
            <UserAvatar
                user={user}
                className="w-12 h-12 rounded-full border border-adaptive group-hover:border-primary transition-colors"
            />
            <div>
                <h3 className="font-bold text-content group-hover:text-primary transition-colors">
                    {user.full_name}
                </h3>
                <p className="text-sm text-muted">@{user.username}</p>
            </div>
        </div>
    </motion.div>
));

/**
 * NetworkSkeletonList (Memoized)
 * Renders the loading skeleton state.
 */
const NetworkSkeletonList = React.memo(() => (
    <div className="space-y-4">
        {[...Array(6)].map((_, n) => (
            <div
                key={n}
                className="flex items-center p-4 bg-surface border border-adaptive rounded-2xl animate-pulse shadow-sm"
            >
                <div className="w-12 h-12 bg-main rounded-full shrink-0"></div>
                <div className="flex-1 ms-4 space-y-2"> {/* 🔵 ms-4 */}
                    <div className="h-4 bg-main rounded w-1/3"></div>
                    <div className="h-3 bg-main rounded w-1/4"></div>
                </div>
            </div>
        ))}
    </div>
));

/**
 * EmptyState (Memoized)
 * Renders when no users match the criteria.
 */
const EmptyState = React.memo(({ type }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-20 text-muted flex flex-col items-center"
    >
        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4 border border-adaptive">
            <Users className="w-8 h-8 opacity-50" />
        </div>
        <p>No {type} found.</p>
    </motion.div>
));

export default NetworkPage;