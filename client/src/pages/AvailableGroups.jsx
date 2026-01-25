/**
 * AvailableGroups Page
 * ------------------------------------------------------------------
 * Displays a searchable list of communities (groups) that users can join.
 * Features:
 * - Real-time search/filtering.
 * - Join requests with visual feedback (Pending/Success).
 * - Responsive grid layout with polished UI cards.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import { UserPlus, Users, Search, Compass, Loader2, ArrowRight, Clock, Check } from "lucide-react";

// API
import api from "../lib/axios";

// Components
import Loading from "../components/common/Loading";

const AvailableGroups = () => {
    const [groups, setGroups] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [joiningId, setJoiningId] = useState(null);
    const [sentRequests, setSentRequests] = useState([]); // Track requests sent in this session

    const { getToken, userId } = useAuth();

    // --- Fetch Groups ---
    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const token = await getToken();
                const res = await api.get("/group/discovery", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setGroups(res.data);
            } catch (err) {
                console.error("Error fetching discovery groups:", err);
                toast.error("Failed to load groups");
            } finally {
                setLoading(false);
            }
        };

        if (userId) fetchGroups();
    }, [userId, getToken]);

    // --- Handlers ---
    const handleJoinGroup = async (groupId) => {
        try {
            setJoiningId(groupId);
            const token = await getToken();

            await api.post(`/group/join/${groupId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Success Feedback
            toast.success("Request sent! Waiting for approval ⏳");
            setSentRequests((prev) => [...prev, groupId]); // Mark as requested

        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to join");
        } finally {
            setJoiningId(null);
        }
    };

    // --- Filter ---
    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Loading State
    if (loading) return <Loading />;

    return (
        <div className="flex-1 min-h-screen bg-main text-content p-4 pt-8 md:p-8 transition-colors duration-300">
            <div className="max-w-6xl mx-auto">

                {/* --- Header Section --- */}
                <div className="mb-10 text-left md:text-left">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-content mb-3 tracking-tight">
                        Discover Communities
                    </h2>
                    <p className="text-muted text-base md:text-lg font-medium max-w-2xl mx-auto md:mx-0">
                        Find your tribe, connect with like-minded people, and start new conversations.
                    </p>
                </div>

                {/* --- Search Bar --- */}
                <div className="relative max-w-2xl mb-12 mx-auto md:mx-0 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="text-muted group-focus-within:text-primary transition-colors" size={20} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search for groups..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-surface border border-adaptive rounded-2xl text-content placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all shadow-sm"
                    />
                </div>

                {/* --- Content Grid --- */}
                {filteredGroups.length === 0 ? (
                    // Empty State
                    <div className="flex flex-col items-center justify-center py-24 bg-surface rounded-3xl border border-dashed border-adaptive shadow-sm text-center">
                        <div className="w-24 h-24 bg-main rounded-full flex items-center justify-center mb-6 border border-adaptive">
                            <Compass size={48} className="text-muted opacity-50" />
                        </div>
                        <p className="text-content text-xl font-bold mb-2">No communities found matching "{searchQuery}"</p>
                        <p className="text-muted">Try searching for something else or check back later.</p>
                    </div>
                ) : (
                    // Groups Grid
                    <motion.div layout className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <AnimatePresence>
                            {filteredGroups.map(group => {
                                const isRequested = sentRequests.includes(group._id);

                                return (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        key={group._id}
                                        className="bg-surface p-6 rounded-3xl border border-adaptive hover:border-primary/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group relative overflow-hidden shadow-sm"
                                    >
                                        {/* Card Header */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <img
                                                src={group.group_image || "/group-placeholder.png"}
                                                alt={group.name}
                                                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-adaptive group-hover:ring-primary/50 transition-all shadow-md bg-main"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-content font-bold text-xl leading-tight truncate mb-1 group-hover:text-primary transition-colors">
                                                    {group.name}
                                                </h3>
                                                <div className="flex items-center gap-1.5 text-xs text-muted font-medium bg-main/50 w-fit px-2 py-1 rounded-lg border border-adaptive">
                                                    <Users size={12} />
                                                    <span className="text-content font-bold">{group.members?.length || 0}</span> Members
                                                </div>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div className="flex-1 mb-6">
                                            <p className="text-muted text-sm line-clamp-3 leading-relaxed">
                                                {group.description || "No description available for this group."}
                                            </p>
                                        </div>

                                        {/* Action Button */}
                                        <button
                                            onClick={() => handleJoinGroup(group._id)}
                                            disabled={joiningId === group._id || isRequested}
                                            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 group/btn
                                                ${isRequested
                                                    ? "bg-main text-muted border border-adaptive cursor-default opacity-80" // 'Requested' Style
                                                    : "bg-linear-to-r from-primary to-primary/80 hover:opacity-90 text-white shadow-primary/20" // 'Join' Style
                                                }
                                                disabled:opacity-70 disabled:cursor-not-allowed`}
                                        >
                                            {joiningId === group._id ? (
                                                <Loader2 size={20} className="animate-spin" />
                                            ) : isRequested ? (
                                                <>
                                                    <Clock size={18} className="text-yellow-500" />
                                                    Request Sent
                                                </>
                                            ) : (
                                                <>
                                                    <UserPlus size={18} className="group-hover/btn:scale-110 transition-transform" />
                                                    Join Community
                                                </>
                                            )}
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default AvailableGroups;