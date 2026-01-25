/**
 * @fileoverview Socket Context Provider - Manages real-time WebSocket connections.
 * Handles socket lifecycle, online user tracking with privacy filtering, 
 * and incoming message notification sounds.
 * * @version 1.1.0
 * @author Senior Frontend Architect
 */

import { createContext, useState, useEffect, useContext, useMemo } from "react";
import { useSelector } from "react-redux";
import io from "socket.io-client";

const SocketContext = createContext();

/**
 * Custom hook to access the Socket context.
 * @returns {{ socket: Socket|null, onlineUsers: string[] }}
 */
export const useSocketContext = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error("useSocketContext must be used within a SocketContextProvider");
    }
    return context;
};

export const SocketContextProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);

    // --- Selectors ---
    const { currentUser } = useSelector((state) => state.user);

    // --- Effects: Socket Lifecycle ---

    useEffect(() => {
        let newSocket = null;

        if (currentUser && currentUser._id) {
            // Initialize connection
            newSocket = io("http://localhost:4000", {
                query: {
                    userId: currentUser._id,
                },
            });

            setSocket(newSocket);

            // Listen for online users list
            newSocket.on("getOnlineUsers", (users) => {
                setOnlineUsers(users);
            });

            // Cleanup on unmount or user change
            return () => {
                newSocket.close();
                setSocket(null);
            };
        } else {
            // Close existing socket if user logs out
            if (socket) {
                socket.close();
                setSocket(null);
            }
        }
    }, [currentUser?._id]);

    // --- Effects: Notifications & Sound ---

    useEffect(() => {
        if (!socket) return;

        /**
         * Handles incoming messages to trigger notification sounds based on user preferences.
         */
        const handleIncomingNotification = (newMessage) => {
            if (!currentUser) return;

            const senderId = newMessage.sender._id || newMessage.sender;

            // Privacy & Notification Logic
            const isMuted = currentUser.mutedUsers?.includes(senderId);
            const isBlocked = currentUser.blockedUsers?.includes(senderId);
            const isMe = senderId === currentUser._id;

            // Execute sound if message is not muted, blocked, or sent by current user
            if (!isMuted && !isBlocked && !isMe) {
                try {
                    const sound = new Audio("/notification.mp3");
                    const playPromise = sound.play();

                    if (playPromise !== undefined) {
                        playPromise.catch((err) => {
                            // Browser typically prevents audio until user interaction
                            console.warn("Audio playback delayed or prevented:", err);
                        });
                    }
                } catch (error) {
                    console.error("Critical error playing notification sound:", error);
                }
            } else {
                console.log(`Silent notification (Muted/Blocked/Me): ${senderId} 🤫`);
            }
        };

        socket.on("receiveMessage", handleIncomingNotification);

        return () => {
            socket.off("receiveMessage", handleIncomingNotification);
        };
    }, [socket, currentUser]);

    // --- Calculations: Privacy Filtering ---

    /**
     * Filters the global online users list to hide users that the current user has blocked.
     * Optimized with useMemo to prevent unnecessary re-renders of consumers.
     */
    const visibleOnlineUsers = useMemo(() => {
        if (!currentUser) return [];

        let filtered = onlineUsers;
        const blockedList = currentUser.blockedUsers || [];

        // Ensure all IDs are strings for reliable comparison
        const safeBlockedList = blockedList.map((u) => (u._id ? u._id : u));

        if (safeBlockedList.length > 0) {
            filtered = filtered.filter((id) => !safeBlockedList.includes(id));
        }

        return filtered;
    }, [onlineUsers, currentUser?.blockedUsers]);

    // --- Context Value Memoization ---

    const contextValue = useMemo(
        () => ({
            socket,
            onlineUsers: visibleOnlineUsers,
        }),
        [socket, visibleOnlineUsers]
    );

    return (
        <SocketContext.Provider value={contextValue}>
            {children}
        </SocketContext.Provider>
    );
};