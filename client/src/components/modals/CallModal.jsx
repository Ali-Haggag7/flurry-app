import React, { useEffect, useState, useRef, memo } from 'react';
import { useCall } from '../../context/CallContext';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Sub-Components ---

/**
 * CallTimer Component
 * Tracks and displays the duration of the call.
 */
const CallTimer = memo(({ startTime }) => {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setSeconds(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const format = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <span className="text-white/80 font-mono text-sm tracking-wider bg-black/20 px-2 py-0.5 rounded-md backdrop-blur-sm">
            {format(seconds)}
        </span>
    );
});

/**
 * AudioPlaceholder Component
 * Displayed when video is disabled or call is audio-only.
 */
const AudioPlaceholder = memo(({ displayName, callAccepted }) => (
    <div className="w-full h-full flex flex-col items-center pt-32 bg-surface">
        <div className="relative z-10 mb-8">
            <div className={`absolute inset-0 bg-primary/30 rounded-full blur-2xl ${callAccepted ? 'animate-pulse' : ''}`}></div>
            <div className="w-32 h-32 rounded-full bg-main border-4 border-adaptive flex items-center justify-center relative shadow-2xl">
                <User size={64} className="text-muted" />
            </div>
        </div>
        <h2 className="text-content font-bold text-2xl px-4">{displayName}</h2>
    </div>
));

/**
 * ControlButton Component
 * Reusable button for call controls.
 */
const ControlButton = memo(({ onClick, isActive, IconOn, IconOff, variant = "normal" }) => {
    const baseClass = "rounded-full transition-all flex items-center justify-center shadow-lg";

    const variants = {
        normal: `p-4 border border-adaptive ${isActive ? "bg-white/10 text-white border-white/20" : "bg-white text-black hover:bg-gray-100"}`,
        danger: "w-20 h-20 bg-red-500 border-4 border-surface text-white hover:bg-red-600",
        pickup: "w-16 h-16 bg-green-500 text-white hover:bg-green-600 animate-bounce",
        hangup: "w-16 h-16 bg-red-500 text-white hover:bg-red-600"
    };

    return (
        <button onClick={onClick} className={`${baseClass} ${variants[variant]}`}>
            {variant === 'normal' ? (
                isActive ? <IconOn size={24} /> : <IconOff size={24} />
            ) : (
                <IconOn size={variant === 'danger' ? 36 : 28} className="fill-current" />
            )}
        </button>
    );
});

// --- Main Component ---

/**
 * CallModal Component
 * Main modal for handling Video/Audio calls using WebRTC.
 */
const CallModal = () => {
    const {
        call, callAccepted, callEnded, isCalling, stream, myVideo, userVideo,
        answerCall, leaveCall, toggleVideo, toggleAudio, isVideoEnabled, isAudioEnabled, name
    } = useCall();

    const [isClient, setIsClient] = useState(false);
    const [callStartTime, setCallStartTime] = useState(null);
    const callStartTimeRef = useRef(callStartTime);

    // --- Effects ---

    useEffect(() => {
        setIsClient(true);
        if (callAccepted && !callStartTimeRef.current) {
            callStartTimeRef.current = Date.now();
        }
    }, [callAccepted]);

    useEffect(() => {
        if (myVideo.current && stream) {
            myVideo.current.srcObject = stream;
        }
    }, [stream, callAccepted, isVideoEnabled, myVideo]);

    // --- Derived State ---

    if (!isClient) return null;

    const displayName = (call.isReceivingCall ? call.name : name) || "Unknown User";

    // Logic to determine if UI should show Audio placeholder initially
    const isInitiallyAudioOnly = (call.isReceivingCall && call.isVideoCall === false) || (!call.isReceivingCall && isCalling && !isVideoEnabled && !stream?.getVideoTracks().length);

    const showModal = (call.isReceivingCall && !callAccepted) || isCalling || callAccepted;

    if (!showModal) {
        callStartTimeRef.current = null;
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            >
                <div className="relative w-full h-full md:w-[400px] md:h-[680px] bg-surface md:rounded-[45px] overflow-hidden flex flex-col shadow-2xl border border-adaptive">

                    {/* 1. Main Stream (Remote User) */}
                    <div className="absolute inset-0 z-0 bg-black">
                        <video
                            playsInline
                            ref={userVideo}
                            autoPlay
                            className={`w-full h-full object-cover ${(callAccepted && !isInitiallyAudioOnly) ? 'block' : 'hidden'}`}
                        />

                        {/* Audio Placeholder */}
                        {(isInitiallyAudioOnly || !callAccepted) && (
                            <AudioPlaceholder displayName={displayName} callAccepted={callAccepted} />
                        )}
                    </div>

                    {/* 2. Header (Name & Timer) */}
                    <div className="absolute top-0 left-0 right-0 p-8 pt-12 z-20 text-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                        <h2 className="text-white font-bold text-xl truncate drop-shadow-md">{displayName}</h2>
                        <div className="mt-2">
                            {callAccepted && callStartTimeRef.current ? (
                                <CallTimer startTime={callStartTimeRef.current} />
                            ) : (
                                <span className="text-white/70 text-sm animate-pulse font-medium">
                                    {isCalling ? "Calling..." : "Incoming Call..."}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 3. Local Stream (Self Video - Draggable) */}
                    {!isInitiallyAudioOnly && stream && (
                        <motion.div
                            drag
                            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                            className="absolute top-28 right-6 w-28 h-40 bg-surface rounded-2xl overflow-hidden shadow-2xl border border-adaptive z-50 cursor-grab active:cursor-grabbing"
                        >
                            <video
                                playsInline
                                muted
                                ref={myVideo}
                                autoPlay
                                className={`w-full h-full object-cover mirror-mode ${isVideoEnabled ? 'block' : 'hidden'}`}
                            />
                            {!isVideoEnabled && (
                                <div className="w-full h-full flex items-center justify-center bg-main">
                                    <VideoOff size={24} className="text-muted" />
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* 4. Controls */}
                    <div className="absolute bottom-0 left-0 right-0 pb-12 pt-24 px-6 z-30 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center">
                        {call.isReceivingCall && !callAccepted ? (
                            <div className="flex w-full justify-around items-center">
                                <ControlButton onClick={leaveCall} IconOn={PhoneOff} variant="hangup" />
                                <ControlButton onClick={answerCall} IconOn={Phone} variant="pickup" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-6">
                                <ControlButton
                                    onClick={toggleAudio}
                                    isActive={isAudioEnabled}
                                    IconOn={Mic}
                                    IconOff={MicOff}
                                />

                                <ControlButton
                                    onClick={leaveCall}
                                    IconOn={PhoneOff}
                                    variant="danger"
                                />

                                {!isInitiallyAudioOnly && (
                                    <ControlButton
                                        onClick={toggleVideo}
                                        isActive={isVideoEnabled}
                                        IconOn={Video}
                                        IconOff={VideoOff}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CallModal;