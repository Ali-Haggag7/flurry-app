import { useRef, useState, useEffect } from "react";
import { ImageIcon, SendHorizontal, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

// === بيانات تجريبية موحّدة: استخدم _id everywhere ===
const currentUser = {
    _id: "1",
    username: "user1",
    full_name: "User 1",
    profile_picture: "https://i.pravatar.cc/40?img=1",
};

const user = {
    _id: "2",
    username: "friend",
    full_name: "Friend Name",
    profile_picture: "https://i.pravatar.cc/40?img=2",
};

// connections array يجب أن يحتوي _id كي يعمل البحث بشكل صحيح
const connections = [user];

// رسائل ابتدائية — تأكد من ISO date صالح
const initialMessages = [
    { id: "m1", from_user_id: "1", text: "Hello", message_type: "text", createdAt: "2025-11-02T04:19:00Z" },
    { id: "m2", from_user_id: "2", text: "Hi", message_type: "text", createdAt: "2025-11-02T04:20:00Z" },
    { id: "m3", from_user_id: "2", text: "How are you?", message_type: "text", createdAt: "2025-11-02T04:21:00Z" },
];

const Chat = () => {
    // unified names
    const [newMessage, setNewMessage] = useState("");
    const [localMessages, setLocalMessages] = useState(initialMessages);
    const messageEndRef = useRef(null);

    // image File object for attaching images
    const [image, setImage] = useState(null);

    // blocking flag (demo)
    const isBlockedByUser = false;

    // scroll to bottom whenever messages change
    useEffect(() => {
        setTimeout(() => {
            messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
    }, [localMessages]);

    // handle file input change
    const handleImageChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setImage(file);
    };

    // send message (text or image)
    const sendMessage = () => {
        if (!newMessage.trim() && !image) return; // nothing to send

        const msg = {
            id: Date.now().toString(),
            from_user_id: currentUser._id,
            text: newMessage.trim() || (image ? "Image" : ""),
            message_type: image ? "image" : "text",
            // if image -> we simulate a local preview URL for now
            media_url: image ? URL.createObjectURL(image) : undefined,
            createdAt: new Date().toISOString(),
        };

        setLocalMessages((prev) => [...prev, msg]);
        setNewMessage("");
        // if you uploaded a file to server, revokeObjectURL after you get final URL. here it's local preview.
        setImage(null);
    };

    // keyboard send
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // helper: sorted messages ascending by createdAt
    const sortedMessages = [...localMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return (
        <div className="flex flex-col h-screen bg-linear-to-br from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f]
            text-white overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center gap-3 p-3 md:px-25 bg-white/5 backdrop-blur-lg border-b border-purple-500/30 
                shadow-[0_0_15px_rgba(131,58,180,0.3)] z-10">
                <img src={user.profile_picture || ""}
                    className="w-12 h-12 rounded-full border border-purple-300 shadow-[0_0_10px_rgba(255,0,255,0.5)]"
                    alt={user.full_name} />
                <div>
                    <p className="font-bold text-purple-200">{user.full_name}</p>
                    <p className="text-sm text-gray-400">@{user.username}</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 md:px-10 overflow-y-auto scrollbar-hide relative">
                {isBlockedByUser ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, type: "spring" }}
                            className="bg-linear-to-br from-purple-600/50 via-pink-600/40 to-indigo-500/40 backdrop-blur-xl p-10 
                                rounded-3xl shadow-2xl border border-purple-400/50">
                            <p className="text-2xl font-bold text-white mb-4">This user has blocked you 🚫</p>
                            <p className="text-purple-200 text-lg">Unfortunately, you can't message them right now.</p>
                        </motion.div>
                    </div>
                ) : (
                    <div className="space-y-4 max-w-full mx-auto">
                        {sortedMessages.map((message, index) => {
                            const isCurrentUser = message.from_user_id === currentUser._id;
                            // find sender only if not current user
                            const sender = !isCurrentUser ? connections.find((c) => c._id === message.from_user_id) : null;

                            return (
                                <motion.div
                                    key={message.id + "_" + index}
                                    initial={{ opacity: 0, x: isCurrentUser ? 100 : -100 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                    className={`flex items-start gap-2 ${isCurrentUser ? "justify-end" : "justify-start ml-0 md:ml-16"}`}
                                >
                                    {/* Sender avatar (left) */}
                                    {!isCurrentUser && sender && (
                                        <div className="flex flex-col items-center">
                                            <img src={sender.profile_picture} className="w-8 h-8 rounded-full border border-purple-500 
                                                shadow-[0_0_10px_rgba(255,0,255,0.5)]" alt={sender.full_name} />
                                        </div>
                                    )}

                                    {/* message bubble */}
                                    <div className={`p-3 text-sm max-w-sm rounded-xl shadow-lg 
                                            ${isCurrentUser ? "bg-linear-to-br from-indigo-500 to-purple-600 text-white rounded-br-none"
                                            : "bg-white/10 backdrop-blur-lg rounded-bl-none border border-purple-500/30"} transition-all duration-300`}>
                                        {message.message_type === "image" && message.media_url && (
                                            <img src={message.media_url} alt="attachment"
                                                className="w-full max-w-sm rounded-xl mb-2 shadow-[0_0_10px_rgba(255,0,255,0.5)] object-cover" />
                                        )}
                                        <p>{message.text}</p>
                                    </div>

                                    {/* current user avatar (right) */}
                                    {isCurrentUser && (
                                        <div className="flex flex-col items-center">
                                            <img src={currentUser.profile_picture || ""} className="w-8 h-8 rounded-full border border-indigo-400 
                                                shadow-[0_0_10px_rgba(255,0,255,0.5)]" alt={currentUser.full_name} />
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}

                        <div ref={messageEndRef} />
                    </div>
                )}
            </div>

            {/* Input area */}
            {!isBlockedByUser && (
                <div className="px-4 pb-4">
                    <div className="flex items-center gap-3 px-5 py-2 bg-white/10 backdrop-blur-lg border border-purple-500/30 
                        shadow-[0_0_15px_rgba(131,58,188,0.4)] rounded-full max-w-4xl mx-auto">
                        <input
                            type="text"
                            placeholder="Type a message..."
                            onKeyDown={handleKeyDown}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            className="bg-transparent outline-none flex-1 text-white placeholder-gray-400"
                        />

                        {/* hidden file input for image */}
                        <input id="chat-image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />

                        <label htmlFor="chat-image" className="cursor-pointer">
                            {image ? (
                                <img src={URL.createObjectURL(image)} alt="preview" className="w-8 h-8 rounded-xl border border-purple-400 
                                    shadow-[0_0_10px_rgba(255,0,255,0.5)] object-cover" />
                            ) : (
                                <ImageIcon className="w-7 h-7 text-gray-300/90 hover:text-white cursor-pointer" />
                            )}
                        </label>

                        <button onClick={sendMessage} className="bg-linear-to-br from-indigo-500 to-purple-600 
                            hover:from-indigo-700 hover:to-purple-800 active:scale-95 cursor-pointer text-white p-2 rounded-full
                            shadow-[0_0_15px_rgba(255,0,255,0.6)] hover:shadow-[0_0_25px_rgba(255,0,255,0.8)] transition-all">
                            <SendHorizontal size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;
