import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
    Grid,
    Image,
    Edit3,
    Settings,
    Maximize2,
    UserPlus,
    MessageCircle,
    ShieldAlert,
    Camera,
    BadgeCheck,
    X,
    Ban,
    Lock,
    Clock,
    UserCheck,
    ChevronDown,
    UserX,
    Bookmark,
    Loader2,
} from "lucide-react";

// --- Local Imports ---
import api from "../lib/axios";
import { fetchMyConnections } from "../features/connectionsSlice";
import PostCard from "../components/feed/PostCard";
import UserAvatar from "../components/common/UserDefaultAvatar.jsx";

// --- Lazy Load Modals ---
const UpdateProfileModal = lazy(() => import("../components/modals/UpdateProfileModal.jsx"));

// --- Utils ---
const isSameId = (id1, id2) => {
    if (!id1 || !id2) return false;
    return id1.toString() === id2.toString();
};

/**
 * Profile Component
 *
 * A production-grade profile page displaying user details, stats, and content tabs.
 * Features optimistic UI updates, rigorous memoization, and theme-compliant styling.
 *
 * @component
 */
const Profile = () => {
    const { profileId } = useParams();
    const { getToken } = useAuth();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();

    // --- Redux State ---
    const { currentUser } = useSelector((state) => state.user);

    // --- Derived State ---
    const targetProfileId = useMemo(
        () => profileId || (currentUser ? currentUser._id : null),
        [profileId, currentUser]
    );

    const isMyProfile = useMemo(
        () => currentUser && targetProfileId && isSameId(targetProfileId, currentUser._id),
        [currentUser, targetProfileId]
    );

    const TABS = useMemo(() => [
        { id: "posts", label: t("profile.tabs.posts"), icon: Grid },
        { id: "media", label: t("profile.tabs.media"), icon: Image },
        { id: "saved", label: t("profile.tabs.saved"), icon: Bookmark, private: true },
    ], [t]);

    // --- Local State ---
    const [profileUser, setProfileUser] = useState(null);
    const [posts, setPosts] = useState(null);
    const [activeTab, setActiveTab] = useState("posts");
    const [showEdit, setShowEdit] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [showConnectionMenu, setShowConnectionMenu] = useState(false);

    const [savedPosts, setSavedPosts] = useState([]);
    const [savedLoading, setSavedLoading] = useState(false);
    const [isSavedFetched, setIsSavedFetched] = useState(false);

    const [connectionStatus, setConnectionStatus] = useState("none");
    const [followStatus, setFollowStatus] = useState("none");

    // --- Effects ---

    // 1. Fetch Profile Data
    useEffect(() => {
        let isMounted = true;

        const fetchProfileData = async () => {
            try {
                const token = await getToken();
                if (!targetProfileId) return;

                // Reset States on ID change
                if (profileUser && !isSameId(profileUser._id, targetProfileId)) {
                    setProfileUser(null);
                    setPosts(null);
                    setSavedPosts([]);
                    setIsSavedFetched(false);
                    setConnectionStatus("none");
                    setFollowStatus("none");
                    setActiveTab("posts");
                }

                if (isMyProfile && currentUser) {
                    setProfileUser((prev) => prev || currentUser);
                    setLoading(false);
                } else {
                    setLoading(true);
                }

                const { data } = await api.get(`/post/user/${targetProfileId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (isMounted && data.success) {
                    setProfileUser(data.user);
                    setPosts(data.posts || []);
                    setConnectionStatus(data.connectionStatus);
                    setFollowStatus(data.followStatus);
                }
            } catch (error) {
                console.error("Fetch Error:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (targetProfileId) fetchProfileData();

        return () => {
            isMounted = false;
        };
    }, [targetProfileId, getToken]); // eslint-disable-line react-hooks/exhaustive-deps

    // 2. Fetch Saved Posts (Lazy)
    useEffect(() => {
        if (activeTab === "saved" && isMyProfile && !isSavedFetched) {
            const fetchSaved = async () => {
                setSavedLoading(true);
                try {
                    const token = await getToken();
                    const { data } = await api.get("/post/saved", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (data.success) {
                        setSavedPosts(data.posts || []);
                        setIsSavedFetched(true);
                    }
                } catch (error) {
                    toast.error(t("profile.toasts.savedError"));
                } finally {
                    setSavedLoading(false);
                }
            };
            fetchSaved();
        }
    }, [activeTab, isMyProfile, isSavedFetched, getToken, t]);

    // 3. Sync Local State with Redux
    useEffect(() => {
        if (isMyProfile && currentUser) {
            setProfileUser((prev) => {
                if (!prev) return currentUser;
                return {
                    ...prev,
                    full_name: currentUser.full_name,
                    username: currentUser.username,
                    bio: currentUser.bio,
                    location: currentUser.location,
                    profile_picture: currentUser.profile_picture,
                    cover_photo: currentUser.cover_photo,
                };
            });
        }
    }, [currentUser, isMyProfile]);

    // --- Handlers (Memoized) ---

    // Stable handler for editing profile to prevent re-renders of ProfileActions
    const handleEditProfile = useCallback(() => setShowEdit(true), []);

    // Stable handler for messaging
    const handleMessage = useCallback(() => {
        if (profileUser?._id) navigate(`/messages/${profileUser._id}`);
    }, [navigate, profileUser]);

    // Stable handler for image selection
    const handleImageSelect = useCallback((url) => setSelectedImage(url), []);

    // Stable handler for closing image modal
    const handleCloseImage = useCallback(() => setSelectedImage(null), []);

    const handleFollowToggle = useCallback(async () => {
        if (actionLoading || !profileUser) return;

        const oldStatus = followStatus;
        const isPrivate = profileUser.isPrivate;

        // Optimistic UI Update
        if (followStatus === "following" || followStatus === "requested") {
            setFollowStatus("none");
            setProfileUser((prev) => ({
                ...prev,
                followers: prev.followers.filter((id) => id !== currentUser._id),
            }));
        } else {
            setFollowStatus(isPrivate ? "requested" : "following");
            if (!isPrivate) {
                setProfileUser((prev) => ({
                    ...prev,
                    followers: [...prev.followers, currentUser._id],
                }));
            }
        }

        try {
            setActionLoading(true);
            const token = await getToken();
            const route =
                oldStatus === "following" || oldStatus === "requested" ? "unfollow" : "follow";
            const { data } = await api.post(
                `/user/${route}/${profileUser._id}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (data.status) setFollowStatus(data.status);
        } catch (error) {
            setFollowStatus(oldStatus); // Revert on error
            toast.error(t("profile.toasts.actionFailed"));
        } finally {
            setActionLoading(false);
        }
    }, [actionLoading, profileUser, followStatus, currentUser._id, getToken, t]);

    const handleConnect = useCallback(async () => {
        setConnectionStatus("sent");
        try {
            const token = await getToken();
            await api.post(
                "/connection/send",
                { receiverId: profileUser._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(t("profile.toasts.requestSent"));
            dispatch(fetchMyConnections(token));
        } catch (error) {
            setConnectionStatus("none");
            toast.error(error.response?.data?.message || t("profile.toasts.failed"));
        }
    }, [profileUser, getToken, dispatch, t]);

    const handleAcceptRequest = useCallback(async () => {
        try {
            const token = await getToken();
            await api.post(
                `/connection/accept/${profileUser._id}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(t("profile.toasts.connected"));
            setConnectionStatus("connected");
            dispatch(fetchMyConnections(token));
        } catch (error) {
            toast.error(t("profile.toasts.acceptFailed"));
        }
    }, [profileUser, getToken, dispatch, t]);

    const handleRemoveConnection = useCallback(async () => {
        if (!window.confirm(t("profile.toasts.removeConfirm"))) return;

        const previousStatus = connectionStatus;
        setConnectionStatus("none");

        try {
            const token = await getToken();
            await api.put(
                `/connection/remove/${profileUser._id}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(t("profile.toasts.connectionRemoved"));
            dispatch(fetchMyConnections(token));
        } catch (error) {
            setConnectionStatus(previousStatus);
            toast.error(t("profile.toasts.failed"));
        }
    }, [profileUser, connectionStatus, getToken, dispatch, t]);

    const handleBlockToggle = useCallback(async () => {
        const isBlockedByMe =
            profileUser?.isBlockedByMe ||
            currentUser?.blockedUsers?.some((id) => isSameId(id, profileUser?._id));

        const actionText = isBlockedByMe ? t("profile.actions.unblock") : t("profile.actions.block");
        if (!confirm(t("profile.toasts.blockConfirm", { action: actionText })))
            return;

        try {
            const token = await getToken();
            const endpoint = `/connection/${isBlockedByMe ? "unblock" : "block"}/${profileUser._id}`;
            const { data } = await api.post(
                endpoint,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (data.success) {
                toast.success(data.message);
                window.location.reload();
            }
        } catch (error) {
            toast.error(t("profile.toasts.failed"));
        }
    }, [profileUser, currentUser, getToken, t]);

    // --- Derived View State ---
    const isBlockedByMe = useMemo(
        () =>
            profileUser?.isBlockedByMe ||
            currentUser?.blockedUsers?.some((id) => isSameId(id, profileUser?._id)),
        [profileUser, currentUser]
    );

    const isBlockedByTarget = profileUser?.isBlockedByTarget;
    const isRestricted = isBlockedByMe || isBlockedByTarget;
    const isPrivateAccount = profileUser?.isPrivate;
    const isContentLocked = !isMyProfile && isPrivateAccount && followStatus !== "following";

    // --- Render ---

    if (loading)
        return (
            <div className="min-h-screen bg-main flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        );

    if (!profileUser)
        return (
            <div className="min-h-screen bg-main flex items-center justify-center text-muted">
                {t("profile.userUnavailable")}
            </div>
        );

    return (
        <div className="min-h-screen bg-main text-content pb-20 transition-colors duration-300">
            {/* 1. Hero Section */}
            <div className="relative">
                <ProfileHero
                    profileUser={profileUser}
                    isRestricted={isRestricted}
                    isMyProfile={isMyProfile}
                    onEditClick={handleEditProfile}
                />

                <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-20">
                    <div className="relative -mt-24 md:-mt-32 bg-linear-to-b from-surface/80 via-surface/95 to-main backdrop-blur-2xl border border-adaptive rounded-3xl p-6 md:p-8 shadow-2xl">
                        <div className="flex flex-col md:flex-row gap-6 relative z-10">

                            {/* Avatar */}
                            <ProfileAvatar
                                profileUser={profileUser}
                                isRestricted={isRestricted}
                                isMyProfile={isMyProfile}
                                onEditClick={handleEditProfile}
                            />

                            {/* Info & Actions */}
                            <div className="flex-1 flex flex-col md:justify-end pt-2">
                                <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-5">

                                    {/* Text Info */}
                                    <ProfileInfo
                                        profileUser={profileUser}
                                        isBlockedByMe={isBlockedByMe}
                                        isBlockedByTarget={isBlockedByTarget}
                                        t={t}
                                    />

                                    {/* Action Buttons */}
                                    <ProfileActions
                                        isMyProfile={isMyProfile}
                                        isBlockedByMe={isBlockedByMe}
                                        isBlockedByTarget={isBlockedByTarget}
                                        profileUser={profileUser}
                                        followStatus={followStatus}
                                        connectionStatus={connectionStatus}
                                        showConnectionMenu={showConnectionMenu}
                                        setShowConnectionMenu={setShowConnectionMenu}
                                        onEdit={handleEditProfile}
                                        onBlock={handleBlockToggle}
                                        onFollow={handleFollowToggle}
                                        onConnect={handleConnect}
                                        onAccept={handleAcceptRequest}
                                        onRemoveConnection={handleRemoveConnection}
                                        onMessage={handleMessage}
                                        t={t}
                                    />
                                </div>

                                {/* Stats & Bio */}
                                {!isRestricted && (
                                    <>
                                        <p className="mt-6 text-content/80 text-sm md:text-base leading-relaxed text-center md:text-start font-medium max-w-3xl mx-auto md:mx-0">
                                            {profileUser.bio || t("profile.noBio")}
                                        </p>
                                        <ProfileStats
                                            postsCount={posts?.length || 0}
                                            profileUser={profileUser}
                                            isContentLocked={isContentLocked}
                                            loading={posts === null || loading || actionLoading}
                                            t={t}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Content Tabs */}
            {!isRestricted && (
                isContentLocked ? (
                    <PrivateAccountState t={t} />
                ) : (
                    <div className="max-w-5xl mx-auto mt-8 px-4">
                        <TabNavigation
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            isMyProfile={isMyProfile}
                            TABS={TABS}
                        />

                        <AnimatePresence mode="wait">
                            {activeTab === "posts" && (
                                <PostsGrid key="posts" posts={posts || []} t={t} />
                            )}

                            {activeTab === "media" && (
                                <MediaGrid
                                    key="media"
                                    posts={posts || []}
                                    onImageClick={handleImageSelect}
                                    t={t}
                                />
                            )}

                            {activeTab === "saved" && isMyProfile && (
                                <SavedGrid
                                    key="saved"
                                    posts={savedPosts}
                                    loading={savedLoading}
                                    t={t}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                )
            )}

            {/* 3. Modals */}
            <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}>
                {showEdit && <UpdateProfileModal setShowEdit={setShowEdit} />}
            </Suspense>

            <ImageModal
                selectedImage={selectedImage}
                onClose={handleCloseImage}
            />
        </div>
    );
};

// --- Sub-Components (Strictly Memoized) ---

const ProfileHero = memo(({ profileUser, isRestricted, isMyProfile, onEditClick }) => (
    <div className="h-64 md:h-80 w-full relative overflow-hidden group bg-surface">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 z-10"></div>
        {!isRestricted && profileUser.cover_photo ? (
            <motion.img
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.5 }}
                src={profileUser.cover_photo}
                className="w-full h-full object-cover"
                alt="cover"
            />
        ) : (
            <div className={`w-full h-full ${isRestricted ? "bg-black/90" : "bg-gradient-to-br from-primary/80 to-black"}`}></div>
        )}
        {isMyProfile && (
            <button
                onClick={onEditClick}
                className="absolute top-4 end-4 z-20 p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110 cursor-pointer"
            >
                <Camera size={20} />
            </button>
        )}
    </div>
));

const ProfileAvatar = memo(({ profileUser, isRestricted, isMyProfile, onEditClick }) => (
    <div className="flex -mt-16 md:-mt-20 items-center justify-center md:justify-start shrink-0">
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`relative group mt-16 md:mt-0 ${isRestricted ? "pointer-events-none cursor-default md:mt-16" : "cursor-pointer"
                }`}
        >
            <UserAvatar
                user={profileUser}
                className={`w-32 h-32 md:w-44 md:h-44 rounded-full object-cover shadow-2xl border-4 border-surface ${isRestricted ? "grayscale opacity-50" : ""
                    }`}
            />
            {isMyProfile && !isRestricted && (
                <button
                    onClick={onEditClick}
                    className="absolute bottom-2 end-2 p-2.5 bg-primary text-white rounded-full shadow-lg ring-4 ring-surface z-20 pointer-events-auto cursor-pointer hover:scale-110 transition-transform"
                >
                    <Edit3 size={18} />
                </button>
            )}
        </motion.div>
    </div>
));

const ProfileInfo = memo(({ profileUser, isBlockedByMe, isBlockedByTarget, t }) => (
    <div className="text-center md:text-start space-y-1">
        <h1 className="text-3xl md:text-4xl font-black text-content flex items-center justify-center md:justify-start gap-2">
            {profileUser.full_name}
            {profileUser.isVerified && (
                <BadgeCheck className="w-6 h-6 md:w-8 md:h-8 text-primary fill-primary/10" />
            )}
        </h1>
        <p className="text-muted font-medium text-base md:text-lg">@{profileUser.username}</p>

        {isBlockedByMe && (
            <p className="text-red-500 font-bold text-sm mt-1 flex items-center gap-1 justify-center md:justify-start bg-red-500/10 px-3 py-1 rounded-full w-fit mx-auto md:mx-0 border border-red-500/20">
                <Ban size={14} /> {t("profile.states.blockedByMe")}
            </p>
        )}
        {isBlockedByTarget && (
            <p className="text-muted font-bold text-sm mt-1 flex items-center gap-1 justify-center md:justify-start bg-surface px-3 py-1 rounded-full w-fit mx-auto md:mx-0 border border-adaptive">
                <Lock size={14} /> {t("profile.states.userUnavailable")}
            </p>
        )}
    </div>
));

const ProfileActions = memo(({
    isMyProfile,
    isBlockedByMe,
    isBlockedByTarget,
    profileUser,
    followStatus,
    connectionStatus,
    showConnectionMenu,
    setShowConnectionMenu,
    onEdit,
    onBlock,
    onFollow,
    onConnect,
    onAccept,
    onRemoveConnection,
    onMessage,
    t
}) => (
    <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end flex-wrap mt-4">
        {isBlockedByMe ? (
            <button
                onClick={onBlock}
                className="px-6 py-2.5 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition shadow-lg flex items-center gap-2"
            >
                <ShieldAlert size={18} /> {t("profile.actions.unblock")}
            </button>
        ) : isBlockedByTarget ? (
            null
        ) : isMyProfile ? (
            <button
                onClick={onEdit}
                className="px-6 py-2.5 bg-main hover:bg-surface text-content rounded-2xl font-bold transition border border-adaptive flex items-center gap-2 shadow-sm"
            >
                <Settings size={18} /> <span className="hidden sm:inline">{t("profile.actions.editProfile")}</span>
            </button>
        ) : (
            <>
                {/* Follow Button */}
                <button
                    onClick={onFollow}
                    className={`px-8 py-2.5 rounded-2xl font-bold transition shadow-lg active:scale-95 ${followStatus === "following"
                        ? "bg-main border border-adaptive text-content hover:border-red-500/30 hover:text-red-500"
                        : followStatus === "requested"
                            ? "bg-surface text-muted border border-adaptive"
                            : "bg-primary text-white hover:opacity-90"
                        }`}
                >
                    {followStatus === "following"
                        ? t("profile.actions.unfollow")
                        : followStatus === "requested"
                            ? t("profile.actions.requested")
                            : t("profile.actions.follow")}
                </button>

                {/* Connection & Message Buttons */}
                {(!profileUser.isPrivate || followStatus === "following" || connectionStatus !== "none") && (
                    <>
                        {connectionStatus === "connected" ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={onMessage}
                                    className="p-3 bg-main border border-adaptive text-primary rounded-2xl hover:bg-primary/5 transition"
                                >
                                    <MessageCircle size={20} />
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowConnectionMenu(!showConnectionMenu)}
                                        className="px-4 py-3 bg-green-500/10 text-green-600 border border-green-500/20 rounded-2xl font-bold hover:bg-green-500/20 transition flex items-center gap-2"
                                    >
                                        <UserCheck size={20} /> <span className="hidden sm:inline">{t("profile.actions.connected")}</span>
                                        <ChevronDown size={16} />
                                    </button>
                                    <AnimatePresence>
                                        {showConnectionMenu && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setShowConnectionMenu(false)}></div>
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="absolute end-0 top-14 bg-surface border border-adaptive rounded-xl shadow-xl z-20 w-48 overflow-hidden"
                                                >
                                                    <button
                                                        onClick={() => {
                                                            onRemoveConnection();
                                                            setShowConnectionMenu(false);
                                                        }}
                                                        className="w-full text-start px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2 transition"
                                                    >
                                                        <UserX size={18} /> {t("profile.actions.removeConnection")}
                                                    </button>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        ) : connectionStatus === "sent" ? (
                            <button disabled className="px-6 py-2.5 bg-surface text-muted border border-adaptive rounded-2xl font-bold cursor-default flex items-center gap-2">
                                <Clock size={20} /> {t("profile.actions.requestSent")}
                            </button>
                        ) : connectionStatus === "received" ? (
                            <button
                                onClick={onAccept}
                                className="px-6 py-2.5 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition shadow-md flex items-center gap-2"
                            >
                                <UserCheck size={20} /> {t("profile.actions.acceptRequest")}
                            </button>
                        ) : (
                            <button
                                onClick={onConnect}
                                className="p-3 bg-main text-content border border-adaptive hover:text-primary rounded-2xl transition"
                            >
                                <UserPlus size={20} />
                            </button>
                        )}
                    </>
                )}
                <button
                    onClick={onBlock}
                    className="p-3 bg-main border-adaptive text-muted hover:text-red-500 hover:bg-red-500/5 rounded-2xl border transition"
                >
                    <ShieldAlert size={20} />
                </button>
            </>
        )}
    </div>
));

const ProfileStats = memo(({ postsCount, profileUser, isContentLocked, loading, t }) => {
    // Note: navigate hook used inside component to prevent breaking memo if parent passes it down
    const navigate = useNavigate();

    // Stable handlers to prevent re-renders on every click
    const handleFollowersClick = useCallback(() => {
        if (!isContentLocked && !loading) navigate(`/profile/${profileUser._id}/followers`);
    }, [isContentLocked, loading, navigate, profileUser]);

    const handleFollowingClick = useCallback(() => {
        if (!isContentLocked && !loading) navigate(`/profile/${profileUser._id}/following`);
    }, [isContentLocked, loading, navigate, profileUser]);

    const StatSkeleton = () => (
        <div className="h-8 w-12 bg-adaptive/50 rounded-md animate-pulse mx-auto mb-1"></div>
    );

    return (
        <div className="grid grid-cols-3 md:flex md:justify-start md:gap-12 w-full mt-8 pt-6 border-t border-adaptive/50">

            {/* Posts Count */}
            <div className="text-center group">
                {loading ? (
                    <StatSkeleton />
                ) : (
                    <span className="block text-xl sm:text-2xl font-black text-content">
                        {isContentLocked ? "-" : postsCount}
                    </span>
                )}
                <span className="text-[10px] sm:text-xs text-muted font-bold uppercase tracking-wider">
                    {t("profile.stats.posts")}
                </span>
            </div>

            {/* Followers */}
            <div
                onClick={handleFollowersClick}
                className={`text-center group ${isContentLocked || loading ? "cursor-default" : "cursor-pointer"}`}
            >
                {loading ? (
                    <StatSkeleton />
                ) : (
                    <span className={`block text-xl sm:text-2xl font-black text-content ${isContentLocked ? "" : "group-hover:text-primary"} transition-colors`}>
                        {isContentLocked ? "-" : profileUser.followers?.length || 0}
                    </span>
                )}
                <span className="text-[10px] sm:text-xs text-muted font-bold uppercase tracking-wider">
                    {t("profile.stats.followers")}
                </span>
            </div>

            {/* Following */}
            <div
                onClick={handleFollowingClick}
                className={`text-center group ${isContentLocked || loading ? "cursor-default" : "cursor-pointer"}`}
            >
                {loading ? (
                    <StatSkeleton />
                ) : (
                    <span className={`block text-xl sm:text-2xl font-black text-content ${isContentLocked ? "" : "group-hover:text-primary"} transition-colors`}>
                        {isContentLocked ? "-" : profileUser.following?.length || 0}
                    </span>
                )}
                <span className="text-[10px] sm:text-xs text-muted font-bold uppercase tracking-wider">
                    {t("profile.stats.following")}
                </span>
            </div>
        </div>
    );
});

const PrivateAccountState = memo(({ t }) => (
    <div className="max-w-5xl mx-auto mt-16 px-4 text-center pb-20">
        <div className="bg-surface/50 border border-adaptive rounded-3xl p-12 flex flex-col items-center justify-center shadow-sm max-w-lg mx-auto">
            <div className="w-24 h-24 bg-main rounded-full flex items-center justify-center mb-6 border-2 border-adaptive">
                <Lock size={40} className="text-content opacity-70" />
            </div>
            <h3 className="text-2xl font-bold text-content mb-3">{t("profile.private.title")}</h3>
            <p className="text-muted font-medium">{t("profile.private.desc")}</p>
        </div>
    </div>
));

const TabNavigation = memo(({ activeTab, setActiveTab, isMyProfile, TABS }) => (
    <div className="flex justify-center border-b border-adaptive mb-8 sticky top-0 bg-main/95 backdrop-blur-xl z-30 pt-2 transition-colors duration-300">
        {TABS.map((tab) => {
            if (tab.private && !isMyProfile) return null;
            return (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 md:px-10 pb-3 text-sm font-bold tracking-wide transition-all relative ${activeTab === tab.id ? "text-primary" : "text-muted hover:text-content"
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <tab.icon size={18} /> {tab.label}
                    </span>
                    {activeTab === tab.id && (
                        <motion.div
                            layoutId="activeTab"
                            className="absolute bottom-0 start-0 w-full h-0.5 bg-primary shadow-[0_0_10px_var(--color-primary)]"
                        />
                    )}
                </button>
            );
        })}
    </div>
));

const PostsGrid = memo(({ posts, t }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-6 flex flex-col items-center w-full"
    >
        {posts.length > 0 ? (
            posts.map((post) => <PostCard key={post._id} post={post} />)
        ) : (
            <EmptyState icon={Grid} message={t("profile.empty.posts")} />
        )}
    </motion.div>
));

const MediaGrid = memo(({ posts, onImageClick, t }) => {
    const images = useMemo(() =>
        posts.filter((p) => p.image_urls?.length > 0).flatMap((p) => p.image_urls),
        [posts]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-3 gap-0.5 md:gap-4 w-full"
        >
            {images.length > 0 ? (
                images.map((url, i) => (
                    <div
                        key={`${url}-${i}`}
                        onClick={() => onImageClick(url)}
                        className="aspect-square bg-surface overflow-hidden group cursor-pointer relative rounded-md border border-adaptive/30"
                    >
                        <img
                            src={url}
                            alt="media"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Maximize2 className="text-white transform scale-75 group-hover:scale-100 transition-transform" />
                        </div>
                    </div>
                ))
            ) : (
                <div className="col-span-3">
                    <EmptyState icon={Image} message={t("profile.empty.media")} />
                </div>
            )}
        </motion.div>
    );
});

const SavedGrid = memo(({ posts, loading, t }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-6 flex flex-col items-center w-full"
    >
        {loading ? (
            <div className="py-12 flex flex-col items-center text-muted">
                <Loader2 className="w-10 h-10 animate-spin mb-3 text-primary" />
                <p className="font-medium">{t("profile.loadingSaved")}</p>
            </div>
        ) : posts.length > 0 ? (
            posts.map((post) => <PostCard key={post._id} post={post} />)
        ) : (
            <EmptyState
                icon={Bookmark}
                message={t("profile.empty.savedTitle")}
                subtext={t("profile.empty.savedDesc")}
            />
        )}
    </motion.div>
));

const EmptyState = memo(({ icon: Icon, message, subtext }) => (
    <div className="py-20 text-center text-muted w-full">
        <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 border border-adaptive">
            <Icon size={40} className="text-muted" />
        </div>
        <p className="font-medium text-lg text-content">{message}</p>
        {subtext && <p className="text-sm mt-2 opacity-70 text-muted">{subtext}</p>}
    </div>
));

const ImageModal = memo(({ selectedImage, onClose }) => (
    <AnimatePresence>
        {selectedImage && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
                onClick={onClose}
            >
                <button
                    onClick={onClose}
                    className="absolute top-6 end-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition z-50 backdrop-blur-md"
                >
                    <X size={24} />
                </button>
                <motion.img
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.8 }}
                    src={selectedImage}
                    alt="Full Screen"
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />
            </motion.div>
        )}
    </AnimatePresence>
));

export default Profile;