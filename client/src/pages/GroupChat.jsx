/**
 * GroupChat Component
 * ------------------------------------------------------------------
 * Architect: Senior Frontend Architect
 * Purpose: Handles group messaging, real-time socket events, media I/O,
 * and AI integrations.
 *
 * Optimizations:
 * - Memoized child components (Header, Input, List)
 * - Auto-cleanup for ObjectURLs
 * - Lazy loaded EmojiPicker
 * - Framer Motion for UI transitions
 */

import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    lazy,
    Suspense,
    useLayoutEffect,
    useMemo
} from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { ar, enUS } from "date-fns/locale";

// 3rd Party Libraries
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";

// Icons
import {
    Send, Image as ImageIcon, Mic, ArrowLeft, MoreVertical, BarChart2,
    X, Smile, Trash2, StopCircle, Pause, Play, ShieldAlert, Loader2, Lock, Check,
    Sparkles, Bot, Plus
} from "lucide-react";

// Context & API
import { useSocketContext } from "../context/SocketContext";
import api from "../lib/axios";
import useInfiniteScroll from "../hooks/useInfiniteScroll";
import useOfflineSync from "../hooks/useOfflineSync";

// Components
import Loading from "../components/common/Loading";
import ChatInfoSidebar from "../components/chat/ChatInfoSidebar";
import ReactionDetailsModal from "../components/modals/ReactionDetailsModal";
import MessageItem from "../components/chat/MessageItem";
import CreatePollModal from "../components/modals/CreatePollModal";

// Lazy Load
const EmojiPicker = lazy(() => import('emoji-picker-react'));

// --- Sub-Components (Defined below main for cleaner file structure) ---
// const ChatHeader = ...
// const ChatInputArea = ...
// const SummaryModal = ...

const GroupChat = () => {
    // --- Hooks & Params ---
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { socket } = useSocketContext();
    const { userId, getToken } = useAuth();
    const { currentUser } = useSelector((state) => state.user);
    const { t, i18n } = useTranslation();
    const currentLocale = i18n.language === 'ar' ? ar : enUS;
    const { addToQueue } = useOfflineSync();

    // --- State Management ---
    // Core Data
    const [messages, setMessages] = useState([]);
    const [groupInfo, setGroupInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [membershipStatus, setMembershipStatus] = useState("loading");

    // Interaction States
    const [newMessage, setNewMessage] = useState("");
    const [replyTo, setReplyTo] = useState(null);
    const [highlightedId, setHighlightedId] = useState(null);
    const [showChatInfo, setShowChatInfo] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [typingUser, setTypingUser] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [isChatLocked, setIsChatLocked] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingOld, setIsFetchingOld] = useState(false);
    const [showPollModal, setShowPollModal] = useState(false);

    // Mobile Layout State
    const [showAttachments, setShowAttachments] = useState(false);

    // AI Summarization State
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryText, setSummaryText] = useState(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    // Editing & Sync State
    const [editingMessage, setEditingMessage] = useState(null);
    const [syncTrigger, setSyncTrigger] = useState(0);

    // Media & Recording States
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const [previewTime, setPreviewTime] = useState(0);
    const [previewDurationState, setPreviewDurationState] = useState(0);

    // Reaction States
    const [activeReactionId, setActiveReactionId] = useState(null);
    const [viewReactionMessage, setViewReactionMessage] = useState(null);

    // --- Refs ---
    const messagesEndRef = useRef(null);
    const messageRefs = useRef({});
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const timerRef = useRef(null);
    const audioPreviewRef = useRef(null);
    const isFirstLoad = useRef(true);
    const scrollContainerRef = useRef(null);
    const prevScrollHeightRef = useRef(null);
    const groupIdRef = useRef(groupId);

    // --- Effects: Memory Management (Refactor Addition) ---
    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [imagePreview, audioUrl]);

    // --- Logic: AI Summary ---
    const handleSummarizeChat = async () => {
        setIsSummarizing(true);
        try {
            const token = await getToken();
            const res = await api.post("/gemeni/summarize",
                { chatId: groupId, isGroup: true },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                setSummaryText(res.data.summary);
                setShowSummaryModal(true);
            }
        } catch (error) {
            console.error("AI Summary Error:", error);
            toast.error(error.response?.data?.message || t("error.somethingWentWrong"));
        } finally {
            setIsSummarizing(false);
        }
    };

    // --- Logic: Callbacks & Handlers ---
    const scrollToMessage = useCallback((messageId) => {
        const element = messageRefs.current[messageId];
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightedId(messageId);
            setTimeout(() => setHighlightedId(null), 1000);
        } else {
            toast(t("groupChat.toasts.messageNotLoaded"), { icon: "🔍" });
        }
    }, [t]);

    const handleReaction = useCallback(async (msgId, emoji) => {
        setActiveReactionId(null);
        setMessages(prev => prev.map(msg => {
            if (msg._id === msgId) {
                const userObj = {
                    _id: currentUser._id,
                    full_name: currentUser.full_name,
                    username: currentUser.username,
                    profile_picture: currentUser.profile_picture || currentUser.image
                };
                const userIdStr = currentUser._id;
                const existingIndex = msg.reactions?.findIndex(r => r.user?._id === userIdStr || r.user === userIdStr);
                let newReactions = msg.reactions ? [...msg.reactions] : [];

                if (existingIndex > -1) {
                    if (newReactions[existingIndex].emoji === emoji) {
                        newReactions.splice(existingIndex, 1);
                    } else {
                        newReactions[existingIndex] = { ...newReactions[existingIndex], emoji: emoji };
                    }
                } else {
                    newReactions.push({ user: userObj, emoji });
                }
                return { ...msg, reactions: newReactions };
            }
            return msg;
        }));

        try {
            const token = await getToken();
            await api.post("/group/react", { messageId: msgId, emoji }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
            console.error("Reaction failed:", error);
        }
    }, [currentUser, getToken]);

    const handleSetReplyTo = useCallback((msg) => setReplyTo(msg), []);
    const handleSetActiveReactionId = useCallback((id) => setActiveReactionId(prev => prev === id ? null : id), []);
    const handleSetViewReactionMessage = useCallback((msg) => setViewReactionMessage(msg), []);

    const getReadStatus = useCallback((msg) => {
        if (!groupInfo || !groupInfo.members) return "delivered";
        const totalMembers = groupInfo.members.length;
        const targetAudienceCount = totalMembers > 1 ? totalMembers - 1 : 0;
        const readBy = msg.readBy || [];
        const senderId = msg.sender?._id?.toString() || msg.sender?.toString();
        const uniqueReaders = new Set(readBy.map(id => id.toString()));
        if (senderId) uniqueReaders.delete(senderId);
        return uniqueReaders.size >= targetAudienceCount ? "read" : "delivered";
    }, [groupInfo, currentUser]);

    const fetchMoreMessages = useCallback(async () => {
        if (!hasMore || isFetchingOld) return;
        if (scrollContainerRef.current) prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
        setIsFetchingOld(true);
        try {
            const token = await getToken();
            const nextPage = page + 1;
            const res = await api.get(`/group/messages/${groupId}?page=${nextPage}&limit=20`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m._id));
                    const uniqueNewMessages = res.data.messages.filter(msg => !existingIds.has(msg._id));
                    return [...uniqueNewMessages, ...prev];
                });
                setHasMore(res.data.hasMore);
                setPage(nextPage);
            }
        } catch (error) {
            console.error("Failed to load older messages", error);
        } finally {
            setIsFetchingOld(false);
        }
    }, [page, hasMore, isFetchingOld, groupId, getToken]);

    const lastMsgRef = useInfiniteScroll(fetchMoreMessages, hasMore, isFetchingOld);

    const handleDeleteMessage = useCallback(async (messageId) => {
        setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, isDeleted: true } : msg));
        try {
            const token = await getToken();
            await api.delete(`/group/message/${messageId}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(t("messages.deleted_success"));
        } catch (error) {
            console.error("Delete failed", error);
            toast.error(t("messages.delete_failed"));
        }
    }, [getToken, t]);

    const handleEditMessage = useCallback((msg) => {
        setEditingMessage(msg);
        setNewMessage(msg.text);
        fileInputRef.current?.focus();
    }, []);

    const cancelEdit = () => {
        setEditingMessage(null);
        setNewMessage("");
    };

    const handleVote = useCallback(async (messageId, optionIndex) => {
        setMessages(prev => prev.map(msg => {
            if (msg._id === messageId) {
                const newPoll = { ...msg.poll };
                const userIdStr = currentUser._id;
                const targetOption = newPoll.options[optionIndex];
                const alreadyVoted = targetOption.votes.includes(userIdStr);
                if (alreadyVoted) {
                    targetOption.votes = targetOption.votes.filter(id => id !== userIdStr);
                } else {
                    if (!newPoll.allowMultipleAnswers) {
                        newPoll.options.forEach(opt => { opt.votes = opt.votes.filter(id => id !== userIdStr); });
                    }
                    targetOption.votes.push(userIdStr);
                }
                return { ...msg, poll: newPoll };
            }
            return msg;
        }));
        try {
            const token = await getToken();
            await api.put("/group/poll/vote", { messageId, optionIndex }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
            console.error("Vote failed");
            toast.error("Failed to vote");
        }
    }, [currentUser, getToken]);

    const handleCreatePoll = async (pollData) => {
        try {
            const token = await getToken();
            const res = await api.post("/group/poll", { groupId, ...pollData }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setMessages(prev => [...prev, res.data.message]);
                setShowPollModal(false);
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            }
        } catch (error) {
            console.error("Create poll failed", error);
            toast.error("Failed to create poll");
        }
    };

    // --- Logic: Data Fetching & Socket ---
    useEffect(() => {
        const fetchGroupData = async () => {
            try {
                const token = await getToken();
                const groupRes = await api.get(`/group/${groupId}`, { headers: { Authorization: `Bearer ${token}` } });
                const groupData = groupRes.data.group;
                setGroupInfo(groupData);
                setIsChatLocked(groupData.isChatLocked);

                const myMemberRecord = groupData.members.find(m => m.user._id === currentUser._id || m.user === currentUser._id);
                if (!myMemberRecord) {
                    setMembershipStatus("none");
                    toast.error(t("groupChat.toasts.notMember"));
                    navigate("/groups/available");
                    return;
                } else if (myMemberRecord.status === "pending") {
                    setMembershipStatus("pending");
                } else {
                    setMembershipStatus("accepted");
                    const msgRes = await api.get(`/group/messages/${groupId}?page=1&limit=20`, { headers: { Authorization: `Bearer ${token}` } });
                    let loadedMessages = msgRes.data.messages || [];

                    const offlineQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
                    const pendingForThisGroup = offlineQueue
                        .filter(item => item.data.groupId === groupId)
                        .map(item => ({
                            _id: item.timestamp || Date.now(),
                            text: item.data.text,
                            sender: { _id: currentUser?._id, profile_picture: currentUser?.profile_picture || currentUser?.image },
                            message_type: "text",
                            createdAt: new Date(item.timestamp || Date.now()).toISOString(),
                            status: "pending",
                            isSending: true,
                            readBy: [],
                            replyTo: item.data.replyTo ? { _id: item.data.replyTo, text: "Loading..." } : null
                        }));

                    setMessages([...loadedMessages, ...pendingForThisGroup]);
                    setHasMore(msgRes.data.hasMore);
                    setPage(1);
                    try { await api.put(`/group/read/${groupId}`, {}, { headers: { Authorization: `Bearer ${token}` } }); } catch (e) { }
                }
            } catch (err) {
                console.error("Error fetching group:", err);
                navigate("/groups/available");
            } finally {
                setLoading(false);
            }
        };
        if (groupId && userId && currentUser) fetchGroupData();
    }, [groupId, userId, getToken, currentUser, navigate, t, syncTrigger]);

    useEffect(() => { groupIdRef.current = groupId; }, [groupId]);

    useEffect(() => {
        if (!socket) return;
        socket.emit("joinGroup", groupId);
        const handleNewMessage = async (msg) => {
            const currentGroupId = groupIdRef.current;
            const isCurrentGroup = (msg.group === currentGroupId || msg.groupId === currentGroupId);
            const isMe = String(msg.sender?._id) === String(currentUser?._id) || String(msg.sender?.clerkId) === String(userId);
            if (isCurrentGroup && !isMe) {
                setMessages((prev) => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
                try {
                    const token = await getToken();
                    await api.put(`/group/read/${groupId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                } catch (error) { }
            }
        };
        const handleSocketReaction = ({ messageId, reactions }) => setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, reactions } : msg));
        const handleReadStatusUpdate = ({ groupId: gId, userId: uId }) => {
            if (gId === groupIdRef.current) setMessages(prev => prev.map(msg => !msg.readBy?.includes(uId) ? { ...msg, readBy: [...(msg.readBy || []), uId] } : msg));
        };
        const handleDelete = ({ messageId, groupId: gId }) => {
            if (gId === groupIdRef.current) setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, isDeleted: true, text: "", media_url: null } : msg));
        };
        const handleUpdate = ({ messageId, groupId: gId, newText }) => {
            if (gId === groupIdRef.current) setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, text: newText, isEdited: true } : msg));
        };

        socket.on("receiveGroupMessage", handleNewMessage);
        socket.on("groupMessageReaction", handleSocketReaction);
        socket.on("groupMessagesRead", handleReadStatusUpdate);
        socket.on("groupMessageDeleted", handleDelete);
        socket.on("groupMessageUpdated", handleUpdate);
        socket.on("typingGroup", (data) => setTypingUser(data));
        socket.on("stop typingGroup", () => setTypingUser(null));
        socket.on("groupUpdated", ({ groupId: gId, isChatLocked: locked }) => {
            if (gId === groupIdRef.current) { setIsChatLocked(locked); setGroupInfo(prev => ({ ...prev, isChatLocked: locked })); }
        });
        socket.on("pollUpdated", ({ messageId, poll }) => setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, poll } : msg)));

        return () => {
            socket.off("receiveGroupMessage", handleNewMessage);
            socket.off("groupMessageReaction", handleSocketReaction);
            socket.off("groupMessagesRead", handleReadStatusUpdate);
            socket.off("groupMessageDeleted", handleDelete);
            socket.off("groupMessageUpdated", handleUpdate);
            socket.off("typingGroup");
            socket.off("stop typingGroup");
            socket.off("groupUpdated");
            socket.off("pollUpdated");
        };
    }, [socket, groupId, userId, currentUser, getToken]);

    useEffect(() => {
        const handleSyncComplete = () => setSyncTrigger(prev => prev + 1);
        window.addEventListener("messages-synced", handleSyncComplete);
        return () => window.removeEventListener("messages-synced", handleSyncComplete);
    }, []);

    useLayoutEffect(() => {
        if (loading) return;
        if (prevScrollHeightRef.current && scrollContainerRef.current) {
            const heightDifference = scrollContainerRef.current.scrollHeight - prevScrollHeightRef.current;
            scrollContainerRef.current.scrollTop += heightDifference;
            prevScrollHeightRef.current = null;
            return;
        }
        if (messages.length > 0) {
            isFirstLoad.current ? messagesEndRef.current?.scrollIntoView({ behavior: "auto" }) : messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            isFirstLoad.current = false;
        }
    }, [messages, loading]);

    useEffect(() => {
        let animationFrame;
        const animatePreview = () => {
            if (audioPreviewRef.current) {
                setPreviewTime(audioPreviewRef.current.currentTime);
                animationFrame = requestAnimationFrame(animatePreview);
            }
        };
        if (isPlayingPreview) animatePreview();
        else cancelAnimationFrame(animationFrame);
        return () => cancelAnimationFrame(animationFrame);
    }, [isPlayingPreview]);

    // --- Logic: Utils ---
    const formatDuration = (sec) => {
        if (!sec || isNaN(sec)) return "0:00";
        const min = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${min}:${s < 10 ? "0" : ""}${s}`;
    };
    const clearImage = () => {
        if (imagePreview) URL.revokeObjectURL(imagePreview); // Explicit Cleanup
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) { setSelectedImage(file); setImagePreview(URL.createObjectURL(file)); }
    };
    const handleEmojiClick = (emojiObject) => setNewMessage((prev) => prev + emojiObject.emoji);

    const handleInputChange = useCallback((e) => {
        setNewMessage(e.target.value);
        if (!socket || !groupId) return;
        if (!isTyping) {
            setIsTyping(true);
            socket.emit("typingGroup", { groupId: groupId, username: currentUser.full_name.split(" ")[0], image: currentUser.profile_picture || currentUser.image || "/avatar-placeholder.png" });
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => { setIsTyping(false); socket.emit("stop typingGroup", groupId); }, 3000);
    }, [socket, groupId, currentUser, isTyping]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => { const blob = new Blob(chunks, { type: "audio/webm" }); setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob)); };
            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingDuration(0);
            timerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
        } catch (err) { console.error("Microphone Access Error:", err); toast.error(t("chat.toasts.micDenied")); }
    };
    const stopRecording = () => {
        if (mediaRecorder) { mediaRecorder.stop(); setIsRecording(false); clearInterval(timerRef.current); mediaRecorder.stream.getTracks().forEach(track => track.stop()); }
    };
    const cancelRecording = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl); // Explicit Cleanup
        setAudioBlob(null); setAudioUrl(null); setIsRecording(false); setRecordingDuration(0); clearInterval(timerRef.current); if (mediaRecorder) mediaRecorder.stream.getTracks().forEach(track => track.stop());
    };

    const sendMessageToBackend = async (e) => {
        if (e) e.preventDefault();
        if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
        setIsTyping(false);
        if (socket && groupInfo?._id) socket.emit("stop typingGroup", groupInfo._id);

        if (editingMessage) {
            if (!newMessage.trim()) return;
            setMessages(prev => prev.map(msg => msg._id === editingMessage._id ? { ...msg, text: newMessage, isEdited: true } : msg));
            const msgId = editingMessage._id;
            const updatedText = newMessage;
            cancelEdit();
            try {
                const token = await getToken();
                await api.put(`/group/message/${msgId}`, { text: updatedText }, { headers: { Authorization: `Bearer ${token}` } });
            } catch (error) { console.error("Edit failed", error); toast.error("Failed to edit message"); }
            return;
        }

        if (!newMessage.trim() && !selectedImage && !audioBlob) return;
        const tempId = Date.now();
        const tempMessage = {
            _id: tempId, text: newMessage, sender: { clerkId: userId, _id: currentUser._id },
            message_type: selectedImage ? "image" : audioBlob ? "audio" : "text",
            media_url: selectedImage ? imagePreview : audioBlob ? audioUrl : "",
            replyTo: replyTo, readBy: [currentUser._id], createdAt: new Date().toISOString(), status: navigator.onLine ? "sending" : "pending", isSending: true
        };
        if (scrollContainerRef.current) setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 50);
        setMessages((prev) => [...prev, tempMessage]);
        setNewMessage(""); setReplyTo(null); clearImage(); setShowEmoji(false); setAudioBlob(null); setAudioUrl(null); setRecordingDuration(0); setShowAttachments(false);

        if (!navigator.onLine) {
            if (selectedImage || audioBlob) { toast.error("Media cannot be sent offline yet"); setMessages((prev) => prev.filter(msg => msg._id !== tempId)); return; }
            addToQueue("/group/send", { groupId: groupId, text: tempMessage.text, replyTo: replyTo?._id });
            return;
        }

        try {
            const token = await getToken();
            const formData = new FormData();
            formData.append("groupId", groupId);
            if (tempMessage.text) formData.append("text", tempMessage.text);
            if (replyTo) formData.append("replyTo", replyTo._id);
            if (selectedImage) formData.append("file", selectedImage);
            if (audioBlob) { const audioFile = new File([audioBlob], "voice-message.webm", { type: "audio/webm" }); formData.append("file", audioFile); }
            const res = await api.post(`/group/send`, formData, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } });
            setMessages((prev) => prev.map((msg) => msg._id === tempId ? { ...res.data.data, status: "sent" } : msg));
        } catch (error) {
            console.error("Send Error:", error);
            if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
                if (!selectedImage && !audioBlob) {
                    addToQueue("/group/send", { groupId: groupId, text: tempMessage.text, replyTo: replyTo?._id });
                    setMessages(prev => prev.map(msg => msg._id === tempId ? { ...msg, status: "pending", isSending: false } : msg));
                    return;
                }
            }
            toast.error(t("chat.toasts.sendFailed"));
            setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
        }
    };

    // --- Render Conditions ---
    if (loading) return <Loading />;

    if (membershipStatus === "pending") {
        return (
            <div className="flex h-screen items-center justify-center bg-main flex-col gap-4 animate-in fade-in">
                <ShieldAlert size={60} className="text-yellow-500" />
                <h2 className="text-2xl font-bold text-content">{t("groupChat.pendingTitle")}</h2>
                <p className="text-muted">{t("groupChat.pendingDesc")}</p>
                <button onClick={() => navigate("/groups/available")} className="px-6 py-2 bg-primary text-white rounded-full transition hover:bg-primary/90">{t("groupChat.goBack")}</button>
            </div>
        );
    }

    if (membershipStatus === "none") return null;
    const amIAdmin = groupInfo?.owner?._id === currentUser?._id || groupInfo?.owner === currentUser?._id;

    // --- Main Render ---
    return (
        <div className="flex flex-row h-screen scrollbar-hide overflow-hidden bg-main">
            <div className="flex flex-col flex-1 h-screen bg-main text-content relative overflow-hidden">

                {/* Header */}
                <ChatHeader
                    groupInfo={groupInfo}
                    t={t}
                    navigate={navigate}
                    handleSummarizeChat={handleSummarizeChat}
                    isSummarizing={isSummarizing}
                    setShowChatInfo={setShowChatInfo}
                />

                {/* Messages List */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pt-24 pb-4 space-y-6 scrollbar-hide bg-main relative">
                    <MessageList
                        messages={messages}
                        isFetchingOld={isFetchingOld}
                        currentUser={currentUser}
                        activeReactionId={activeReactionId}
                        handleSetActiveReactionId={handleSetActiveReactionId}
                        handleReaction={handleReaction}
                        handleSetReplyTo={handleSetReplyTo}
                        handleSetViewReactionMessage={handleSetViewReactionMessage}
                        scrollToMessage={scrollToMessage}
                        highlightedId={highlightedId}
                        getReadStatus={getReadStatus}
                        t={t}
                        currentLocale={currentLocale}
                        handleEditMessage={handleEditMessage}
                        handleDeleteMessage={handleDeleteMessage}
                        handleVote={handleVote}
                        messageRefs={messageRefs}
                        messagesEndRef={messagesEndRef}
                        lastMsgRef={lastMsgRef}
                    />

                    {/* Typing Indicator */}
                    <AnimatePresence>
                        {typingUser && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="flex items-end gap-3 px-3 py-2"
                            >
                                <div className="relative shrink-0">
                                    <div className="relative w-10 h-10 rounded-full ring-2 ring-border-adaptive shadow-sm overflow-hidden">
                                        <div className="w-full h-full rounded-full bg-surface flex items-center justify-center">
                                            <img src={typingUser?.image || "/avatar-placeholder.png"} alt={typingUser?.username} className="w-full h-full object-cover" onError={(e) => { e.target.src = "/avatar-placeholder.png"; }} />
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-0.5 -end-0.5 w-3 h-3 bg-green-500 border-2 border-main rounded-full animate-pulse shadow-sm"></div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="bg-surface/80 backdrop-blur-md border border-primary/20 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm w-fit transition-all hover:shadow-md">
                                        <div className="flex items-center gap-1.5 h-2">
                                            <span className="w-2 h-2 bg-primary/80 rounded-full animate-[bounce_1s_infinite_100ms]"></span>
                                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-[bounce_1s_infinite_200ms]"></span>
                                            <span className="w-2 h-2 bg-primary/40 rounded-full animate-[bounce_1s_infinite_300ms]"></span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-medium text-muted/80 ms-1 animate-pulse tracking-wide"><span className="text-primary font-bold">{typingUser?.username}</span> {t("groupChat.isTyping")}</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <ChatInputArea
                    isChatLocked={isChatLocked}
                    amIAdmin={amIAdmin}
                    t={t}
                    showEmoji={showEmoji}
                    setShowEmoji={setShowEmoji}
                    handleEmojiClick={handleEmojiClick}
                    imagePreview={imagePreview}
                    clearImage={clearImage}
                    replyTo={replyTo}
                    setReplyTo={setReplyTo}
                    editingMessage={editingMessage}
                    cancelEdit={cancelEdit}
                    isRecording={isRecording}
                    audioBlob={audioBlob}
                    recordingDuration={recordingDuration}
                    formatDuration={formatDuration}
                    audioPreviewRef={audioPreviewRef}
                    audioUrl={audioUrl}
                    isPlayingPreview={isPlayingPreview}
                    setIsPlayingPreview={setIsPlayingPreview}
                    previewDurationState={previewDurationState}
                    setPreviewDurationState={setPreviewDurationState}
                    previewTime={previewTime}
                    setPreviewTime={setPreviewTime}
                    cancelRecording={cancelRecording}
                    stopRecording={stopRecording}
                    sendMessageToBackend={sendMessageToBackend}
                    newMessage={newMessage}
                    handleInputChange={handleInputChange}
                    showAttachments={showAttachments}
                    setShowAttachments={setShowAttachments}
                    fileInputRef={fileInputRef}
                    handleImageSelect={handleImageSelect}
                    startRecording={startRecording}
                    setShowPollModal={setShowPollModal}
                />
            </div>

            {/* Modals & Sidebar */}
            <ReactionDetailsModal isOpen={!!viewReactionMessage} onClose={() => setViewReactionMessage(null)} message={viewReactionMessage} />
            <ChatInfoSidebar data={groupInfo} isGroup={true} isOpen={showChatInfo} onClose={() => setShowChatInfo(false)} messages={messages} />
            <CreatePollModal isOpen={showPollModal} onClose={() => setShowPollModal(false)} onSubmit={handleCreatePoll} />

            <AISummaryModal
                showSummaryModal={showSummaryModal}
                setShowSummaryModal={setShowSummaryModal}
                summaryText={summaryText}
            />
        </div>
    );
};

// --- Sub-Components Definitions ---

const ChatHeader = React.memo(({ groupInfo, t, navigate, handleSummarizeChat, isSummarizing, setShowChatInfo }) => (
    <div className="absolute top-0 start-0 end-0 h-20 bg-surface/90 backdrop-blur-md flex items-center justify-between px-4 z-20 border-b border-border-adaptive shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-main rounded-full transition text-muted hover:text-content rtl:scale-x-[-1]"><ArrowLeft size={22} /></button>
            <div className="relative"><img src={groupInfo?.group_image} alt="group" className="w-11 h-11 rounded-full object-cover ring-2 ring-border-adaptive" /></div>
            <div><h3 className="font-bold text-content text-lg leading-tight">{groupInfo?.name}</h3><p className="text-xs text-muted font-medium">{t("groupChat.membersActive", { count: groupInfo?.members?.length || 0 })}</p></div>
        </div>
        <div className="flex items-center gap-1">
            <button
                onClick={handleSummarizeChat}
                disabled={isSummarizing}
                className={`p-2 rounded-full transition relative group ${isSummarizing ? "animate-pulse" : "hover:bg-primary/10 text-primary"}`}
                title="Summarize Chat"
            >
                {isSummarizing ? <Loader2 size={22} className="animate-spin" /> : <Sparkles size={22} />}
                <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">Summarize</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowChatInfo(true); }} className="p-2 rounded-full transition hover:bg-main text-muted hover:text-content"><MoreVertical size={22} /></button>
        </div>
    </div>
));

const MessageList = React.memo(({ messages, isFetchingOld, messageRefs, lastMsgRef, ...props }) => (
    <>
        {isFetchingOld && (<div className="flex justify-center py-2"><Loader2 className="animate-spin text-primary w-6 h-6" /></div>)}
        {messages.map((msg, idx) => {
            const isFirstMessage = idx === 0;
            return (
                <div key={msg._id || idx} ref={(el) => { messageRefs.current[String(msg._id)] = el; if (isFirstMessage) lastMsgRef(el); }}>
                    <MessageItem msg={msg} userId={String(props.currentUser?._id)} {...props} />
                </div>
            );
        })}
    </>
));

const AISummaryModal = React.memo(({ showSummaryModal, setShowSummaryModal, summaryText }) => (
    <AnimatePresence>
        {showSummaryModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSummaryModal(false)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-border-adaptive">
                    <div className="bg-primary p-4 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2"><Bot size={24} /><h3 className="font-bold text-lg">AI Summary</h3></div>
                        <button onClick={() => setShowSummaryModal(false)} className="p-1 hover:bg-white/20 rounded-full transition"><X size={20} /></button>
                    </div>
                    <div className="p-6 overflow-y-auto custom-scrollbar text-content">
                        {summaryText ? (
                            <div className="prose dark:prose-invert max-w-none text-content">
                                {summaryText.split('\n').map((line, i) => (<p key={i} className="mb-2 leading-relaxed">{line}</p>))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-muted"><p>No summary available.</p></div>
                        )}
                    </div>
                    <div className="p-4 bg-main border-t border-border-adaptive flex justify-end">
                        <button onClick={() => setShowSummaryModal(false)} className="px-5 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition shadow-sm font-medium">Close</button>
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
));

const ChatInputArea = React.memo((props) => {
    const {
        isChatLocked, amIAdmin, t, showEmoji, setShowEmoji, handleEmojiClick,
        imagePreview, clearImage, replyTo, setReplyTo, editingMessage, cancelEdit,
        isRecording, audioBlob, recordingDuration, formatDuration, audioPreviewRef, audioUrl,
        isPlayingPreview, setIsPlayingPreview, previewDurationState, setPreviewDurationState,
        previewTime, setPreviewTime, cancelRecording, stopRecording, sendMessageToBackend,
        newMessage, handleInputChange, showAttachments, setShowAttachments, fileInputRef,
        handleImageSelect, startRecording, setShowPollModal
    } = props;

    if (isChatLocked && !amIAdmin) {
        return (
            <div className="bg-surface p-4 border-t border-border-adaptive shrink-0 z-30">
                <div className="flex flex-col items-center justify-center py-4 bg-main/50 rounded-2xl border border-dashed border-border-adaptive mx-4 animate-in fade-in">
                    <div className="bg-surface p-3 rounded-full mb-2 shadow-sm"><Lock size={20} className="text-red-500" /></div>
                    <p className="text-sm font-bold text-muted">{t("groupChat.chatLockedMsg")}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface p-2 md:p-4 border-t border-border-adaptive shrink-0 z-30">
            {/* Emoji Picker Modal */}
            {showEmoji && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowEmoji(false)}>
                    <div className="relative bg-surface rounded-2xl shadow-2xl border border-border-adaptive animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowEmoji(false)} className="absolute -top-3 -end-3 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-md z-50 transition-transform hover:scale-110"><X size={16} strokeWidth={3} /></button>
                        <Suspense fallback={<div className="w-[350px] h-[450px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
                            <EmojiPicker onEmojiClick={handleEmojiClick} theme="dark" lazyLoadEmojis={true} width={350} height={450} style={{ "--epe-bg-color": "rgb(var(--color-surface))", "--epe-category-label-bg-color": "rgb(var(--color-main))", "--epe-text-color": "rgb(var(--color-content))", "--epe-search-border-color": "rgb(var(--color-border))", "--epe-search-input-bg-color": "rgb(var(--color-main))" }} />
                        </Suspense>
                    </div>
                </div>
            )}

            {/* Previews (Image/Reply/Edit) */}
            <AnimatePresence>
                {imagePreview && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex items-center gap-3 bg-main p-3 rounded-xl mb-3 border border-border-adaptive">
                        <img src={imagePreview} alt="preview" className="w-12 h-12 rounded-sg object-cover" />
                        <div className="flex-1"><p className="text-content text-sm font-medium">{t("chat.imageSelected")}</p><p className="text-muted text-xs">{t("chat.readyToSend")}</p></div>
                        <button onClick={clearImage} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-sg transition"><Trash2 size={18} /></button>
                    </motion.div>
                )}
                {replyTo && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex items-center justify-between bg-main p-3 rounded-xl mb-3 border-s-4 border-primary shadow-sm">
                        <div className="overflow-hidden"><span className="text-primary text-xs font-bold block mb-1">{t("chat.replyingTo")} {replyTo.sender?.username}</span><span className="text-muted text-xs truncate block">{replyTo.text}</span></div>
                        <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-surface rounded-full transition text-muted hover:text-content"><X size={16} /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {editingMessage && (<div className="flex items-center justify-between bg-surface/80 px-4 py-2 border-t border-primary/20 text-xs text-primary mb-2 rounded-t-xl"><span>Editing message...</span><button onClick={cancelEdit} className="text-muted hover:text-content"><X size={14} /></button></div>)}

            {/* Input or Recorder */}
            {(isRecording || audioBlob) ? (
                <div className="flex items-center gap-4 bg-main rounded-full px-4 py-2 border border-border-adaptive shadow-md animate-in slide-in-from-bottom-2">
                    <button onClick={cancelRecording} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition"><Trash2 size={20} /></button>
                    {isRecording ? (
                        <div className="flex-1 flex items-center justify-center gap-3 text-content">
                            <span className="text-red-500 animate-pulse text-[10px] font-bold">REC</span>
                            <span className="font-mono w-12">{formatDuration(recordingDuration)}</span>
                            <div className="flex items-center gap-1 h-6">{[...Array(5)].map((_, i) => (<div key={i} className={`audio-wave-bar ${i === 2 ? 'h-5' : i % 2 === 0 ? 'h-3' : 'h-2'}`}></div>))}</div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center gap-3 bg-surface rounded-full px-2 border border-border-adaptive">
                            <audio ref={audioPreviewRef} src={audioUrl} onLoadedMetadata={() => setPreviewDurationState(audioPreviewRef.current.duration)} onEnded={() => { setIsPlayingPreview(false); setPreviewTime(0); }} hidden />
                            <button onClick={() => { if (isPlayingPreview) audioPreviewRef.current.pause(); else audioPreviewRef.current.play(); setIsPlayingPreview(!isPlayingPreview); }} className="p-2 bg-primary hover:opacity-90 rounded-full text-white transition shadow-sm">{isPlayingPreview ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button>
                            <div className="flex-1 flex flex-col justify-center h-full pt-1">
                                <input dir="ltr" type="range" min="0" max={previewDurationState || 0} step="0.01" value={previewTime} onChange={(e) => { const time = parseFloat(e.target.value); audioPreviewRef.current.currentTime = time; setPreviewTime(time); }} className="w-full h-1 bg-muted/30 rounded-full appearance-none cursor-pointer focus:outline-none transition-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm" style={{ background: `linear-gradient(to right, var(--color-primary) ${(previewTime / (previewDurationState || 1)) * 100}%, var(--color-text-sec) ${(previewTime / (previewDurationState || 1)) * 100}%)` }} />
                                <div className="flex justify-between text-[8px] text-muted font-mono mt-0.5 px-0.5"><span>{formatDuration(previewTime)}</span><span>{formatDuration(previewDurationState)}</span></div>
                            </div>
                        </div>
                    )}
                    {isRecording ? (<button onClick={stopRecording} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition"><StopCircle size={24} /></button>) : (<button onClick={(e) => sendMessageToBackend(e)} className="p-3 bg-primary hover:opacity-90 text-white rounded-full transition shadow-md hover:scale-105"><Send size={20} className="ms-0.5 rtl:rotate-270" /></button>)}
                </div>
            ) : (
                <form onSubmit={(e) => sendMessageToBackend(e)} className="flex items-center gap-2 md:gap-3 max-w-5xl mx-auto">
                    <div className="flex-1 bg-main rounded-3xl flex items-center px-2 py-1.5 border border-border-adaptive focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
                        <button type="button" onClick={() => setShowEmoji(!showEmoji)} className={`p-2 rounded-full transition ${showEmoji ? "text-yellow-500 bg-surface" : "text-muted hover:text-content hover:bg-surface"}`}><Smile size={20} /></button>
                        <input type="text" value={newMessage} onChange={handleInputChange} placeholder={replyTo ? t("chat.placeholderReply") : t("chat.placeholder")} className="w-full flex-1 bg-transparent text-content placeholder-muted px-2 py-2 focus:outline-none border-none min-w-0" />

                        <div className="flex items-center gap-1 pe-1">
                            <button type="button" onClick={() => setShowAttachments(!showAttachments)} className="md:hidden p-2 text-muted hover:text-content rounded-full transition"><Plus size={20} className={`transition-transform duration-300 ${showAttachments ? "rotate-45" : ""}`} /></button>
                            <div className={`${showAttachments ? "flex animate-in slide-in-from-right-5 fade-in duration-300" : "hidden"} md:flex items-center gap-1 absolute md:static bottom-14 md:bottom-auto left-6 md:right-auto bg-surface md:bg-transparent p-2 md:p-0 rounded-full md:rounded-none shadow-xl md:shadow-none border md:border-none border-border-adaptive z-50`}>
                                <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleImageSelect} />
                                <button type="button" onClick={() => { fileInputRef.current.click(); setShowAttachments(false); }} className={`p-2 rounded-full transition ${imagePreview ? "text-primary bg-primary/10" : "text-muted hover:text-content hover:bg-surface"}`}><ImageIcon size={20} /></button>
                                <button type="button" onClick={() => { startRecording(); setShowAttachments(false); }} className="p-2 text-muted hover:text-content hover:bg-surface rounded-full transition"><Mic size={20} /></button>
                                <button type="button" onClick={() => { setShowPollModal(true); setShowAttachments(false); }} className="p-2 text-muted hover:text-content hover:bg-surface rounded-full transition"><BarChart2 size={20} /></button>
                            </div>
                        </div>
                    </div>
                    <button type="submit" disabled={!newMessage.trim() && !imagePreview && !audioBlob} className={`p-3 md:p-3.5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${(newMessage.trim() || imagePreview || audioBlob) ? "bg-primary text-white shadow-lg hover:scale-105 hover:bg-primary/80 hover:shadow-xl cursor-pointer" : "bg-primary/50 text-white/50 cursor-not-allowed"}`}>
                        {editingMessage ? <Check size={20} /> : <Send size={20} strokeWidth={2.5} className="rtl:rotate-270" />}
                    </button>
                </form>
            )}
        </div>
    );
});

export default GroupChat;