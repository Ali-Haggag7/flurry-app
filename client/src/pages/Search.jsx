/**
 * @component Search
 * @description A debounced user search interface with optimistic UI updates and animations.
 * Allows users to discover other profiles via username or full name.
 *
 * @features
 * - Debounced API calls (100ms) to reduce server load
 * - AbortController implementation to handle race conditions
 * - Memoized result cards for rendering performance
 * - Strict Theme System adherence (bg-main, bg-surface, border-adaptive)
 */

import React, { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢
import {
    Search as SearchIcon,
    ArrowRight,
    TrendingUp,
    X,
    Loader2
} from "lucide-react";

// --- Local Imports ---
import api from "../lib/axios";

// --- Sub-Components ---

/**
 * @component UserSearchResultCard
 * @description Memoized card component to prevent list re-renders during typing.
 */
const UserSearchResultCard = memo(({ user, index, onClick }) => (
    <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ delay: index * 0.05, duration: 0.2 }}
        onClick={() => onClick(user._id)}
        className="group flex items-center gap-4 p-3 bg-surface hover:bg-main border border-adaptive hover:border-primary/40 rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-primary/5"
        role="button"
        tabIndex={0}
    >
        <img
            src={user.profile_picture || "/avatar-placeholder.png"}
            alt={user.username}
            className="w-12 h-12 rounded-full object-cover border border-adaptive group-hover:border-primary transition-colors bg-main"
            loading="lazy"
        />
        <div className="flex-1 min-w-0">
            <h4 className="font-bold text-content text-sm md:text-base truncate group-hover:text-primary transition-colors">
                {user.full_name}
            </h4>
            <p className="text-xs text-muted truncate">@{user.username}</p>
            {user.bio && (
                <p className="text-[11px] text-muted truncate mt-0.5 max-w-[80%] opacity-80">
                    {user.bio}
                </p>
            )}
        </div>
        <div className="p-2 text-muted group-hover:text-primary group-hover:translate-x-1 transition-all rtl:scale-x-[-1]"> {/* 🔵 RTL Flip Arrow */}
            <ArrowRight size={18} />
        </div>
    </motion.div>
));

UserSearchResultCard.displayName = "UserSearchResultCard";

/**
 * @component SearchSkeleton
 * @description Loading placeholder.
 */
const SearchSkeleton = memo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-surface p-4 rounded-xl border border-adaptive flex items-center gap-4 animate-pulse shadow-sm">
                <div className="w-12 h-12 bg-main/50 rounded-full"></div>
                <div className="flex-1 space-y-2">
                    <div className="h-3 bg-main/50 rounded w-1/2"></div>
                    <div className="h-2 bg-main/50 rounded w-1/3"></div>
                </div>
            </div>
        ))}
    </div>
));

SearchSkeleton.displayName = "SearchSkeleton";

// --- Main Component ---

const Search = () => {
    // --- State & Hooks ---
    const [input, setInput] = useState("");
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const { getToken } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation(); // 🟢

    // --- Handlers ---

    /**
     * Executes the search API call.
     * Wrapped in useCallback to be stable for the effect dependency.
     */
    const handleSearch = useCallback(async (searchQuery, signal) => {
        if (!searchQuery.trim()) return;

        try {
            setLoading(true);
            const token = await getToken();
            const { data } = await api.get(`/user/search?query=${searchQuery}`, {
                headers: { Authorization: `Bearer ${token}` },
                signal // Pass abort signal to cancel stale requests
            });

            if (data.success) {
                setUsers(data.users);
            }
        } catch (error) {
            if (error.name !== "CanceledError") {
                console.error("Search Error:", error);
            }
        } finally {
            // Only set loading false if the component is still mounted/request wasn't aborted
            if (!signal.aborted) {
                setLoading(false);
            }
        }
    }, [getToken]);

    const clearSearch = useCallback(() => {
        setInput("");
        setUsers([]);
    }, []);

    const handleUserClick = useCallback((userId) => {
        navigate(`/profile/${userId}`);
    }, [navigate]);

    // --- Effects ---

    // Debounce Logic with Cleanup
    useEffect(() => {
        const controller = new AbortController();
        const delayDebounceFn = setTimeout(() => {
            if (input.trim()) {
                handleSearch(input, controller.signal);
            } else {
                setUsers([]);
                setLoading(false);
            }
        }, 100);

        // Cleanup: Clear timeout and abort previous fetch if user keeps typing
        return () => {
            clearTimeout(delayDebounceFn);
            controller.abort();
        };
    }, [input, handleSearch]);

    // --- Render ---

    return (
        <div className="min-h-screen bg-main text-content pt-8 px-4 pb-20 transition-colors duration-300">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 text-start" // 🔵 text-start
                >
                    <h1 className="text-3xl md:text-4xl font-extrabold text-content mb-2">
                        {t("search.discover")} <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-primary/60">
                            {t("search.amazingPeople")} {/* 🟢 */}
                        </span>
                    </h1>
                    <p className="text-muted text-sm md:text-base">
                        {t("search.subtitle")} {/* 🟢 */}
                    </p>
                </motion.div>

                {/* Search Bar */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-xl mb-10 z-20"
                >
                    <div className="relative group">
                        {/* Glow Effect */}
                        <div className="absolute -inset-0.5 bg-linear-to-r from-primary/50 to-primary/10 rounded-2xl blur opacity-20 group-hover:opacity-60 transition duration-500" />

                        {/* Input Container */}
                        <div className="relative flex items-center bg-surface rounded-2xl p-1.5 border border-adaptive shadow-lg transition-all duration-300 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                            <SearchIcon className="ms-3 text-muted w-5 h-5 group-focus-within:text-primary transition-colors" /> {/* 🔵 ms-3 */}

                            <input
                                type="text"
                                placeholder={t("search.placeholder")} // 🟢
                                className="w-full bg-transparent text-content px-3 py-2.5 text-base focus:outline-none border-none outline-none ring-0 placeholder-muted/70"
                                onChange={(e) => setInput(e.target.value)}
                                value={input}
                                autoFocus
                            />

                            {/* Actions (Clear/Loading) */}
                            <div className="flex items-center gap-1 me-1"> {/* 🔵 me-1 */}
                                {loading && <Loader2 size={16} className="animate-spin text-primary mx-2" />}
                                {input && !loading && (
                                    <button
                                        onClick={clearSearch}
                                        className="p-1.5 text-muted hover:text-primary hover:bg-main rounded-full transition"
                                        aria-label="Clear search"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Results Area */}
                {loading ? (
                    <SearchSkeleton />
                ) : (
                    <div className="max-w-3xl mx-auto">

                        {/* Empty State */}
                        {!input && users.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-10 opacity-60"
                            >
                                <TrendingUp className="w-12 h-12 text-primary/50 mx-auto mb-3" />
                                <p className="text-muted text-sm">{t("search.startTyping")}</p> {/* 🟢 */}
                            </motion.div>
                        )}

                        {/* No Results */}
                        {input && users.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-10"
                            >
                                <p className="text-xl text-muted font-medium">{t("search.noResults", { query: input })}</p> {/* 🟢 Dynamic */}
                            </motion.div>
                        )}

                        {/* Results List */}
                        <motion.div layout className="grid grid-cols-1 gap-3">
                            <AnimatePresence mode="popLayout">
                                {users.map((user, index) => (
                                    <UserSearchResultCard
                                        key={user._id}
                                        user={user}
                                        index={index}
                                        onClick={handleUserClick}
                                    />
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Search;