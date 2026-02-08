/**
 * CallContext Provider
 * ------------------------------------------------------------------
 * Architect: Senior Frontend Architect
 * Purpose: Manages WebRTC peer connections, media streams, and socket signaling.
 * * Optimizations:
 * - Memoized Context Value to prevent consumer re-renders.
 * - robust media stream cleanup (Nuclear Cleanup).
 * - Ref-based stream tracking for stale closure prevention.
 */

import React, { createContext, useState, useRef, useEffect, useContext, useCallback, useMemo } from 'react';
import SimplePeer from 'simple-peer';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

// Context & Hooks
import { useSocketContext } from './SocketContext';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
    const { socket } = useSocketContext();
    const { userId } = useAuth();

    // --- State Management ---
    const [call, setCall] = useState({});
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [stream, setStream] = useState(null);
    const [name, setName] = useState('');
    const [isCalling, setIsCalling] = useState(false);
    const [callTarget, setCallTarget] = useState(null);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);

    // --- Refs (Mutable Data) ---
    const myVideo = useRef();
    const userVideo = useRef();
    const connectionRef = useRef();
    const streamRef = useRef(null); // Stable reference for media tracks

    // --- Helper: Nuclear Cleanup ---
    // Resets all WebRTC connections and stops media tracks immediately.
    const endCallCleanup = useCallback(() => {
        // 1. Stop all tracks from the Ref (Source of Truth)
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            streamRef.current = null;
        }

        // 2. Clear Video Element
        if (myVideo.current) {
            myVideo.current.srcObject = null;
        }

        // 3. Destroy Peer Connection
        if (connectionRef.current) {
            connectionRef.current.destroy();
            connectionRef.current = null;
        }

        // 4. Reset State
        setCall({});
        setCallAccepted(false);
        setCallEnded(false);
        setStream(null);
        setIsCalling(false);
        setCallTarget(null);
        setIsVideoEnabled(true);
        setIsAudioEnabled(true);
        setName('');
    }, []);

    // --- Socket Listeners ---
    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = ({ from, name: callerName, signal, isVideoCall }) => {
            console.log("🔔 Incoming call from:", callerName);
            setCall({ isReceivingCall: true, from, name: callerName, signal, isVideoCall });
        };

        const handleCallAccepted = (signal) => {
            setCallAccepted(true);
            connectionRef.current?.signal(signal);
        };

        const handleCallEnded = () => {
            endCallCleanup();
            toast.success("Call ended");
        };

        socket.on('callUser', handleIncomingCall);
        socket.on('callAccepted', handleCallAccepted);
        socket.on('callEnded', handleCallEnded);

        return () => {
            socket.off('callUser', handleIncomingCall);
            socket.off('callAccepted', handleCallAccepted);
            socket.off('callEnded', handleCallEnded);
        };
    }, [socket, endCallCleanup]);

    // --- Media Handlers ---
    const startStream = useCallback(async (video = true, audio = true) => {
        try {
            const currentStream = await navigator.mediaDevices.getUserMedia({ video, audio });

            // Sync State and Ref
            setStream(currentStream);
            streamRef.current = currentStream;

            if (myVideo.current) {
                myVideo.current.srcObject = currentStream;
            }
            return currentStream;
        } catch (error) {
            console.error("Failed to get stream:", error);
            toast.error("Camera/Mic permission denied");
            return null;
        }
    }, []);

    const toggleVideo = useCallback(() => {
        const activeStream = streamRef.current || stream;
        if (activeStream?.getVideoTracks().length > 0) {
            const videoTrack = activeStream.getVideoTracks()[0];
            videoTrack.enabled = !isVideoEnabled;
            setIsVideoEnabled((prev) => !prev);
        } else {
            toast.error("No video track found");
        }
    }, [stream, isVideoEnabled]);

    const toggleAudio = useCallback(() => {
        const activeStream = streamRef.current || stream;
        if (activeStream?.getAudioTracks().length > 0) {
            const audioTrack = activeStream.getAudioTracks()[0];
            audioTrack.enabled = !isAudioEnabled;
            setIsAudioEnabled((prev) => !prev);
        } else {
            toast.error("No audio track found");
        }
    }, [stream, isAudioEnabled]);

    // --- Signaling Handlers ---

    const callUser = useCallback(async (idToCall, targetName, myName, isVideoCall = true) => {
        setIsCalling(true);
        setName(targetName);
        setCallTarget(idToCall);
        setIsVideoEnabled(isVideoCall);

        const currentStream = await startStream(isVideoCall, true);
        if (!currentStream) {
            setIsCalling(false);
            return;
        }

        const peer = new SimplePeer({
            initiator: true,
            trickle: false,
            stream: currentStream,
        });

        peer.on('signal', (data) => {
            socket.emit('callUser', {
                userToCall: idToCall,
                signalData: data,
                from: socket.id,
                name: myName,
                isVideoCall
            });
        });

        peer.on('stream', (remoteStream) => {
            if (userVideo.current) userVideo.current.srcObject = remoteStream;
        });

        peer.on('error', (err) => {
            console.error("Peer Error:", err);
            toast.error("Connection failed");
            endCallCleanup();
        });

        connectionRef.current = peer;
    }, [socket, startStream, endCallCleanup]);

    const answerCall = useCallback(async () => {
        setCallAccepted(true);
        const shouldEnableVideo = call.isVideoCall !== false;
        setIsVideoEnabled(shouldEnableVideo);

        const currentStream = await startStream(shouldEnableVideo, true);
        if (!currentStream) return;

        const peer = new SimplePeer({
            initiator: false,
            trickle: false,
            stream: currentStream,
        });

        peer.on('signal', (data) => {
            socket.emit('answerCall', { signal: data, to: call.from });
        });

        peer.on('stream', (remoteStream) => {
            if (userVideo.current) userVideo.current.srcObject = remoteStream;
        });

        peer.on('error', (err) => {
            console.error("Peer Error:", err);
            toast.error("Connection failed");
            endCallCleanup();
        });

        peer.signal(call.signal);
        connectionRef.current = peer;
    }, [call, socket, startStream, endCallCleanup]);

    const leaveCall = useCallback(() => {
        setCallEnded(true);
        const targetId = call.from || callTarget;
        if (targetId && socket) {
            socket.emit("endCall", { id: targetId });
        }
        endCallCleanup();
    }, [call, callTarget, socket, endCallCleanup]);

    // --- Context Value Memoization ---
    const contextValue = useMemo(() => ({
        call,
        callAccepted,
        myVideo,
        userVideo,
        stream,
        name,
        setName,
        callEnded,
        isCalling,
        isVideoEnabled,
        isAudioEnabled,
        callUser,
        leaveCall,
        answerCall,
        toggleVideo,
        toggleAudio
    }), [
        call, callAccepted, stream, name, callEnded, isCalling,
        isVideoEnabled, isAudioEnabled, callUser, leaveCall,
        answerCall, toggleVideo, toggleAudio
    ]);

    return (
        <CallContext.Provider value={contextValue}>
            {children}
        </CallContext.Provider>
    );
};