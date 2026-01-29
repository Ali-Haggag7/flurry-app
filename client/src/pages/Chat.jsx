import React, { lazy, Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";

// --- Third Party Libraries ---
import {
    Send, Image as ImageIcon, Mic, Loader2, MoreVertical, Smile,
    Trash2, StopCircle, Pause, Play, ArrowLeft, X
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNowStrict } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";

// --- Local Imports ---
import api from "../lib/axios";
import { useSocketContext } from "../context/SocketContext";
import { fetchMyConnections } from "../features/connectionsSlice";
import UserAvatar from "../components/common/UserDefaultAvatar";
import ChatInfoSidebar from "../components/chat/ChatInfoSidebar";
import MessageItem from "../components/chat/MessageItem";
import ReactionDetailsModal from "../components/modals/ReactionDetailsModal";

// --- Lazy Loads ---
const EmojiPicker = lazy(() => import('emoji-picker-react'));

/**
 * Chat Component
 * --------------
 * Handles real-time messaging, media recording, and interaction logic.
 *
 * Optimizations:
 * - Memoized handlers (useCallback) to prevent child re-renders.
 * - Auto-cleanup for ObjectURLs (Memory Management).
 * - Framer Motion for layout shifts.
 */
const Chat = () => {
    // --- Global State & Hooks ---
    const { id: targetUserId } = useParams();
    const navigate = useNavigate();
    const { getToken, userId } = useAuth();
    const { socket, onlineUsers } = useSocketContext();
    const dispatch = useDispatch();

    const { currentUser } = useSelector((state) => state.user);
    const { connections } = useSelector((state) => state.connections || { connections: [] });
    const connectionUser = connections?.find(c => (c._id || c) === targetUserId);

    // --- Local State ---
    const [messages, setMessages] = useState([]);
    const [targetUser, setTargetUser] = useState(connectionUser || null);
    const [newMessage, setNewMessage] = useState("");
    const [replyTo, setReplyTo] = useState(null);
    const [highlightedId, setHighlightedId] = useState(null);
    const [activeReactionId, setActiveReactionId] = useState(null);
    const [viewReactionMessage, setViewReactionMessage] = useState(null);

    // --- UI State ---
    const [showEmoji, setShowEmoji] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [showChatInfo, setShowChatInfo] = useState(false);
    const [typing, setTyping] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [activeMobileActionId, setActiveMobileActionId] = useState(null);

    // --- Audio State ---
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const [previewTime, setPreviewTime] = useState(0);
    const [previewDuration, setPreviewDuration] = useState(0);

    // --- Refs ---
    const messagesEndRef = useRef(null);
    const messageRefs = useRef({});
    const fileInputRef = useRef(null);
    const timerRef = useRef(null);
    const audioPreviewRef = useRef(null);
    const isFirstLoad = useRef(true);
    const typingTimeoutRef = useRef(null);
    const prevMessagesLength = useRef(0);

    // ========================================================
    // 🧠 Handlers (Memoized)
    // ========================================================

    const scrollToMessage = useCallback((messageId) => {
        const element = messageRefs.current[messageId];
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightedId(messageId);
            setTimeout(() => setHighlightedId(null), 1000);
        } else {
            toast("Message not loaded here", { icon: "🔍" });
        }
    }, []);

    const handleMessagesClear = useCallback(() => {
        setMessages([]);
        setShowChatInfo(false);
    }, []);

    const handleImageSelect = useCallback((e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            // Memory Management: Create URL
            const url = URL.createObjectURL(file);
            setImagePreview(url);
        }
    }, []);

    // Memory Cleanup: Revoke URLs when component unmounts or image changes
    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);

    const handleReaction = useCallback(async (msgId, emoji) => {
        setActiveReactionId(null);
        // Optimistic Update
        setMessages(prev => prev.map(msg => {
            if (msg._id === msgId) {
                const userObj = {
                    _id: currentUser._id,
                    full_name: currentUser.full_name,
                    username: currentUser.username,
                    profile_picture: currentUser.profile_picture || currentUser.image
                };
                const existingIndex = msg.reactions?.findIndex(r => r.user?._id === currentUser._id || r.user === currentUser._id);
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
            await api.post("/message/react", { messageId: msgId, emoji }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
            console.error("Reaction failed");
            toast.error("Failed to add reaction");
        }
    }, [currentUser, getToken]);

    // Helpers
    const handleSetReplyTo = useCallback((msg) => setReplyTo(msg), []);
    const handleSetViewReactionMessage = useCallback((msg) => setViewReactionMessage(msg), []);
    const handleSetActiveReactionId = useCallback((id) => setActiveReactionId(prev => prev === id ? null : id), []);

    const handleInputChange = useCallback((e) => {
        setNewMessage(e.target.value);

        if (!socket || !targetUser?._id) return;

        if (!typing) {
            setTyping(true);
            socket.emit("typing", targetUser._id);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
            socket.emit("stop typing", targetUser._id);
        }, 3000);
    }, [socket, targetUser, typing]);

    // ========================================================
    // 🔄 Effects & Data Fetching
    // ========================================================

    useEffect(() => {
        if (!targetUserId) return;
        const loadData = async () => {
            const token = await getToken();
            dispatch(fetchMyConnections(token));

            if (!targetUser) {
                try {
                    const { data } = await api.get(`/user/${targetUserId}`, { headers: { Authorization: `Bearer ${token}` } });
                    if (data.success) setTargetUser(data.user);
                    else navigate(-1);
                } catch (error) { console.error("Error fetching user:", error); }
            }

            try {
                const msgRes = await api.get(`/message/${targetUserId}`, { headers: { Authorization: `Bearer ${token}` } });
                setMessages(msgRes.data.data || []);
                await api.put(`/message/read/${targetUserId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            } catch (error) { console.error("Error loading chat:", error); }
        };
        loadData();
    }, [targetUserId, getToken, dispatch, targetUser, navigate]);

    // Socket Listeners
    useEffect(() => {
        if (!socket) return;
        const handleReceiveMessage = async (incomingMsg) => {
            const senderId = incomingMsg.sender._id || incomingMsg.sender;
            if (senderId.toString() === targetUserId.toString()) {
                setMessages((prev) => [...prev, { ...incomingMsg, read: true }]);
                const token = await getToken();
                await api.put(`/message/read/${targetUserId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 100);
            }
        };

        const handleMessagesSeen = ({ byUserId }) => {
            if (byUserId.toString() === targetUserId.toString()) {
                setMessages((prev) => prev.map(msg => ({ ...msg, read: true })));
            }
        };

        const handleMessageReaction = ({ messageId, reactions }) => {
            setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, reactions } : msg));
        };

        socket.on("receiveMessage", handleReceiveMessage);
        socket.on("messagesSeen", handleMessagesSeen);
        socket.on("messageReaction", handleMessageReaction);

        return () => {
            socket.off("receiveMessage", handleReceiveMessage);
            socket.off("messagesSeen", handleMessagesSeen);
            socket.off("messageReaction", handleMessageReaction);
        };
    }, [socket, targetUserId, getToken]);

    // Typing Listeners
    useEffect(() => {
        if (!socket) return;
        const onTyping = () => setIsTyping(true);
        const onStopTyping = () => setIsTyping(false);

        socket.on("typing", onTyping);
        socket.on("stop typing", onStopTyping);

        return () => {
            socket.off("typing", onTyping);
            socket.off("stop typing", onStopTyping);
        };
    }, [socket]);

    // Scroll Logic
    useEffect(() => {
        // 1. لو الصفحة لسه بتحمل لأول مرة -> انزل تحت خالص
        if (isFirstLoad.current && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
            isFirstLoad.current = false;
            prevMessagesLength.current = messages.length;
            return;
        }

        // 2. السحر هنا: هل عدد الرسايل زاد؟ (يعني رسالة جديدة جات)
        if (messages.length > prevMessagesLength.current) {
            // يبقى انزل تحت
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }
        // لو العدد ثابت (زي حالة الرياكشن) -> الكود مش هيدخل هنا وهيفضل ثابت مكانه 😎

        // 3. تحديث العداد للمرة الجاية
        prevMessagesLength.current = messages.length;
    }, [messages, imagePreview, audioUrl, replyTo, isTyping, messagesEndRef]);

    // Audio Animation Frame
    useEffect(() => {
        let animationFrame;
        const animatePreview = () => {
            if (audioPreviewRef.current) {
                setPreviewTime(audioPreviewRef.current.currentTime);
                if (!audioPreviewRef.current.paused && !audioPreviewRef.current.ended) {
                    animationFrame = requestAnimationFrame(animatePreview);
                }
            }
        };
        if (isPlayingPreview) animationFrame = requestAnimationFrame(animatePreview);
        else cancelAnimationFrame(animationFrame);
        return () => cancelAnimationFrame(animationFrame);
    }, [isPlayingPreview]);

    // ========================================================
    // 🎙️ Audio & Media Logic
    // ========================================================

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "audio/webm" });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
            };
            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingDuration(0);
            timerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
        } catch (err) { toast.error("Microphone access denied 🚫"); }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }, [mediaRecorder]);

    const cancelRecording = useCallback(() => {
        setAudioBlob(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setIsRecording(false);
        setRecordingDuration(0);
        setPreviewTime(0);
        setIsPlayingPreview(false);
        clearInterval(timerRef.current);
        if (mediaRecorder) mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }, [mediaRecorder, audioUrl]);

    // Format helpers
    const formatDuration = (sec) => {
        const min = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${min}:${s < 10 ? "0" : ""}${s}`;
    };

    const getPostIdFromText = (text) => {
        // 🛡️ خط الدفاع الأول: لو مفيش نص أو النوع مش سترينج، اخلع فوراً
        if (!text || typeof text !== "string") return null;
        console.log(text);

        // كمل شغلك عادي وأنت مطمن
        const match = text.match(/post\/([a-fA-F0-9]{24})/);
        return match ? match[1] : null;
    };

    const handleEmojiClick = useCallback((emojiObject) => {
        setNewMessage((prev) => prev + emojiObject.emoji);
    }, []);

    // ========================================================
    // 📤 Send Logic
    // ========================================================

    const sendMessage = useCallback(async (e) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() && !selectedImage && !audioBlob) return;
        if (!targetUser || !currentUser) return;

        if (currentUser?.blockedUsers?.includes(targetUser._id) || targetUser.blockedUsers?.includes(currentUser._id)) {
            toast.error("Cannot send message (Blocked) 🚫");
            return;
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        setTyping(false);
        if (socket && targetUser?._id) socket.emit("stop typing", targetUser._id);

        const detectedSharedPostId = getPostIdFromText(newMessage);
        let msgType = "text";
        if (selectedImage) msgType = "image";
        else if (audioBlob) msgType = "audio";
        else if (detectedSharedPostId) msgType = "shared_post";

        const tempId = Date.now();
        const tempMessage = {
            _id: tempId,
            text: newMessage,
            sender: { _id: currentUser._id || userId, profile_picture: currentUser.profile_picture || currentUser.image },
            message_type: msgType,
            media_url: selectedImage ? imagePreview : audioBlob ? audioUrl : "",
            sharedPostId: detectedSharedPostId,
            replyTo: replyTo,
            createdAt: new Date().toISOString(),
            isSending: true,
            read: false
        };

        setMessages((prev) => [...prev, tempMessage]);
        setNewMessage("");
        setSelectedImage(null);
        setImagePreview(null);
        cancelRecording();
        setShowEmoji(false);
        setReplyTo(null);

        try {
            const token = await getToken();
            const formData = new FormData();
            formData.append("receiverId", targetUserId);
            if (tempMessage.text) formData.append("text", tempMessage.text);
            if (detectedSharedPostId) formData.append("sharedPostId", detectedSharedPostId);
            if (replyTo) formData.append("replyTo", replyTo._id);
            if (selectedImage) formData.append("image", selectedImage);
            else if (audioBlob) {
                const audioFile = new File([audioBlob], "voice-note.webm", { type: "audio/webm" });
                formData.append("image", audioFile);
            }

            const { data } = await api.post("/message/send", formData, { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) {
                setMessages((prev) => prev.map(msg => msg._id === tempId ? data.data : msg));
            }
        } catch (error) {
            console.error("Send Error:", error);
            toast.error("Failed to send message");
            setMessages((prev) => prev.filter(msg => msg._id !== tempId));
        }
    }, [newMessage, selectedImage, audioBlob, targetUser, currentUser, replyTo, targetUserId, userId, imagePreview, audioUrl, socket, getToken, cancelRecording]);

    // ========================================================
    // 🎨 UI Helpers
    // ========================================================

    if (!targetUser) return (
        <div className="flex h-screen items-center justify-center bg-main sm:ml-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
    );

    // --- Online Status Logic ---
    const isBlockedByMe = currentUser?.blockedUsers?.includes(targetUserId);
    const isBlockedByThem = targetUser?.blockedUsers?.includes(currentUser?._id);
    const isChatDisabled = isBlockedByMe || isBlockedByThem; // Any block disables chat

    // Check if connected (adjust condition based on your connection logic)
    const isConnected = connections?.some(c => (c._id || c) === targetUserId);

    // Determine online status
    const isOnline = onlineUsers?.includes(targetUser?._id);

    const getStatusContent = () => {
        // ⛔️ 1. الأولوية القصوى: لو فيه بلوك (من أي طرف)
        // اخرج فوراً واعرض "User unavailable" أو رجع null لو مش عاوز تكتب حاجة خالص
        if (isChatDisabled) {
            return <span className="text-muted text-xs">User unavailable</span>;
        }

        // 👻 2. لو اليوزر مفعل وضع الشبح (خافي ظهوره)
        if (targetUser?.hideOnlineStatus) return null;

        // 🟢 3. لو اليوزر أونلاين ومفيش موانع
        if (isOnline) {
            return <span className="flex items-center gap-1.5 text-green-500 text-xs font-bold animate-pulse">Online</span>;
        }

        // 🕒 4. حساب وقت آخر ظهور (الكود مش هيوصل هنا أبداً لو فيه بلوك)
        const lastSeenText = targetUser?.lastSeen
            ? `Last seen ${formatDistanceToNowStrict(new Date(targetUser.lastSeen), { addSuffix: true })}`
            : "Offline";

        return <span className="text-muted text-xs">{lastSeenText}</span>;
    };

    // ========================================================
    // 🖥️ Render
    // ========================================================

    return (
        <div className="flex flex-row h-screen scrollbar-hide overflow-hidden">
            <div className="flex flex-col flex-1 h-screen bg-main text-content relative overflow-hidden transition-colors duration-300">

                {/* --- Header --- */}
                <div className="absolute top-0 left-0 right-0 h-20 bg-surface/80 backdrop-blur-lg flex items-center justify-between px-4 z-20 border-b border-adaptive shadow-sm transition-all">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${targetUserId}`)}>
                        <button onClick={(e) => { e.stopPropagation(); navigate(-1); }} className="p-2 hover:bg-main rounded-full transition text-muted hover:text-primary md:hidden">
                            <ArrowLeft size={22} />
                        </button>
                        <div className="relative">
                            <UserAvatar user={targetUser} className="w-11 h-11 rounded-full object-cover ring-2 ring-transparent group-hover:ring-primary transition-all" />
                            {!isChatDisabled && isOnline && <span className="absolute bottom-1.5 right-0 z-10 w-3 h-3 bg-green-500 border-2 border-surface rounded-full"></span>}
                        </div>
                        <div>
                            <h3 className="font-bold text-content text-lg leading-tight">{targetUser.full_name}</h3>
                            {getStatusContent()}
                        </div>
                    </div>
                    <button onClick={() => setShowChatInfo(true)} className="p-2.5 rounded-full hover:bg-main text-muted hover:text-primary transition">
                        <MoreVertical size={20} />
                    </button>
                </div>

                {/* --- Chat Area --- */}
                <div
                    className="flex-1 overflow-y-auto px-4 pt-24 pb-4 space-y-6 scrollbar-hide bg-main relative">

                    {activeMobileActionId && (
                        <div
                            className="fixed inset-0 z-40"
                            onTouchStart={(e) => {
                                e.stopPropagation();
                                setActiveMobileActionId(null);
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveMobileActionId(null);
                            }}
                        />
                    )}

                    {messages.map((msg, index) => (
                        <div key={msg._id || index} ref={(el) => (messageRefs.current[msg._id] = el)}>
                            <MessageItem
                                msg={msg}
                                userId={currentUser?._id || userId}
                                setReplyTo={handleSetReplyTo}
                                setActiveReactionId={handleSetActiveReactionId}
                                activeReactionId={activeReactionId}
                                handleReaction={handleReaction}
                                setViewReactionMessage={handleSetViewReactionMessage}
                                scrollToMessage={scrollToMessage}
                                highlightedId={highlightedId}
                                readStatus={msg.read ? "read" : msg.delivered ? "delivered" : "sent"}
                            />
                        </div>
                    ))}

                    {/* Typing Indicator */}
                    <AnimatePresence>
                        {isTyping && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="flex items-end gap-2 p-2"
                            >
                                <div className="w-8 h-8 rounded-full bg-surface border border-adaptive flex items-center justify-center shadow-sm">
                                    <UserAvatar user={targetUser} className="w-8 h-8 rounded-full object-cover" />
                                </div>
                                <div className="bg-surface border border-adaptive rounded-2xl rounded-bl-none p-3 px-4 shadow-sm w-fit">
                                    <div className="flex items-center gap-1.5 h-5">
                                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>

                {/* --- Input Area --- */}
                <div className="bg-surface p-2 md:p-3 border-t border-adaptive shrink-0 z-30 transition-all relative">

                    {/* Reply Preview */}
                    <AnimatePresence>
                        {replyTo && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="flex items-center justify-between bg-main p-3 rounded-t-xl border-b border-adaptive mb-2">
                                    <div className="overflow-hidden border-l-4 border-primary pl-2">
                                        <span className="text-primary text-xs font-bold block mb-1">Replying to {replyTo.sender?.full_name || "User"}</span>
                                        <span className="text-muted text-xs truncate block">{replyTo.message_type === 'image' ? '📷 Photo' : replyTo.message_type === 'audio' ? '🎤 Voice Message' : replyTo.text}</span>
                                    </div>
                                    <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-surface rounded-full transition text-muted hover:text-content">
                                        <X size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Image Preview */}
                    <AnimatePresence>
                        {imagePreview && (
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="flex items-center gap-3 bg-main p-3 rounded-xl mb-3 border border-adaptive shadow-sm"
                            >
                                <img src={imagePreview} alt="preview" className="w-12 h-12 rounded-lg object-cover" />
                                <div className="flex-1">
                                    <p className="text-content text-sm font-medium">Image selected</p>
                                    <p className="text-muted text-xs">Ready to send</p>
                                </div>
                                <button onClick={() => { setSelectedImage(null); setImagePreview(null); }} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition">
                                    <Trash2 size={18} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Input Controls */}
                    {isChatDisabled ? (
                        <div className="flex flex-col items-center justify-center py-6 space-y-3 bg-surface/50 backdrop-blur-sm">
                            {isBlockedByMe ? <div className="text-center"><h3 className="text-content font-bold">You blocked this user</h3></div> : <div className="text-center opacity-80"><h3 className="text-muted font-semibold">Conversation Closed</h3></div>}
                        </div>
                    ) : !isConnected ? (
                        <div className="flex flex-col items-center justify-center py-4 space-y-2 bg-surface/50 backdrop-blur-sm">
                            <h3 className="text-content font-bold text-sm">You are not connected</h3>
                            <button onClick={() => navigate(`/profile/${targetUserId}`)} className="px-5 py-1.5 bg-primary text-white rounded-full text-xs font-bold hover:bg-primary/90 transition">Go to Profile</button>
                        </div>
                    ) : (
                        <>
                            {showEmoji && (
                                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowEmoji(false)}>
                                    <div className="relative bg-surface rounded-2xl shadow-2xl border border-adaptive" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => setShowEmoji(false)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-md z-50 transition-transform hover:scale-110">
                                            <X size={16} strokeWidth={3} />
                                        </button>
                                        <Suspense fallback={<div className="w-[350px] h-[450px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
                                            <EmojiPicker
                                                onEmojiClick={handleEmojiClick}
                                                theme="dark"
                                                lazyLoadEmojis={true}
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
                                                    "--epr-picker-border-radius": "16px",
                                                    border: "none"
                                                }}
                                            />
                                        </Suspense>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={sendMessage} className="flex items-center gap-2 md:gap-3 max-w-5xl mx-auto w-full">
                                <div className="flex-1 bg-main rounded-3xl border border-adaptive focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300 shadow-sm relative overflow-hidden min-h-[50px] flex items-center">
                                    {isRecording ? (
                                        <div className="w-full h-full flex items-center px-4 bg-red-500/5 animate-pulse text-red-500 justify-between">
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full animate-ping" /><span className="font-mono font-bold">{formatDuration(recordingDuration)}</span></div>
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={cancelRecording} className="p-2 hover:bg-red-100 rounded-full text-muted hover:text-red-500 transition"><Trash2 size={20} /></button>
                                                <button type="button" onClick={stopRecording} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"><StopCircle size={20} /></button>
                                            </div>
                                        </div>
                                    ) : audioBlob ? (
                                        <div className="w-full h-full flex items-center px-3 justify-between gap-3">
                                            <button type="button" onClick={() => { if (audioPreviewRef.current) { if (isPlayingPreview) audioPreviewRef.current.pause(); else audioPreviewRef.current.play(); setIsPlayingPreview(!isPlayingPreview); } }} className="w-9 h-9 flex items-center justify-center bg-primary text-white rounded-full hover:scale-105 transition shrink-0 shadow-sm">
                                                {isPlayingPreview ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                                            </button>
                                            <div className="flex-1 flex items-center h-full">
                                                <input type="range" min="0" max={previewDuration || 0} step="any" value={previewTime} onChange={(e) => { const t = parseFloat(e.target.value); audioPreviewRef.current.currentTime = t; setPreviewTime(t); }} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none border-none bg-transparent" style={{ background: `linear-gradient(to right, var(--color-primary) ${(previewTime / (previewDuration || 1)) * 100}%, var(--color-border) ${(previewTime / (previewDuration || 1)) * 100}%)` }} />
                                            </div>
                                            <button type="button" onClick={cancelRecording} className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition shrink-0"><Trash2 size={20} /></button>
                                            <audio ref={audioPreviewRef} src={audioUrl} onLoadedMetadata={(e) => setPreviewDuration(e.target.duration)} onEnded={() => { setIsPlayingPreview(false); setPreviewTime(0); }} onTimeUpdate={(e) => setPreviewTime(e.target.currentTime)} hidden />
                                        </div>
                                    ) : (
                                        <div className="w-full flex items-center px-1.5">
                                            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-muted hover:text-primary transition-colors hover:bg-surface rounded-full shrink-0"><Smile size={22} /></button>
                                            <input
                                                type="text"
                                                value={newMessage}
                                                onChange={handleInputChange}
                                                placeholder={replyTo ? "Type your reply..." : "Type a message..."}
                                                className="w-full bg-transparent text-content px-2 py-2 focus:outline-none min-w-0 placeholder-muted/70"
                                            />
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleImageSelect} />
                                                <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 text-muted hover:text-primary transition-colors hover:bg-surface rounded-full"><ImageIcon size={22} /></button>
                                                <button type="button" onClick={startRecording} className="p-2 text-muted hover:text-primary transition-colors hover:bg-surface rounded-full"><Mic size={22} /></button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button type="submit" disabled={!newMessage.trim() && !selectedImage && !audioBlob} className={`p-3.5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 shadow-md ${(newMessage.trim() || selectedImage || audioBlob) ? "bg-primary text-white hover:scale-105 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 cursor-pointer" : "bg-surface text-muted border border-adaptive cursor-not-allowed"}`}>
                                    <Send size={20} strokeWidth={2.5} className={newMessage.trim() ? "ml-0.5" : ""} />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            <ReactionDetailsModal
                isOpen={!!viewReactionMessage}
                onClose={() => setViewReactionMessage(null)}
                message={viewReactionMessage}
            />

            <ChatInfoSidebar
                data={targetUser}
                isGroup={false}
                isOpen={showChatInfo}
                onClose={() => setShowChatInfo(false)}
                messages={messages}
                onMessagesClear={handleMessagesClear}
            />
        </div>
    );
};

export default Chat;