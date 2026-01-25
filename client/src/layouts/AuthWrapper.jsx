import { useEffect, useState, useRef } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useUser, useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";

// --- Local Imports ---
import { syncUser } from "../features/userSlice";
import { addRealtimeMessage } from "../features/messagesSlice";
import { useSocketContext } from "../context/SocketContext";
import Loading from "../components/common/Loading";

/**
 * AuthWrapper Component
 *
 * Acts as a layout guard that:
 * 1. Ensures the Clerk user is authenticated and data is loaded.
 * 2. Syncs the Clerk user data with the backend database via Redux.
 * 3. Establishes global Socket.io listeners for real-time notifications/messages.
 *
 * @returns {JSX.Element} The rendered Outlet or a Loading spinner.
 */
const AuthWrapper = () => {
    // --- Hooks & Context ---
    const dispatch = useDispatch();
    const location = useLocation();
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const { socket } = useSocketContext();

    // --- Refs & State ---
    // Using ref to access current path inside socket callbacks without re-binding listeners
    const pathnameRef = useRef(location.pathname);
    const [isSynced, setIsSynced] = useState(false);

    // --- Redux Selectors ---
    const { currentUser } = useSelector((state) => state.user);

    // --- Effects ---

    // 1. Keep pathnameRef updated (Crucial for socket logic)
    useEffect(() => {
        pathnameRef.current = location.pathname;
    }, [location.pathname]);

    // 2. User Synchronization Logic
    useEffect(() => {
        if (isSynced) return;

        const runSync = async () => {
            if (isLoaded && user && !isSynced) {
                try {
                    const token = await getToken();
                    const userData = {
                        id: user.id,
                        email: user.emailAddresses[0]?.emailAddress,
                        username: user.username,
                        firstName: user.firstName,
                        lastName: user.lastName,
                    };

                    await dispatch(syncUser({ userData, token })).unwrap();
                    setIsSynced(true);
                } catch (error) {
                    console.error("Sync failed:", error);
                    // Mark as synced to prevent infinite retry loops on client side errors
                    setIsSynced(true);
                }
            }
        };

        if (isLoaded && user) {
            runSync();
        }
    }, [isLoaded, user, getToken, dispatch, isSynced]);

    // 3. Real-time Message Listener
    useEffect(() => {
        // Guard clause: Ensure dependencies exist before attaching listeners
        if (!socket || !isSynced || !currentUser) return;

        const handleNewMessage = (newMessage) => {
            // Check if user is currently viewing the chat with the sender
            // Using ref ensures we don't need to add location.pathname to dependency array
            const isChattingWithSender = pathnameRef.current === `/messages/${newMessage.sender._id}`;

            if (isChattingWithSender) {
                // If chat is open, update Redux store immediately
                dispatch(addRealtimeMessage(newMessage));
            } else {
                // If on another page, show a notification
                toast.success(`New message from ${newMessage.sender.full_name}`, {
                    icon: "💬",
                    duration: 4000,
                    className: "bg-surface text-content border border-adaptive",
                });

                // Optional: Play notification sound here
            }
        };

        // Attach Listener
        socket.on("receiveMessage", handleNewMessage);

        // Cleanup Listener
        return () => {
            socket.off("receiveMessage", handleNewMessage);
        };
    }, [socket, isSynced, currentUser, dispatch]);

    // --- Render ---

    if (!isLoaded || !user || !isSynced) {
        return <Loading />;
    }

    return <Outlet />;
};

export default AuthWrapper;