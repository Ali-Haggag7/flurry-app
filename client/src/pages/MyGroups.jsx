/**
 * @component MyGroups
 * @description Renders a dashboard of groups the user manages or has joined.
 * Features filtering (All/Managed/Joined), creation modal, and status indicators.
 */

import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢
import {
    Plus,
    MessageCircle,
    Settings,
    Crown,
    Users,
    Layers,
    ArrowRight,
    Clock,
    Loader2
} from "lucide-react";

// --- Local & 3rd Party Imports ---
import api from "../lib/axios";
import Loading from "../components/common/Loading";

// Lazy Load Modal
const CreateGroupModal = lazy(() => import("../components/modals/CreateGroupModal"));

// --- Sub-Components ---

/**
 * @component FilterTabs
 * @description Renders the filter navigation tabs.
 */
const FilterTabs = React.memo(({ filter, setFilter, t }) => { // 🟢 Receive t
    const tabs = useMemo(() => [
        { id: 'all', label: t("myGroups.tabs.all") }, // 🟢
        { id: 'managed', label: t("myGroups.tabs.managed") }, // 🟢
        { id: 'joined', label: t("myGroups.tabs.joined") } // 🟢
    ], [t]);

    return (
        <div className="flex bg-surface p-1.5 rounded-2xl w-full md:w-fit mb-10 border border-adaptive shadow-sm overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`
                        flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize whitespace-nowrap relative
                        ${filter === tab.id
                            ? "text-primary bg-primary/10 shadow-sm"
                            : "text-muted hover:text-content hover:bg-main"
                        }
                    `}
                >
                    {tab.label}
                    {filter === tab.id && (
                        <motion.div
                            layoutId="activeGroupTab"
                            className="absolute bottom-0 start-0 end-0 h-0.5 bg-primary rounded-full mx-4 mb-1"
                        />
                    )}
                </button>
            ))}
        </div>
    );
});
FilterTabs.displayName = "FilterTabs";

/**
 * @component GroupCard
 * @description Renders an individual group card with status logic.
 */
const GroupCard = React.memo(({ group, userId, currentUser, navigate, t }) => { // 🟢 Receive t
    // Logic to determine membership status
    const isOwner = group.owner?.clerkId === userId;
    const activeMembersCount = group.members?.filter(m => m.status === 'accepted').length || 0;
    const pendingCount = group.members?.filter(m => m.status === 'pending').length || 0;

    // Strict user identification logic
    const myMemberRecord = useMemo(() => {
        return group.members?.find(m => {
            if (!m.user) return false;
            return (m.user.clerkId === userId) ||
                (m.user._id === currentUser?._id) ||
                (m.user === currentUser?._id);
        });
    }, [group.members, userId, currentUser]);

    const isPending = myMemberRecord?.status === 'pending';

    const handleCardClick = () => {
        if (isPending) return;
        navigate(`/groups/${group._id}/chat`);
    };

    const handleSettingsClick = (e) => {
        e.stopPropagation();
        navigate(`/groups/${group._id}/requests`);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={handleCardClick}
            className={`
                bg-surface p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden shadow-sm flex flex-col group
                ${isPending
                    ? "border-yellow-500/40 bg-yellow-500/5 cursor-default opacity-90"
                    : "border-adaptive hover:border-primary/40 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                }
            `}
        >
            {/* Status Badges */}
            {isOwner && (
                <div className="absolute top-0 end-0 bg-linear-to-bl from-amber-500/20 to-transparent px-4 py-2 rounded-bl-3xl border-b border-s border-amber-500/10 rtl:rounded-bl-none rtl:rounded-br-3xl rtl:border-s-0 rtl:border-e"> {/* 🔵 RTL Logic */}
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 uppercase tracking-wider">
                        <Crown size={12} fill="currentColor" /> {t("myGroups.owner")} {/* 🟢 */}
                    </span>
                </div>
            )}

            {isPending && (
                <div className="absolute top-0 end-0 bg-linear-to-bl from-yellow-500/20 to-transparent px-4 py-2 rounded-bl-3xl border-b border-s border-yellow-500/10 rtl:rounded-bl-none rtl:rounded-br-3xl rtl:border-s-0 rtl:border-e"> {/* 🔵 RTL Logic */}
                    <span className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 flex items-center gap-1 uppercase tracking-wider">
                        <Clock size={12} /> {t("myGroups.pending")} {/* 🟢 */}
                    </span>
                </div>
            )}

            {/* Header Info */}
            <div className="flex items-center gap-5 mb-6">
                <img
                    src={group.group_image}
                    alt={group.name}
                    loading="lazy"
                    className={`
                        w-16 h-16 rounded-2xl object-cover ring-2 transition-all shadow-md bg-main
                        ${isPending ? "ring-yellow-500/20 grayscale-[0.5]" : "ring-adaptive group-hover:ring-primary/50"}
                    `}
                />
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-xl leading-tight mb-1 truncate transition-colors ${isPending ? "text-content/70" : "text-content group-hover:text-primary"}`}>
                        {group.name}
                    </h3>
                    <p className="text-xs text-muted flex items-center gap-1.5 font-medium bg-main/50 w-fit px-2 py-1 rounded-sg">
                        <Users size={14} />
                        <span className="text-content font-bold">{activeMembersCount}</span> {t("myGroups.members")} {/* 🟢 */}
                    </p>
                </div>
            </div>

            {/* Actions Footer */}
            <div className="flex gap-3 mt-auto pt-4 border-t border-adaptive">
                <button
                    disabled={isPending}
                    className={`
                        flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95
                        ${isPending
                            ? "bg-main text-yellow-600 border border-yellow-500/20 opacity-100 cursor-not-allowed shadow-none"
                            : "bg-linear-to-r from-primary to-primary/80 hover:opacity-90 text-white shadow-primary/20"
                        }
                    `}
                >
                    {isPending ? (
                        <>
                            <Clock size={18} />
                            <span className="whitespace-nowrap">{t("myGroups.waitingApproval")}</span> {/* 🟢 */}
                        </>
                    ) : (
                        <>
                            <MessageCircle size={18} className="text-white" />
                            <span className="whitespace-nowrap">{t("myGroups.openChat")}</span> {/* 🟢 */}
                        </>
                    )}
                </button>

                {isOwner && (
                    <button
                        onClick={handleSettingsClick}
                        className="w-14 flex items-center justify-center bg-main hover:bg-surface text-muted hover:text-primary rounded-xl transition-all border border-adaptive hover:border-primary/30 relative shadow-sm group/settings"
                        title={t("myGroups.settings")} // 🟢
                    >
                        <Settings size={22} className="group-hover/settings:rotate-90 transition-transform duration-500" />
                        {pendingCount > 0 && (
                            <span className="absolute -top-1 -end-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-surface"></span>
                            </span>
                        )}
                    </button>
                )}
            </div>
        </motion.div>
    );
});
GroupCard.displayName = "GroupCard";

// --- Main Component ---

const MyGroups = () => {
    // --- State & Hooks ---
    const [allGroups, setAllGroups] = useState([]);
    const [filteredGroups, setFilteredGroups] = useState([]);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const { userId, getToken } = useAuth();
    const navigate = useNavigate();
    const { currentUser } = useSelector((state) => state.user);
    const { t } = useTranslation(); // 🟢

    // --- Effects ---

    useEffect(() => {
        const fetchUserGroups = async () => {
            try {
                const token = await getToken();
                const res = await api.get("/group/my-groups", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const myGroups = res.data.groups || [];
                setAllGroups(myGroups);
                setFilteredGroups(myGroups);
            } catch (err) {
                console.error("Error fetching groups:", err);
            } finally {
                setLoading(false);
            }
        };

        if (userId) fetchUserGroups();
    }, [userId, getToken]);

    useEffect(() => {
        if (!userId) return;

        // Memoized filtering logic inside effect
        let result = [];
        if (filter === "all") {
            result = allGroups;
        } else if (filter === "managed") {
            result = allGroups.filter(g => g.owner?.clerkId === userId);
        } else if (filter === "joined") {
            result = allGroups.filter(g => g.owner?.clerkId !== userId);
        }
        setFilteredGroups(result);

    }, [filter, allGroups, userId]);

    // --- Handlers ---

    const handleGroupCreated = useCallback((newGroup) => {
        setAllGroups(prev => [newGroup, ...prev]);
    }, []);

    const toggleModal = useCallback(() => {
        setShowCreateModal(prev => !prev);
    }, []);

    // --- Render ---

    if (loading) return <Loading />;

    return (
        <div className="flex-1 min-h-screen bg-main text-content p-4 pt-8 md:p-8 transition-colors duration-300">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-adaptive pb-8">
                    <div className="text-start"> {/* 🔵 text-start */}
                        <h2 className="text-3xl md:text-4xl font-extrabold text-content mb-2 tracking-tight">
                            {t("myGroups.title")} {/* 🟢 */}
                        </h2>
                        <p className="text-muted text-sm md:text-base font-medium max-w-lg">
                            {t("myGroups.subtitle")} {/* 🟢 */}
                        </p>
                    </div>
                    <button
                        onClick={toggleModal}
                        className="px-7 py-3.5 bg-linear-to-r from-primary to-primary/80 hover:opacity-90 text-white rounded-2xl flex items-center gap-2.5 font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                    >
                        <Plus size={22} strokeWidth={2.5} /> {t("myGroups.createBtn")} {/* 🟢 */}
                    </button>
                </div>

                {/* Filters */}
                <FilterTabs filter={filter} setFilter={setFilter} t={t} /> {/* 🟢 Pass t */}

                {/* Grid Display */}
                {filteredGroups.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-24 bg-surface rounded-3xl border border-dashed border-adaptive shadow-sm"
                    >
                        <div className="w-24 h-24 bg-main rounded-full flex items-center justify-center mb-6 border border-adaptive">
                            <Layers size={48} className="text-muted opacity-50" />
                        </div>
                        <p className="text-content text-xl font-bold mb-2">{t("myGroups.noGroups")}</p> {/* 🟢 */}
                        {filter === 'joined' && (
                            <Link
                                to="/groups/available"
                                className="text-primary hover:text-primary/80 font-bold flex items-center gap-2 hover:underline mt-2 transition-colors"
                            >
                                {t("myGroups.exploreLink")} <ArrowRight size={18} className="rtl:rotate-180" /> {/* 🟢 */}
                            </Link>
                        )}
                    </motion.div>
                ) : (
                    <motion.div layout className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <AnimatePresence mode="popLayout">
                            {filteredGroups.map(group => (
                                <GroupCard
                                    key={group._id}
                                    group={group}
                                    userId={userId}
                                    currentUser={currentUser}
                                    navigate={navigate}
                                    t={t} // 🟢 Pass t
                                />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* Lazy Loaded Modal */}
                <Suspense fallback={null}>
                    <CreateGroupModal
                        isOpen={showCreateModal}
                        onClose={() => setShowCreateModal(false)}
                        onGroupCreated={handleGroupCreated}
                    />
                </Suspense>
            </div>
        </div>
    );
};

export default MyGroups;