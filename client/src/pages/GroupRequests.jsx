/**
 * @component GroupRequests
 * @description Manages and displays pending join requests for a specific group.
 * Handles fetching, displaying, and responding (accept/reject) to user requests.
 *
 * @features
 * - Optimistic UI updates
 * - Memoized child components to prevent unnecessary re-renders
 * - Framer Motion animations for layout shifts
 * - Strict Theme System adherence (bg-main, bg-surface, border-adaptive)
 */

import React, { useState, useEffect, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
    Check,
    X,
    ArrowLeft,
    ShieldAlert,
    UserCheck,
    Loader2
} from "lucide-react";

// --- Local & 3rd Party Imports ---
import api from "../lib/axios";
import Loading from "../components/common/Loading";

// --- Sub-Components ---

/**
 * @component RequestCard
 * @description Memoized individual request card to prevent list re-renders.
 */
const RequestCard = memo(({ request, onResponse }) => {
    const { user } = request;
    const [isProcessing, setIsProcessing] = useState(false);

    // Local handler to manage button loading state independently
    const handleAction = async (action) => {
        setIsProcessing(true);
        await onResponse(user._id, action);
        setIsProcessing(false);
    };

    if (!user) return null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
            className="bg-surface p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 border border-adaptive hover:border-primary/30 hover:shadow-lg transition-all group shadow-sm"
        >
            {/* User Info */}
            <div className="flex items-center gap-5 w-full sm:w-auto">
                <div className="relative">
                    <img
                        src={user.profile_picture || "/default-avatar.png"}
                        alt={user.full_name}
                        className="w-16 h-16 rounded-2xl object-cover ring-2 ring-transparent group-hover:ring-primary/50 transition-all shadow-md bg-main"
                        loading="lazy"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                        NEW
                    </div>
                </div>

                <div>
                    <h3 className="text-content font-bold text-lg mb-0.5">
                        {user.full_name}
                    </h3>
                    <p className="text-sm text-primary font-medium">@{user.username}</p>
                    <p className="text-xs text-muted mt-1">Wants to join the group</p>
                </div>
            </div>

            {/* Actions Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                    onClick={() => handleAction("reject")}
                    disabled={isProcessing}
                    className="px-4 py-2.5 rounded-xl bg-main text-muted hover:bg-red-500/10 hover:text-red-500 border border-adaptive hover:border-red-500/30 transition-all flex items-center gap-2 font-medium shadow-sm disabled:opacity-50"
                >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                    <span className="hidden sm:inline">Decline</span>
                </button>

                <button
                    onClick={() => handleAction("accept")}
                    disabled={isProcessing}
                    className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2 font-bold disabled:opacity-50"
                >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    <span>Accept</span>
                </button>
            </div>
        </motion.div>
    );
});

RequestCard.displayName = "RequestCard";

/**
 * @component EmptyState
 * @description Displayed when request list is empty.
 */
const EmptyState = memo(() => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 bg-surface rounded-3xl border border-dashed border-adaptive shadow-sm"
    >
        <div className="w-20 h-20 bg-main rounded-full flex items-center justify-center mb-6 ring-4 ring-adaptive">
            <UserCheck size={40} className="text-green-500 opacity-50" />
        </div>
        <h3 className="text-xl font-bold text-content mb-2">All Caught Up!</h3>
        <p className="text-muted text-sm">No pending requests at the moment.</p>
    </motion.div>
));

EmptyState.displayName = "EmptyState";

// --- Main Component ---

const GroupRequests = () => {
    // --- State & Hooks ---
    const { groupId } = useParams();
    const { getToken } = useAuth();
    const navigate = useNavigate();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- Effects ---

    useEffect(() => {
        // AbortController to cleanup pending fetches on unmount
        const controller = new AbortController();

        const fetchRequests = async () => {
            try {
                const token = await getToken();
                const res = await api.get(`/group/requests/${groupId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                });
                setRequests(res.data.requests || []);
            } catch (err) {
                if (err.name !== 'CanceledError') {
                    console.error("Error fetching requests:", err);
                    toast.error("Failed to load requests");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        if (groupId) fetchRequests();

        return () => controller.abort();
    }, [groupId, getToken]);

    // --- Handlers ---

    const handleResponse = useCallback(async (memberId, action) => {
        try {
            const token = await getToken();

            await api.put(`/group/request/respond`, { groupId, memberId, action }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success(action === "accept" ? "New member welcomed! 🎉" : "Request declined.");

            // Optimistic update
            setRequests((prev) => prev.filter((req) => req.user?._id !== memberId));

        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Something went wrong");
        }
    }, [groupId, getToken]);

    // --- Render ---

    if (loading) return <Loading />;

    return (
        <div className="flex-1 min-h-screen bg-main text-content p-6 transition-colors duration-300">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-4 mb-10 border-b border-adaptive pb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-surface hover:bg-main text-muted hover:text-content rounded-xl transition-all shadow-sm group border border-adaptive"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h2 className="text-3xl font-bold text-content flex items-center gap-3">
                            Join Requests <ShieldAlert className="text-yellow-500" size={28} />
                        </h2>
                        <p className="text-muted text-sm mt-1">Review and manage pending join requests.</p>
                    </div>
                </div>

                {/* List Area */}
                <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {requests.length === 0 ? (
                            <EmptyState key="empty-state" />
                        ) : (
                            requests.map((request) => (
                                <RequestCard
                                    key={request._id}
                                    request={request}
                                    onResponse={handleResponse}
                                />
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default GroupRequests;