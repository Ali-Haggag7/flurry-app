/**
 * @fileoverview Messages Slice - Manages chat conversations and active chat state.
 * Handles fetching recent conversations, retrieving specific chat histories, 
 * and managing real-time message updates.
 * * @version 1.1.0
 * @author Senior Frontend Architect
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

// --- Initial State ---

const initialState = {
    conversations: [], // List of recent chat participants
    activeChatMessages: {
        messages: [], // Message history for the currently selected user
        isLoading: false,
        error: null,
    },
    status: "idle", // Global status for conversations list
    error: null,
};

// --- Async Thunks (API Communications) ---

/**
 * Fetches the list of recent conversations/chats for the user.
 */
export const fetchConversations = createAsyncThunk(
    "messages/fetchConversations",
    async (token, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.get("/message/recent", {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data.conversations;
        } catch (error) {
            const message = error.response?.data?.message || "Failed to load chats";
            return rejectWithValue(message);
        }
    }
);

/**
 * Fetches all messages between the current user and a specific userId.
 */
export const fetchChatMessages = createAsyncThunk(
    "messages/fetchChatMessages",
    async ({ userId, token }, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.get(`/message/chat/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data.data;
        } catch (error) {
            const message = error.response?.data?.message || "Failed to load messages";
            return rejectWithValue(message);
        }
    }
);

/**
 * Sends a message (supports text and files via FormData).
 * Implementation uses internal toast for immediate feedback.
 */
export const sendMessage = createAsyncThunk(
    "messages/sendMessage",
    async ({ formData, token }, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.post("/message/send", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            return response.data.data;
        } catch (error) {
            const message = error.response?.data?.message || "Failed to send message";
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// --- Slice Definition ---

const messagesSlice = createSlice({
    name: "messages",
    initialState,
    reducers: {
        /**
         * Injects a message received via WebSockets into the active chat state.
         */
        addRealtimeMessage: (state, action) => {
            state.activeChatMessages.messages.push(action.payload);
        },
        /**
         * Resets the active chat state when navigating away or closing a chat.
         */
        clearActiveChat: (state) => {
            state.activeChatMessages.messages = [];
            state.activeChatMessages.isLoading = false;
            state.activeChatMessages.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // --- Fetch Conversations Cases ---
            .addCase(fetchConversations.pending, (state) => {
                state.status = "loading";
            })
            .addCase(fetchConversations.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.conversations = action.payload;
            })
            .addCase(fetchConversations.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            })

            // --- Fetch Chat Messages Cases ---
            .addCase(fetchChatMessages.pending, (state) => {
                state.activeChatMessages.isLoading = true;
                state.activeChatMessages.error = null;
            })
            .addCase(fetchChatMessages.fulfilled, (state, action) => {
                state.activeChatMessages.isLoading = false;
                state.activeChatMessages.messages = action.payload;
            })
            .addCase(fetchChatMessages.rejected, (state, action) => {
                state.activeChatMessages.isLoading = false;
                state.activeChatMessages.error = action.payload;
            })

            // --- Send Message Cases ---
            .addCase(sendMessage.fulfilled, (state, action) => {
                // Optimistically update the UI with the newly returned message
                state.activeChatMessages.messages.push(action.payload);
            });
    },
});

export const { addRealtimeMessage, clearActiveChat } = messagesSlice.actions;
export default messagesSlice.reducer;