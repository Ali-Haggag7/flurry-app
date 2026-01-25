/**
 * @file useAudioRecorder.ts
 * @description Custom hook to manage audio recording, blob creation, and file preview generation.
 * Handles microphone permissions, stream cleanup, and memory management.
 * @module Hooks
 */

import { useState, useRef, useCallback, useEffect } from "react";

const useAudioRecorder = () => {
    // --- State ---
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null); // The raw file for backend
    const [audioUrl, setAudioUrl] = useState(null);   // The preview URL

    // --- Refs ---
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    // --- Effects ---

    /**
     * Memory Management:
     * Revoke the Object URL when the component unmounts or when the audioUrl changes
     * to prevent memory leaks in the browser.
     */
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    /**
     * Safety Cleanup:
     * Ensure microphone stream is stopped if the component unmounts while recording.
     */
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    // --- Handlers ---

    /**
     * 1. Start Recording
     * Requests permission and initializes the MediaRecorder.
     */
    const startRecording = useCallback(async () => {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = []; // Reset previous data

            // Collect audio chunks
            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            // Handle stop event
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                const url = URL.createObjectURL(blob);

                setAudioBlob(blob);
                setAudioUrl(url);

                // Stop all tracks to turn off the browser's "Recording" indicator (Red Dot)
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);

        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Please allow microphone access to record voice notes.");
        }
    }, []);

    /**
     * 2. Stop Recording
     */
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    /**
     * 3. Clear Recording
     * Resets state and explicitly revokes the current URL to free memory.
     */
    const clearRecording = useCallback(() => {
        setAudioBlob(null);
        setAudioUrl(null);
        setIsRecording(false);
    }, []);

    return {
        isRecording,
        audioBlob,
        audioUrl,
        startRecording,
        stopRecording,
        clearRecording
    };
};

export default useAudioRecorder;