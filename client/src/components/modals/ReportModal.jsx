/**
 * ReportModal Component
 * ------------------------------------------------------------------
 * Modal for reporting inappropriate content.
 * Features:
 * - List of predefined reasons.
 * - Fire-and-forget submission logic with optimistic UI feedback.
 */

import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import { X, ShieldAlert, Flag } from "lucide-react";

// API
import api from "../../lib/axios";

const REPORT_REASONS = [
    "Spam",
    "Harassment",
    "Hate Speech",
    "Violence",
    "Nudity",
    "Other"
];

const ReportModal = ({ postId, onClose }) => {
    const { getToken } = useAuth();

    const handleReport = async (reason) => {
        // Optimistic UI: Close and show success immediately
        onClose();
        toast.success("Thanks! Report submitted successfully.");

        try {
            const token = await getToken();
            await api.post(`/post/report/${postId}`, { reason }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error("Report submission failed:", error);
            // Silent fail is acceptable for reporting to avoid UX friction
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-surface border border-adaptive rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative z-10"
            >
                {/* Header */}
                <div className="p-4 border-b border-adaptive flex justify-between items-center bg-main/50 backdrop-blur-md">
                    <h3 className="font-bold text-content flex items-center gap-2">
                        <ShieldAlert className="text-red-500" size={20} />
                        Report Post
                    </h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-main rounded-full text-muted transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Reasons List */}
                <div className="p-2">
                    <p className="text-sm text-muted px-4 py-2 font-medium">Why are you reporting this post?</p>
                    <div className="flex flex-col gap-1">
                        {REPORT_REASONS.map((reason) => (
                            <button
                                key={reason}
                                onClick={() => handleReport(reason)}
                                className="w-full text-left px-4 py-3 hover:bg-main rounded-lg text-content font-medium transition flex items-center justify-between group"
                            >
                                {reason}
                                <Flag size={16} className="text-muted group-hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" />
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ReportModal;