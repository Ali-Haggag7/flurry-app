/**
 * ChatInfoSidebar Component
 * ------------------------------------------------------------------
 * A sliding sidebar that displays detailed information about a chat or group.
 * Refactored for performance, modularity, and strict theme adherence.
 *
 * Optimizations:
 * - Decomposed into memoized sub-components (Profile, Members, SharedContent, Actions).
 * - handlers wrapped in useCallback to prevent prop thrashing.
 * - Heavy filtering operations memoized with useMemo.
 * - Strict Tailwind theme variable usage.
 */

import React, { useState, useEffect, useMemo, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

// --- Icons ---
import {
    X, Bell, BellOff, Ban, Trash2, CheckCircle,
    Image as ImageIcon, FileText, Link2, Users, LogOut, ChevronDown, Link,
    Video, Copy, File, UserMinus, Lock, Unlock
} from "lucide-react";

// --- API & Actions ---
import api from "../../lib/axios";
import { toggleMuteLocal } from "../../features/userSlice";

// --- Components ---
import UserAvatar from "../common/UserDefaultAvatar";

// --- Helper Components ---

const EmptyState = memo(({ text, icon: Icon }) => (
    <div className="col-span-3 flex flex-col items-center justify-center py-10 opacity-50">
        <div className="bg-adaptive p-3 rounded-full mb-2">
            <Icon size={20} className="text-muted" />
        </div>
        <p className="text-xs text-muted font-medium">{text}</p>
    </div>
));

const MemberItem = memo(({ member, isOwner, amIAdmin, currentUserId, onKick, onClick, t }) => {
    const isMe = member._id === currentUserId;

    return (
        <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center justify-between p-2.5 hover:bg-main rounded-xl transition cursor-pointer group/item border border-transparent hover:border-adaptive"
            onClick={() => onClick(member._id)}
        >
            <div className="flex items-center gap-3 overflow-hidden">
                <UserAvatar user={member} className="w-10 h-10 shrink-0" />
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate text-content">{member.full_name}</p>
                        {isOwner && <span className="text-[9px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded-md font-bold border border-yellow-500/20">{t("chatInfo.ownerBadge")}</span>}
                        {isMe && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-bold">{t("chatInfo.youBadge")}</span>}
                    </div>
                    <p className="text-xs text-muted truncate">@{member.username}</p>
                </div>
            </div>

            {amIAdmin && !isOwner && !isMe && (
                <button
                    onClick={(e) => { e.stopPropagation(); onKick(member._id, member.full_name); }}
                    className="p-2 text-red-500/50 hover:text-red-600 bg-transparent hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover/item:opacity-100"
                    title={t("chatInfo.removeMember")}
                >
                    <UserMinus size={18} />
                </button>
            )}
        </motion.div>
    );
});

// --- Section Components ---

const ProfileSection = memo(({ isGroup, image, name, subtitle, bio, onCopyInfo }) => (
    <div className="flex flex-col items-center justify-center text-center space-y-4 relative">
        <div className="relative group">
            {isGroup ? (
                <img src={image} alt={name} className="w-28 h-28 md:w-32 md:h-32 rounded-3xl object-cover ring-4 ring-surface shadow-2xl" />
            ) : (
                <UserAvatar user={{ profile_picture: image, image }} className="w-28 h-28 md:w-32 md:h-32 shadow-2xl rounded-full ring-4 ring-surface" />
            )}
        </div>

        <div className="w-full">
            <div
                className="relative flex items-center justify-center gap-2 cursor-pointer group"
                onClick={onCopyInfo}
                title="Click to copy name"
            >
                <h3 className="text-2xl font-black text-content tracking-tight group-hover:text-primary transition-colors">{name}</h3>
                <Copy size={16} className="absolute end-0 text-muted opacity-0 group-hover:opacity-100 transition-all" />
            </div>

            <p className="text-muted text-sm font-medium flex items-center justify-center gap-1.5 mt-1">
                {isGroup ? <Users size={14} className="text-primary" /> : "@"}
                {subtitle}
            </p>
        </div>

        {bio && (
            <div className="bg-main/50 p-3 rounded-xl border border-adaptive w-full">
                <p className="text-sm text-content/80 italic leading-relaxed">"{bio}"</p>
            </div>
        )}
    </div>
));

const MembersSection = memo(({ isGroup, members, isMembersOpen, setIsMembersOpen, ownerId, currentUserId, onKick, onNavigate, t }) => {
    if (!isGroup || !members) return null;

    return (
        <div className="border-t border-adaptive pt-4">
            <button
                onClick={() => setIsMembersOpen(!isMembersOpen)}
                className="w-full flex items-center justify-between py-2 px-1 text-muted hover:text-primary transition group"
            >
                <h4 className="text-xs font-black uppercase tracking-[0.2em]">{t("chatInfo.groupMembers", { count: members.length })}</h4>
                <ChevronDown size={16} className={`transition-transform duration-300 ${isMembersOpen ? "rotate-180 text-primary" : ""}`} />
            </button>
            <AnimatePresence>
                {isMembersOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="max-h-64 overflow-y-auto pe-2 space-y-2 custom-scrollbar mt-2 p-1">
                            {members.map((memberWrap, index) => {
                                const member = memberWrap?.user;
                                if (!member) return null;
                                return (
                                    <MemberItem
                                        key={member._id || index}
                                        member={member}
                                        isOwner={ownerId === member._id}
                                        amIAdmin={ownerId === currentUserId}
                                        currentUserId={currentUserId}
                                        onKick={onKick}
                                        onClick={onNavigate}
                                        t={t}
                                    />
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

const SharedContentSection = memo(({ activeTab, setActiveTab, sharedMedia, sharedFiles, sharedLinks, t }) => (
    <div className="space-y-4 border-t border-adaptive pt-6">
        <div className="flex bg-main p-1 rounded-xl border border-adaptive">
            {[{ id: "media", icon: ImageIcon, label: t("chatInfo.media") }, { id: "files", icon: FileText, label: t("chatInfo.files") }, { id: "links", icon: Link2, label: t("chatInfo.links") }].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-extrabold rounded-lg transition-all duration-300 ${activeTab === tab.id ? "bg-surface text-primary shadow-sm scale-[1.02]" : "text-muted hover:text-content hover:bg-surface/50"}`}
                >
                    <tab.icon size={14} /> {tab.label}
                </button>
            ))}
        </div>

        <div className="min-h-[150px] max-h-[300px] overflow-y-auto scrollbar-hide">
            {activeTab === "media" && (
                <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {sharedMedia.length > 0 ? sharedMedia.map((msg, index) => (
                        <div key={index} className="aspect-square relative overflow-hidden rounded-xl border border-adaptive cursor-pointer group bg-main" onClick={() => window.open(msg.media_url, "_blank")}>
                            {msg.message_type === "video" ? (
                                <div className="w-full h-full flex items-center justify-center bg-black/10">
                                    <Video size={24} className="text-white/80" />
                                    <video src={msg.media_url} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                                </div>
                            ) : (
                                <img src={msg.media_url} alt="media" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            )}
                        </div>
                    )) : <EmptyState text={t("chatInfo.noMedia")} icon={ImageIcon} />}
                </div>
            )}

            {activeTab === "files" && (
                <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {sharedFiles.length > 0 ? sharedFiles.map((msg, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 border border-adaptive rounded-xl cursor-pointer hover:bg-surface/50">
                            <File size={18} className="text-primary" />
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold truncate">{msg.file_name}</p>
                                <p className="text-xs text-muted">{msg.file_size}</p>
                            </div>
                        </div>
                    )) : <EmptyState text={t("chatInfo.noFiles")} icon={FileText} />}
                </div>
            )}

            {activeTab === "links" && (
                <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {sharedLinks.length > 0 ? sharedLinks.map((msg, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 border border-adaptive rounded-xl cursor-pointer hover:bg-surface/50">
                            <Link size={18} className="text-primary shrink-0" />
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold truncate">{msg.link_title || "Link"}</p>
                                <p className="text-xs text-muted truncate">{msg.link_url}</p>
                            </div>
                        </div>
                    )) : <EmptyState text={t("chatInfo.noLinks")} icon={Link2} />}
                </div>
            )}
        </div>
    </div>
));

const ActionsSection = memo(({
    isGroup, isMuted, isBlocked, loading, isOwner, isChatLocked,
    onMuteToggle, onBlockToggle, onToggleLock, onLeave, onDelete, t
}) => (
    <div className="space-y-3 border-t border-adaptive pt-6 pb-8">
        <button
            onClick={onMuteToggle}
            className="w-full flex items-center justify-between p-4 bg-main hover:bg-main/80 rounded-2xl transition-all group border border-adaptive hover:border-primary/30 shadow-sm"
        >
            <div className="flex items-center gap-3 text-content font-bold">
                {isMuted ? <BellOff size={18} className="text-red-500" /> : <Bell size={18} className="text-primary" />}
                <span className="text-sm">{isMuted ? t("chatInfo.unmute") : t("chatInfo.mute")}</span>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${isMuted ? "bg-primary" : "bg-zinc-600"}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${isMuted ? "start-6" : "start-1"}`} />
            </div>
        </button>

        {!isGroup && (
            <button
                onClick={onBlockToggle}
                disabled={loading}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group border ${isBlocked ? "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10" : "bg-red-500/5 hover:bg-red-500/10 text-red-500 border-red-500/10 hover:border-red-500/30"}`}
            >
                <div className="flex items-center gap-3 font-bold text-sm">
                    {isBlocked ? <CheckCircle size={18} /> : <Ban size={18} />}
                    <span>{isBlocked ? t("chatInfo.unblock") : t("chatInfo.block")}</span>
                </div>
            </button>
        )}

        {isOwner && (
            <div className="flex items-center justify-between p-4 bg-main rounded-2xl border border-adaptive mt-2">
                <div className="flex items-center gap-3">
                    {isChatLocked ? <Lock size={18} className="text-red-500" /> : <Unlock size={18} className="text-primary" />}
                    <div className="flex flex-col text-start">
                        <span className="text-sm font-bold text-content">
                            {isChatLocked ? t("chatInfo.openGroup") : t("chatInfo.closeGroup")}
                        </span>
                        <span className="text-[10px] text-muted">
                            {isChatLocked ? t("chatInfo.closeGroupDesc") : t("chatInfo.openGroupDesc")}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onToggleLock}
                    className={`w-10 h-5 rounded-full relative transition-colors ${isChatLocked ? "bg-red-500" : "bg-zinc-600"}`}
                >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isChatLocked ? "start-6" : "start-1"}`} />
                </button>
            </div>
        )}

        <button
            onClick={isGroup ? onLeave : onDelete}
            className="w-full flex items-center justify-center gap-2 p-4 bg-transparent hover:bg-red-500/5 rounded-2xl transition group text-red-500/70 hover:text-red-600 border border-transparent hover:border-red-500/20 mt-4"
        >
            {isGroup ? <LogOut size={18} /> : <Trash2 size={18} />}
            <span className="font-bold text-sm">{isGroup ? t("chatInfo.leaveGroup") : t("chatInfo.deleteChat")}</span>
        </button>
    </div>
));

// --- Main Component ---

const ChatInfoSidebar = ({ data, isGroup = false, isOpen, onClose, messages = [], onMessagesClear }) => {
    const { getToken } = useAuth();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { currentUser } = useSelector(state => state.user);
    const { t } = useTranslation();

    // --- State ---
    const [activeTab, setActiveTab] = useState("media");
    const [isMuted, setIsMuted] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMembersOpen, setIsMembersOpen] = useState(false);

    // --- Derived Data ---
    const name = isGroup ? data?.name : data?.full_name;
    const subtitle = isGroup ? t("chatInfo.membersCount", { count: data?.members?.length || 0 }) : `@${data?.username}`;
    const members = isGroup ? data?.members : [];
    // Handle image display logic safely
    const image = isGroup
        ? data?.group_image
        : (data?.profile_picture || data?.image);
    const bio = !isGroup ? data?.bio : data?.description;

    // Determine Owner/Admin status
    const isOwner = isGroup && (data?.owner === currentUser?._id || data?.owner?._id === currentUser?._id);
    const ownerId = isGroup ? (typeof data?.owner === 'object' ? data?.owner?._id : data?.owner) : null;

    // --- Effects ---
    useEffect(() => {
        if (currentUser && data) {
            if (!isGroup && currentUser.mutedUsers) setIsMuted(currentUser.mutedUsers.includes(data._id));
            if (!isGroup && currentUser.blockedUsers) setIsBlocked(currentUser.blockedUsers.includes(data._id));
        }
    }, [currentUser, data, isGroup]);

    // --- Memoized Content ---
    const sharedMedia = useMemo(() => messages.filter(msg => (msg.message_type === "image" || msg.message_type === "video") && msg.media_url), [messages]);
    const sharedFiles = useMemo(() => messages.filter(msg => msg.message_type === "file"), [messages]);
    const sharedLinks = useMemo(() => {
        return messages.filter(msg => msg.text?.match(/https?:\/\/[^\s]+/)).map(msg => ({
            ...msg,
            link_url: msg.text.match(/https?:\/\/[^\s]+/)[0],
            link_title: "Link" // Placeholder if no metadata
        }));
    }, [messages]);

    // --- Handlers ---

    const handleMuteToggle = useCallback(async () => {
        if (isGroup) return toast(t("chatInfo.groupMuteSoon"));
        try {
            const token = await getToken();
            const { data: res } = await api.put(`/user/mute/${data._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setIsMuted(res.isMuted);
            toast.success(res.message);
            dispatch(toggleMuteLocal(data._id));
        } catch (error) { toast.error(t("chatInfo.error")); }
    }, [isGroup, data, getToken, dispatch, t]);

    const handleBlockToggle = useCallback(async () => {
        if (loading || isGroup) return;
        setLoading(true);
        try {
            const token = await getToken();
            const { data: res } = await api.put(`/user/block/${data._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setIsBlocked(res.isBlocked);
            toast.success(res.message);
        } catch (error) { toast.error(t("chatInfo.error")); } finally { setLoading(false); }
    }, [loading, isGroup, data, getToken, t]);

    const handleDeleteChat = useCallback(async () => {
        if (!window.confirm(t("chatInfo.deleteConfirm"))) return;
        try {
            const token = await getToken();
            await api.delete(`/message/conversation/${data._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("chatInfo.chatCleared"));
            if (onMessagesClear) onMessagesClear();
            onClose();
        } catch (error) { toast.error(t("chatInfo.error")); }
    }, [data, getToken, t, onMessagesClear, onClose]);

    const handleLeaveGroup = useCallback(async () => {
        if (!window.confirm(t("chatInfo.leaveConfirm", { name }))) return;
        try {
            const token = await getToken();
            await api.put(`/group/leave/${data._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("chatInfo.leftGroup"));
            onClose();
            navigate("/groups/available");
        } catch (error) { toast.error(t("chatInfo.error")); }
    }, [name, data, getToken, t, onClose, navigate]);

    const handleKickMember = useCallback(async (memberId, memberName) => {
        if (!window.confirm(t("chatInfo.kickConfirm", { name: memberName }))) return;
        try {
            const token = await getToken();
            await api.put("/group/kick", { groupId: data._id, memberId }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("chatInfo.kicked", { name: memberName }));
            window.location.reload();
        } catch (error) { toast.error(t("chatInfo.error")); }
    }, [data, getToken, t]);

    const handleToggleLock = useCallback(async () => {
        try {
            const token = await getToken();
            await api.put(`/group/toggle-lock/${data._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
            toast.error(t("chatInfo.error"));
        }
    }, [data, getToken, t]);

    const handleCopyInfo = useCallback(() => {
        const textToCopy = isGroup ? name : data.username;
        navigator.clipboard.writeText(textToCopy);
        toast.success(t("chatInfo.copied", { text: textToCopy }));
    }, [isGroup, name, data, t]);

    const handleNavigateProfile = useCallback((id) => {
        navigate(`/profile/${id}`);
    }, [navigate]);

    // --- Variants ---
    const sidebarVariants = {
        closed: { x: "100%", opacity: 0 },
        open: { x: "0%", opacity: 1 }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop for Mobile */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
                    />

                    {/* Sidebar */}
                    <motion.div
                        variants={sidebarVariants}
                        initial="closed"
                        animate="open"
                        exit="closed"
                        transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                        className="fixed md:relative end-0 top-0 h-full w-[85vw] md:w-[400px] bg-surface/95 backdrop-blur-xl border-s border-adaptive z-40 overflow-hidden shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-adaptive flex items-center justify-between bg-surface/50">
                            <h2 className="font-bold text-content text-lg">{t("chatInfo.title")}</h2>
                            <button onClick={onClose} className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full text-muted transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-8">
                            <ProfileSection
                                isGroup={isGroup}
                                image={image}
                                name={name}
                                subtitle={subtitle}
                                bio={bio}
                                onCopyInfo={handleCopyInfo}
                            />

                            <MembersSection
                                isGroup={isGroup}
                                members={members}
                                isMembersOpen={isMembersOpen}
                                setIsMembersOpen={setIsMembersOpen}
                                ownerId={ownerId}
                                currentUserId={currentUser?._id}
                                onKick={handleKickMember}
                                onNavigate={handleNavigateProfile}
                                t={t}
                            />

                            <SharedContentSection
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                sharedMedia={sharedMedia}
                                sharedFiles={sharedFiles}
                                sharedLinks={sharedLinks}
                                t={t}
                            />

                            <ActionsSection
                                isGroup={isGroup}
                                isMuted={isMuted}
                                isBlocked={isBlocked}
                                loading={loading}
                                isOwner={isOwner}
                                isChatLocked={data?.isChatLocked}
                                onMuteToggle={handleMuteToggle}
                                onBlockToggle={handleBlockToggle}
                                onToggleLock={handleToggleLock}
                                onLeave={handleLeaveGroup}
                                onDelete={handleDeleteChat}
                                t={t}
                            />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ChatInfoSidebar;