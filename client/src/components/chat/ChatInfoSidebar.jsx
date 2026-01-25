/**
 * ChatInfoSidebar Component
 * ------------------------------------------------------------------
 * A sliding sidebar that displays detailed information about a chat or group.
 * Features:
 * - Profile/Group Info (Avatar, Name, Bio)
 * - Member Management (for Groups)
 * - Shared Media/Files/Links Gallery
 * - Actions (Mute, Block, Leave, Delete)
 * - Optimized with Memoization and Framer Motion.
 */

import { useState, useEffect, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import {
    X, Bell, BellOff, ShieldAlert, Trash2, Ban, CheckCircle,
    Image as ImageIcon, FileText, Link2, Users, LogOut, ChevronDown,
    Video, ExternalLink, Copy, Download, File, UserMinus
} from "lucide-react";

// API & Actions
import api from "../../lib/axios";
import { toggleMuteLocal } from "../../features/userSlice";

// Components
import UserAvatar from "../common/UserDefaultAvatar";

// --- Sub-Components (Memoized) ---

// 1. Empty State
const EmptyState = memo(({ text, icon: Icon }) => (
    <div className="col-span-3 flex flex-col items-center justify-center py-10 opacity-50">
        <div className="bg-adaptive p-3 rounded-full mb-2">
            <Icon size={20} className="text-muted" />
        </div>
        <p className="text-xs text-muted font-medium">{text}</p>
    </div>
));

// 2. Member Item (For Group List)
const MemberItem = memo(({ member, isOwner, amIAdmin, currentUserId, onKick, onClick }) => {
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
                        {isOwner && <span className="text-[9px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded-md font-bold border border-yellow-500/20">OWNER</span>}
                        {isMe && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-bold">YOU</span>}
                    </div>
                    <p className="text-xs text-muted truncate">@{member.username}</p>
                </div>
            </div>

            {amIAdmin && !isOwner && !isMe && (
                <button
                    onClick={(e) => { e.stopPropagation(); onKick(member._id, member.full_name); }}
                    className="p-2 text-red-500/50 hover:text-red-600 bg-transparent hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover/item:opacity-100"
                    title="Remove Member"
                >
                    <UserMinus size={18} />
                </button>
            )}
        </motion.div>
    );
});

// --- Main Component ---

const ChatInfoSidebar = ({ data, isGroup = false, isOpen, onClose, messages = [], onMessagesClear }) => {
    const { getToken } = useAuth();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { currentUser } = useSelector(state => state.user);

    // --- State ---
    const [activeTab, setActiveTab] = useState("media");
    const [isMuted, setIsMuted] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMembersOpen, setIsMembersOpen] = useState(false);

    // --- Derived Data ---
    const name = isGroup ? data?.name : data?.full_name;
    const subtitle = isGroup ? `${data?.members?.length || 0} members` : `@${data?.username}`;
    const members = isGroup ? data?.members : [];
    const image = isGroup ? data?.group_image : (data?.profile_picture || data?.image);
    const bio = !isGroup ? data?.bio : data?.description;

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
            link: msg.text.match(/https?:\/\/[^\s]+/)[0]
        }));
    }, [messages]);

    // --- Handlers ---

    const handleMuteToggle = async () => {
        if (isGroup) return toast("Mute for groups coming soon! 🤫");
        try {
            const token = await getToken();
            const { data: res } = await api.put(`/user/mute/${data._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setIsMuted(res.isMuted);
            toast.success(res.message);
            dispatch(toggleMuteLocal(data._id));
        } catch (error) { toast.error("Failed to mute"); }
    };

    const handleBlockToggle = async () => {
        if (loading || isGroup) return;
        setLoading(true);
        try {
            const token = await getToken();
            const { data: res } = await api.put(`/user/block/${data._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setIsBlocked(res.isBlocked);
            toast.success(res.message);
        } catch (error) { toast.error("Failed"); } finally { setLoading(false); }
    };

    const handleDeleteChat = async () => {
        if (!window.confirm("Delete chat history? This cannot be undone.")) return;
        try {
            const token = await getToken();
            await api.delete(`/message/conversation/${data._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Chat cleared ✨");
            if (onMessagesClear) onMessagesClear();
            onClose();
        } catch (error) { toast.error("Failed"); }
    };

    const handleLeaveGroup = async () => {
        if (!window.confirm(`Leave "${name}" group?`)) return;
        try {
            const token = await getToken();
            await api.put(`/group/leave/${data._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("You left the group 👋");
            onClose();
            navigate("/group/discovery");
        } catch (error) { toast.error("Failed to leave"); }
    };

    const handleKickMember = async (memberId, memberName) => {
        if (!window.confirm(`Remove ${memberName} from the group?`)) return;
        try {
            const token = await getToken();
            await api.put("/group/kick", { groupId: data._id, memberId }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(`${memberName} removed`);
            window.location.reload();
        } catch (error) { toast.error("Failed to remove member"); }
    };

    const handleCopyInfo = () => {
        const textToCopy = isGroup ? name : data.username;
        navigator.clipboard.writeText(textToCopy);
        toast.success(`Copied: ${textToCopy} 📋`);
    };

    // --- Animation Variants ---
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
                        className="fixed md:relative right-0 top-0 h-full w-[85vw] md:w-[400px] bg-surface/95 backdrop-blur-xl border-l border-adaptive z-40 overflow-hidden shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-adaptive flex items-center justify-between bg-surface/50">
                            <h2 className="font-bold text-content text-lg">Contact Info</h2>
                            <button onClick={onClose} className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full text-muted transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-8">

                            {/* 👤 Profile Section */}
                            <div className="flex flex-col items-center justify-center text-center space-y-4 relative">
                                <div className="relative group">
                                    {isGroup ? (
                                        <img src={image} alt={name} className="w-28 h-28 md:w-32 md:h-32 rounded-3xl object-cover ring-4 ring-surface shadow-2xl" />
                                    ) : (
                                        <UserAvatar user={data} className="w-28 h-28 md:w-32 md:h-32 shadow-2xl rounded-full ring-4 ring-surface" />
                                    )}
                                </div>

                                <div className="w-full">
                                    <div
                                        className="relative flex items-center justify-center gap-2 cursor-pointer group"
                                        onClick={handleCopyInfo}
                                        title="Click to copy name"
                                    >
                                        <h3 className="text-2xl font-black text-content tracking-tight group-hover:text-primary transition-colors">{name}</h3>
                                        <Copy size={16} className="absolute right-0 text-muted opacity-0 group-hover:opacity-100 transition-all" />
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

                            {/* 👥 Members List (Group Only) */}
                            {isGroup && members && (
                                <div className="border-t border-adaptive pt-4">
                                    <button onClick={() => setIsMembersOpen(!isMembersOpen)} className="w-full flex items-center justify-between py-2 px-1 text-muted hover:text-primary transition group">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em]">Group Members ({members.length})</h4>
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
                                                <div className="max-h-64 overflow-y-auto pr-2 space-y-2 custom-scrollbar mt-2 p-1">
                                                    {members.map((memberWrap, index) => (
                                                        <MemberItem
                                                            key={memberWrap.user._id || index}
                                                            member={memberWrap.user}
                                                            isOwner={data.owner === memberWrap.user._id || data.owner?._id === memberWrap.user._id}
                                                            amIAdmin={data.owner === currentUser._id || data.owner?._id === currentUser._id}
                                                            currentUserId={currentUser._id}
                                                            onKick={handleKickMember}
                                                            onClick={(id) => navigate(`/profile/${id}`)}
                                                        />
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Shared Content Tabs */}
                            <div className="space-y-4 border-t border-adaptive pt-6">
                                <div className="flex bg-main p-1 rounded-xl border border-adaptive">
                                    {[{ id: "media", icon: ImageIcon, label: "Media" }, { id: "files", icon: FileText, label: "Files" }, { id: "links", icon: Link2, label: "Links" }].map((tab) => (
                                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-extrabold rounded-lg transition-all duration-300 ${activeTab === tab.id ? "bg-surface text-primary shadow-sm scale-[1.02]" : "text-muted hover:text-content hover:bg-surface/50"}`}>
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
                                            )) : <EmptyState text="No media shared yet" icon={ImageIcon} />}
                                        </div>
                                    )}
                                    {activeTab === "files" && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {sharedFiles.length > 0 ? sharedFiles.map((msg, index) => (
                                                <div key={index} className="flex items-center gap-3 p-3 bg-main rounded-xl border border-adaptive hover:border-primary/30 transition cursor-pointer group" onClick={() => window.open(msg.media_url, "_blank")}>
                                                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><File size={18} /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold truncate text-content">File Attachment</p>
                                                        <p className="text-[10px] text-muted">{format(new Date(msg.createdAt), "dd MMM, yyyy")}</p>
                                                    </div>
                                                    <Download size={16} className="text-muted group-hover:text-primary transition" />
                                                </div>
                                            )) : <EmptyState text="No files shared yet" icon={FileText} />}
                                        </div>
                                    )}
                                    {activeTab === "links" && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {sharedLinks.length > 0 ? sharedLinks.map((msg, index) => (
                                                <div key={index} className="flex items-center gap-3 p-3 bg-main rounded-xl border border-adaptive hover:border-blue-500/30 transition cursor-pointer group" onClick={() => window.open(msg.link, "_blank")}>
                                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Link2 size={18} /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold truncate text-blue-400 hover:underline">{msg.link}</p>
                                                        <p className="text-[10px] text-muted">Sent by {msg.sender?.full_name?.split(' ')[0]}</p>
                                                    </div>
                                                    <ExternalLink size={14} className="text-muted group-hover:text-blue-500 transition" />
                                                </div>
                                            )) : <EmptyState text="No links shared yet" icon={Link2} />}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions Section */}
                            <div className="space-y-3 border-t border-adaptive pt-6 pb-8">
                                <button onClick={handleMuteToggle} className="w-full flex items-center justify-between p-4 bg-main hover:bg-main/80 rounded-2xl transition-all group border border-adaptive hover:border-primary/30 shadow-sm">
                                    <div className="flex items-center gap-3 text-content font-bold">
                                        {isMuted ? <BellOff size={18} className="text-red-500" /> : <Bell size={18} className="text-primary" />}
                                        <span className="text-sm">{isMuted ? "Unmute Notifications" : "Mute Notifications"}</span>
                                    </div>
                                    <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${isMuted ? "bg-primary" : "bg-zinc-600"}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${isMuted ? "left-6" : "left-1"}`} />
                                    </div>
                                </button>

                                {!isGroup && (
                                    <button onClick={handleBlockToggle} disabled={loading} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group border ${isBlocked ? "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10" : "bg-red-500/5 hover:bg-red-500/10 text-red-500 border-red-500/10 hover:border-red-500/30"}`}>
                                        <div className="flex items-center gap-3 font-bold text-sm">
                                            {isBlocked ? <CheckCircle size={18} /> : <Ban size={18} />}
                                            <span>{isBlocked ? `Unblock User` : `Block User`}</span>
                                        </div>
                                    </button>
                                )}

                                <button onClick={isGroup ? handleLeaveGroup : handleDeleteChat} className="w-full flex items-center justify-center gap-2 p-4 bg-transparent hover:bg-red-500/5 rounded-2xl transition group text-red-500/70 hover:text-red-600 border border-transparent hover:border-red-500/20 mt-4">
                                    {isGroup ? <LogOut size={18} /> : <Trash2 size={18} />}
                                    <span className="font-bold text-sm">{isGroup ? "Leave Group" : "Delete Chat History"}</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ChatInfoSidebar;