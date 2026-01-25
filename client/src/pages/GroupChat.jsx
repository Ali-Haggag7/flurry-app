/**
 * GroupChat Component
 * ------------------------------------------------------------------
 * Handles group messaging functionality including real-time updates,
 * media sharing (images/audio), voice recording, and member interactions.
 * Optimized for performance using memoized callbacks and components.
 */

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";

// Icons
import {
    Send, Image as ImageIcon, Mic, ArrowLeft, MoreVertical,
    X, Reply, Smile, Trash2, StopCircle, Pause, Play, ShieldAlert, Loader2
} from "lucide-react";

// Context & API
import { useSocketContext } from "../context/SocketContext";
import api from "../lib/axios";

// Components
import Loading from "../components/common/Loading";
import ChatInfoSidebar from "../components/chat/ChatInfoSidebar";
import ReactionDetailsModal from "../components/modals/ReactionDetailsModal";
import MessageItem from "../components/chat/MessageItem"; // Optimized Message Component

// Lazy Load Heavy Components
const EmojiPicker = lazy(() => import('emoji-picker-react'));

const GroupChat = () => {
    // --- Hooks & Params ---
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { socket } = useSocketContext();
    const { userId, getToken } = useAuth();
    const { currentUser } = useSelector((state) => state.user);

    // --- State Management ---

    // Core Data
    const [messages, setMessages] = useState([]);
    const [groupInfo, setGroupInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [membershipStatus, setMembershipStatus] = useState("loading"); // 'loading' | 'accepted' | 'pending' | 'none'

    // Interaction States
    const [newMessage, setNewMessage] = useState("");
    const [replyTo, setReplyTo] = useState(null);
    const [highlightedId, setHighlightedId] = useState(null);
    const [showChatInfo, setShowChatInfo] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [typingUser, setTypingUser] = useState(null);
    const [isTyping, setIsTyping] = useState(false); // Local typing state

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

    // --- Optimized Callbacks (Performance Fixes) ---

    // 1. Scroll to specific message
    const scrollToMessage = useCallback((messageId) => {
        const element = messageRefs.current[messageId];
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightedId(messageId);
            setTimeout(() => setHighlightedId(null), 1000);
        } else {
            toast("Message not loaded", { icon: "🔍" });
        }
    }, []);

    // 2. Handle Message Reaction
    const handleReaction = useCallback(async (msgId, emoji) => {
        setActiveReactionId(null); // Close reaction menu

        // Optimistic UI Update
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
                    // Toggle reaction
                    if (newReactions[existingIndex].emoji === emoji) {
                        newReactions.splice(existingIndex, 1);
                    } else {
                        newReactions[existingIndex].emoji = emoji;
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
            // Ideally, revert optimistic update here on error
        }
    }, [currentUser, getToken]);

    // 3. Simple State Setters (Memoized)
    const handleSetReplyTo = useCallback((msg) => setReplyTo(msg), []);
    const handleSetActiveReactionId = useCallback((id) => setActiveReactionId(prev => prev === id ? null : id), []);
    const handleSetViewReactionMessage = useCallback((msg) => setViewReactionMessage(msg), []);

    // 4. Calculate Read Status
    const getReadStatus = useCallback((msg) => {
        if (!groupInfo || !groupInfo.members) return "delivered";

        const totalMembers = groupInfo.members.length;
        const targetAudienceCount = totalMembers > 1 ? totalMembers - 1 : 0; // Exclude sender

        const readBy = msg.readBy || [];
        const senderId = msg.sender?._id?.toString() || msg.sender?.toString();

        const uniqueReaders = new Set(readBy.map(id => id.toString()));
        if (senderId) uniqueReaders.delete(senderId);

        return uniqueReaders.size >= targetAudienceCount ? "read" : "delivered";
    }, [groupInfo, currentUser]);

    // --- Data Fetching ---
    useEffect(() => {
        const fetchGroupData = async () => {
            try {
                const token = await getToken();
                // 1. Fetch Group Details
                const groupRes = await api.get(`/group/${groupId}`, { headers: { Authorization: `Bearer ${token}` } });
                const groupData = groupRes.data.group;
                setGroupInfo(groupData);

                // 2. Validate Membership
                const myMemberRecord = groupData.members.find(m => m.user._id === currentUser._id || m.user === currentUser._id);

                if (!myMemberRecord) {
                    setMembershipStatus("none");
                    toast.error("You are not a member of this group");
                    navigate("/group/discovery");
                    return;
                } else if (myMemberRecord.status === "pending") {
                    setMembershipStatus("pending");
                } else {
                    setMembershipStatus("accepted");

                    // 3. Load Messages & Mark Read
                    const msgRes = await api.get(`/group/messages/${groupId}`, { headers: { Authorization: `Bearer ${token}` } });
                    setMessages(msgRes.data.messages || []);
                    try {
                        await api.put(`/group/read/${groupId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                    } catch (e) { console.error("Read status update failed"); }
                }
            } catch (err) {
                console.error("Error fetching group:", err);
                navigate("/group/discovery");
            } finally {
                setLoading(false);
            }
        };

        if (groupId && userId && currentUser) fetchGroupData();
    }, [groupId, userId, getToken, currentUser, navigate]);

    // --- Socket Event Listeners ---
    useEffect(() => {
        if (!socket) return;

        socket.emit("joinGroup", groupId);

        const handleNewMessage = async (msg) => {
            const isCurrentGroup = (msg.group === groupId || msg.groupId === groupId);
            const isMe = String(msg.sender?._id) === String(currentUser?._id) || String(msg.sender?.clerkId) === String(userId);

            if (isCurrentGroup && !isMe) {
                // Prevent duplicates & Scroll
                setMessages((prev) => {
                    if (prev.some(m => m._id === msg._id)) return prev;
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                    return [...prev, msg];
                });

                // Mark as read immediately
                try {
                    const token = await getToken();
                    await api.put(`/group/read/${groupId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                } catch (error) { console.error("Failed to mark incoming message as read:", error); }
            }
        };

        const handleSocketReaction = ({ messageId, reactions }) => {
            setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, reactions } : msg));
        };

        const handleReadStatusUpdate = ({ groupId: gId, userId: uId }) => {
            if (gId === groupId) {
                setMessages(prev => prev.map(msg => {
                    const isRead = msg.readBy?.includes(uId);
                    if (!isRead) return { ...msg, readBy: [...(msg.readBy || []), uId] };
                    return msg;
                }));
            }
        };

        // Socket Event Bindings
        socket.on("receiveGroupMessage", handleNewMessage);
        socket.on("groupMessageReaction", handleSocketReaction);
        socket.on("groupMessagesRead", handleReadStatusUpdate);

        socket.on("typingGroup", (data) => setTypingUser(data));
        socket.on("stop typingGroup", () => setTypingUser(null));

        return () => {
            socket.off("receiveGroupMessage", handleNewMessage);
            socket.off("groupMessageReaction", handleSocketReaction);
            socket.off("groupMessagesRead", handleReadStatusUpdate);
            socket.off("typingGroup");
            socket.off("stop typingGroup");
        };
    }, [socket, groupId, userId, currentUser, getToken]);

    // --- UI Effects ---

    // Auto Scroll on new messages
    useEffect(() => {
        if (messages.length > 0 && messagesEndRef.current) {
            const behavior = isFirstLoad.current ? "auto" : "smooth";
            messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
            isFirstLoad.current = false;
        }
    }, [messages, imagePreview, audioUrl, replyTo]);

    // Audio Preview Animation
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

    // --- Helper Functions ---

    const formatDuration = (sec) => {
        if (!sec || isNaN(sec)) return "0:00";
        const min = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${min}:${s < 10 ? "0" : ""}${s}`;
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleEmojiClick = (emojiObject) => {
        setNewMessage((prev) => prev + emojiObject.emoji);
    };

    const handleInputChange = (e) => {
        setNewMessage(e.target.value);
        if (!socket || !groupInfo?._id) return;

        if (!isTyping) {
            setIsTyping(true);
            socket.emit("typingGroup", {
                groupId: groupInfo._id,
                username: currentUser.full_name.split(" ")[0],
                image: currentUser.profile_picture || currentUser.image || "/avatar-placeholder.png"
            });
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            socket.emit("stop typingGroup", groupInfo._id);
        }, 3000);
    };

    // --- Audio Recorder Logic ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "audio/webm" });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
            };
            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingDuration(0);
            timerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
        } catch (err) {
            console.error("Microphone Access Error:", err);
            toast.error("Microphone access denied 🚫");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    };

    const cancelRecording = () => {
        setAudioBlob(null);
        setAudioUrl(null);
        setIsRecording(false);
        setRecordingDuration(0);
        clearInterval(timerRef.current);
        if (mediaRecorder) mediaRecorder.stream.getTracks().forEach(track => track.stop());
    };

    // --- Send Message ---
    const sendMessageToBackend = async (e) => {
        if (e) e.preventDefault();

        // Stop typing indicator immediately
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        setIsTyping(false);
        if (socket && groupInfo?._id) socket.emit("stop typingGroup", groupInfo._id);

        if (!newMessage.trim() && !selectedImage && !audioBlob) return;

        // Optimistic Update
        const tempId = Date.now();
        const tempMessage = {
            _id: tempId,
            text: newMessage,
            sender: { clerkId: userId, _id: currentUser._id },
            message_type: selectedImage ? "image" : audioBlob ? "audio" : "text",
            media_url: selectedImage ? imagePreview : audioBlob ? audioUrl : "",
            replyTo: replyTo,
            readBy: [currentUser._id],
            createdAt: new Date().toISOString(),
            isSending: true
        };

        setMessages((prev) => [...prev, tempMessage]);

        // Reset UI
        setNewMessage("");
        setReplyTo(null);
        clearImage();
        setShowEmoji(false);
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingDuration(0);

        try {
            const token = await getToken();
            const formData = new FormData();
            formData.append("groupId", groupId);
            if (tempMessage.text) formData.append("text", tempMessage.text);
            if (replyTo) formData.append("replyTo", replyTo._id);
            if (selectedImage) formData.append("file", selectedImage);
            if (audioBlob) {
                const audioFile = new File([audioBlob], "voice-message.webm", { type: "audio/webm" });
                formData.append("file", audioFile);
            }

            const res = await api.post(`/group/send`, formData, {
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
            });

            // Replace temp message with server response
            setMessages((prev) => prev.map((msg) => msg._id === tempId ? res.data.data : msg));
        } catch (error) {
            console.error("Send Error:", error);
            toast.error("Failed to send message");
            setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
        }
    };

    // --- Render Logic ---

    if (loading) return <Loading />;

    if (membershipStatus === "pending") {
        return (
            <div className="flex h-screen items-center justify-center bg-main flex-col gap-4">
                <ShieldAlert size={60} className="text-yellow-500" />
                <h2 className="text-2xl font-bold text-content">Membership Pending</h2>
                <p className="text-muted">Wait for the admin to accept your request.</p>
                <button onClick={() => navigate("/group/discovery")} className="px-6 py-2 bg-primary text-white rounded-full transition hover:bg-primary/90">Go Back</button>
            </div>
        );
    }

    if (membershipStatus === "none") return null;

    return (
        <div className="flex flex-row h-screen scrollbar-hide overflow-hidden">
            <div className="flex flex-col flex-1 h-screen bg-main text-content relative overflow-hidden">

                {/* 🟢 Header */}
                <div className="absolute top-0 left-0 right-0 h-20 bg-surface/90 backdrop-blur-md flex items-center justify-between px-4 z-20 border-b border-black/5 dark:border-white/5 shadow-sm transition-colors duration-300">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-main rounded-full transition text-muted hover:text-content">
                            <ArrowLeft size={22} />
                        </button>

                        <div className="relative">
                            <img
                                src={groupInfo?.group_image}
                                alt="group"
                                className="w-11 h-11 rounded-full object-cover ring-2 ring-black/10 dark:ring-white/10"
                            />
                        </div>

                        <div>
                            <h3 className="font-bold text-content text-lg leading-tight">{groupInfo?.name}</h3>
                            <p className="text-xs text-muted font-medium">{groupInfo?.members?.length} members active</p>
                        </div>
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); setShowChatInfo(true); }}
                        className={`p-2 rounded-full transition ${showChatInfo ? "bg-primary text-white" : "hover:bg-main text-muted hover:text-content"}`}
                    >
                        <MoreVertical size={22} />
                    </button>
                </div>

                {/* 💬 Chat Messages Area */}
                <div className="flex-1 overflow-y-auto px-4 pt-24 pb-4 space-y-6 scrollbar-hide bg-main relative">

                    {messages.map((msg, idx) => (
                        <div key={msg._id || idx} ref={(el) => (messageRefs.current[msg._id] = el)}>
                            {/* Optimized Message Component */}
                            <MessageItem
                                msg={msg}
                                userId={String(currentUser?._id)}
                                activeReactionId={activeReactionId}
                                setActiveReactionId={handleSetActiveReactionId}
                                handleReaction={handleReaction}
                                setReplyTo={handleSetReplyTo}
                                setViewReactionMessage={handleSetViewReactionMessage}
                                scrollToMessage={scrollToMessage}
                                highlightedId={highlightedId}
                                readStatus={getReadStatus(msg)}
                            />
                        </div>
                    ))}

                    {/* Typing Indicator */}
                    {typingUser && (
                        <div className="flex items-end gap-3 px-3 py-2 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
                            <div className="relative shrink-0">
                                <div className="relative w-10 h-10 rounded-full ring-2 ring-black/10 dark:ring-white/10 shadow-sm overflow-hidden">
                                    <div className="w-full h-full rounded-full bg-surface flex items-center justify-center">
                                        <img
                                            src={typingUser?.image || "/avatar-placeholder.png"}
                                            alt={typingUser?.username || "User"}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.target.src = "/avatar-placeholder.png"; }}
                                        />
                                    </div>
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-main rounded-full animate-pulse shadow-sm"></div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="bg-surface/80 backdrop-blur-md border border-primary/20 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm w-fit transition-all hover:shadow-md">
                                    <div className="flex items-center gap-1.5 h-2">
                                        <span className="w-2 h-2 bg-primary/80 rounded-full animate-[bounce_1s_infinite_100ms]"></span>
                                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-[bounce_1s_infinite_200ms]"></span>
                                        <span className="w-2 h-2 bg-primary/40 rounded-full animate-[bounce_1s_infinite_300ms]"></span>
                                    </div>
                                </div>
                                <span className="text-[10px] font-medium text-muted/80 ml-1 animate-pulse tracking-wide">
                                    <span className="text-primary font-bold">{typingUser?.username}</span> is typing...
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* ⌨️ Input Area */}
                <div className="bg-surface p-2 md:p-4 border-t border-black/5 dark:border-white/5 shrink-0 z-30">

                    {/* Emoji Picker Modal */}
                    {showEmoji && (
                        <div
                            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                            onClick={() => setShowEmoji(false)}
                        >
                            <div
                                className="relative bg-surface rounded-2xl shadow-2xl border border-adaptive animate-in zoom-in-95 duration-200"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => setShowEmoji(false)}
                                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-md z-50 transition-transform hover:scale-110"
                                >
                                    <X size={16} strokeWidth={3} />
                                </button>

                                <Suspense fallback={
                                    <div className="w-[350px] h-[450px] flex items-center justify-center">
                                        <div className="flex items-center gap-2 text-content/50">
                                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            <span>Loading...</span>
                                        </div>
                                    </div>
                                }>
                                    <EmojiPicker
                                        onEmojiClick={handleEmojiClick}
                                        theme="dark"
                                        lazyLoadEmojis={true}
                                        searchDisabled={false}
                                        skinTonesDisabled={true}
                                        previewConfig={{ showPreview: false }}
                                        width={350}
                                        height={450}
                                        style={{
                                            "--epr-bg-color": "rgb(var(--color-surface))",
                                            "--epr-category-label-bg-color": "rgb(var(--color-main))",
                                            "--epr-text-color": "rgb(var(--color-content))",
                                            "--epr-search-border-color": "rgb(var(--color-border))",
                                            "--epr-search-input-bg-color": "rgb(var(--color-main))",
                                            "--epr-hover-bg-color": "rgba(var(--color-primary), 0.2)",
                                            "--epr-focus-bg-color": "rgba(var(--color-primary), 0.4)",
                                            "--epr-horizontal-padding": "10px",
                                            "--epr-picker-border-radius": "16px",
                                            border: "none"
                                        }}
                                    />
                                </Suspense>
                            </div>
                        </div>
                    )}

                    {/* Image Preview */}
                    {imagePreview && (
                        <div className="flex items-center gap-3 bg-main p-3 rounded-xl mb-3 border border-adaptive animate-slide-up">
                            <img src={imagePreview} alt="preview" className="w-12 h-12 rounded-lg object-cover" />
                            <div className="flex-1">
                                <p className="text-content text-sm font-medium">Image selected</p>
                                <p className="text-muted text-xs">Ready to send</p>
                            </div>
                            <button onClick={clearImage} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}

                    {/* Reply Preview */}
                    {replyTo && (
                        <div className="flex items-center justify-between bg-main p-3 rounded-xl mb-3 border-l-4 border-primary animate-slide-up shadow-sm">
                            <div className="overflow-hidden">
                                <span className="text-primary text-xs font-bold block mb-1">Replying to {replyTo.sender?.username}</span>
                                <span className="text-muted text-xs truncate block">{replyTo.text}</span>
                            </div>
                            <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-surface rounded-full transition text-muted hover:text-content">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Input & Recorder Controls */}
                    {(isRecording || audioBlob) ? (
                        <div className="flex items-center gap-4 bg-main rounded-full px-4 py-2 border border-adaptive shadow-md animate-slide-up">
                            <button onClick={cancelRecording} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition">
                                <Trash2 size={20} />
                            </button>

                            {isRecording ? (
                                <div className="flex-1 flex items-center justify-center gap-3 text-content">
                                    <span className="text-red-500 animate-pulse text-[10px] font-bold">REC</span>
                                    <span className="font-mono w-12">{formatDuration(recordingDuration)}</span>
                                    <div className="flex items-center gap-1 h-6">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className={`audio-wave-bar ${i === 2 ? 'h-5' : i % 2 === 0 ? 'h-3' : 'h-2'}`}></div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center gap-3 bg-surface rounded-full px-2 border border-black/5 dark:border-white/5">
                                    <audio ref={audioPreviewRef} src={audioUrl} onLoadedMetadata={() => setPreviewDurationState(audioPreviewRef.current.duration)} onEnded={() => { setIsPlayingPreview(false); setPreviewTime(0); }} hidden />
                                    <button onClick={() => { if (isPlayingPreview) audioPreviewRef.current.pause(); else audioPreviewRef.current.play(); setIsPlayingPreview(!isPlayingPreview); }} className="p-2 bg-primary hover:opacity-90 rounded-full text-white transition shadow-sm">
                                        {isPlayingPreview ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                                    </button>
                                    <div className="flex-1 flex flex-col justify-center h-full pt-1">
                                        <input type="range" min="0" max={previewDurationState || 0} step="0.01" value={previewTime} onChange={(e) => { const time = parseFloat(e.target.value); audioPreviewRef.current.currentTime = time; setPreviewTime(time); }} className="w-full h-1 bg-muted/30 rounded-lg appearance-none cursor-pointer accent-primary" style={{ background: `linear-gradient(to right, var(--color-primary) ${(previewTime / previewDurationState) * 100}%, var(--color-text-sec) ${(previewTime / previewDurationState) * 100}%)` }} />
                                        <div className="flex justify-between text-[8px] text-muted font-mono mt-0.5 px-0.5">
                                            <span>{formatDuration(previewTime)}</span>
                                            <span>{formatDuration(previewDurationState)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isRecording ? (
                                <button onClick={stopRecording} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition">
                                    <StopCircle size={24} />
                                </button>
                            ) : (
                                <button onClick={(e) => sendMessageToBackend(e)} className="p-3 bg-primary hover:opacity-90 text-white rounded-full transition shadow-md hover:scale-105">
                                    <Send size={20} className="ml-0.5" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={(e) => sendMessageToBackend(e)} className="flex items-center gap-2 md:gap-3 max-w-5xl mx-auto">
                            <div className="flex-1 bg-main rounded-full flex items-center px-2 py-1.5 border border-adaptive focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
                                <button type="button" onClick={() => setShowEmoji(!showEmoji)} className={`p-2 rounded-full transition ${showEmoji ? "text-yellow-500 bg-surface" : "text-muted hover:text-content hover:bg-surface"}`}>
                                    <Smile size={20} />
                                </button>

                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={handleInputChange}
                                    placeholder={replyTo ? "Type your reply..." : "Type a message..."}
                                    className="w-full flex-1 bg-transparent text-content placeholder-muted px-2 py-2 focus:outline-none border-none"
                                />

                                <div className="flex items-center gap-1 pr-1">
                                    <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleImageSelect} />
                                    <button type="button" onClick={() => fileInputRef.current.click()} className={`p-2 rounded-full transition ${selectedImage ? "text-primary bg-primary/10" : "text-muted hover:text-content hover:bg-surface"}`}>
                                        <ImageIcon size={20} />
                                    </button>

                                    <button type="button" onClick={startRecording} className="p-2 text-muted hover:text-content hover:bg-surface rounded-full transition">
                                        <Mic size={20} />
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!newMessage.trim() && !selectedImage && !audioBlob}
                                className={`p-3 md:p-3.5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
                                ${(newMessage.trim() || selectedImage || audioBlob)
                                        ? "bg-primary text-white shadow-lg hover:scale-105 hover:bg-primary/80 hover:shadow-xl cursor-pointer"
                                        : "bg-primary/50 text-white/50 cursor-not-allowed"
                                    }`}
                            >
                                <Send size={20} strokeWidth={2.5} />
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Reaction Modal */}
            <ReactionDetailsModal
                isOpen={!!viewReactionMessage}
                onClose={() => setViewReactionMessage(null)}
                message={viewReactionMessage}
            />

            {/* Side Info Panel */}
            <ChatInfoSidebar
                data={groupInfo}
                isGroup={true}
                isOpen={showChatInfo}
                onClose={() => setShowChatInfo(false)}
                messages={messages}
            />
        </div>
    );
};

export default GroupChat;