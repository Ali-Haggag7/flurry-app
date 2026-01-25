/**
 * @file connectionsSlice.js
 * @description Redux slice for managing user social graph including connections, 
 * followers, following, and block lists. Utilizes optimistic updates for smooth UX.
 * @module State/Connections
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";

// --- Initial State ---

const initialState = {
    connections: [],
    pendingRequests: [],
    sentRequests: [],
    followers: [],
    following: [],
    blockedUsers: [],
    isLoading: false,
    error: null,
};

// --- Thunks (Async Actions) ---

/**
 * Fetches all connection-related data for the current user.
 */
export const fetchMyConnections = createAsyncThunk(
    "connection/fetchMyConnections",
    async (token, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.get("/connection", {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Accessing nested data property as per backend response structure
            return response.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to load connections");
        }
    }
);

/**
 * Sends a connection request to a target user.
 * Uses toast.promise for real-time feedback.
 */
export const sendConnectionRequest = createAsyncThunk(
    "connection/sendRequest",
    async ({ targetUserId, token }, { rejectWithValue }) => {
        const promise = axiosInstance.post(`/connection/send`,
            { receiverId: targetUserId },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        toast.promise(promise, {
            loading: 'Sending request...',
            success: 'Request sent!',
            error: (err) => err.response?.data?.message || 'Failed to send request',
        });

        try {
            const response = await promise;
            return { targetUserId, data: response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message);
        }
    }
);

/**
 * Accepts an incoming connection request.
 */
export const acceptConnectionRequest = createAsyncThunk(
    "connection/acceptRequest",
    async ({ targetUserId, token }, { rejectWithValue }) => {
        try {
            const response = axiosInstance.post(`/connection/accept/${targetUserId}`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.promise(response, {
                loading: 'Accepting...',
                success: 'You are now connected! 🎉',
                error: 'Failed to accept request',
            });

            await response;
            return targetUserId;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message);
        }
    }
);

/**
 * Blocks a specific user and cleans up existing relationships.
 */
export const blockUser = createAsyncThunk(
    "connection/blockUser",
    async ({ targetUserId, token }, { rejectWithValue }) => {
        try {
            const response = axiosInstance.post(`/connection/block`,
                { blockId: targetUserId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.promise(response, {
                loading: 'Blocking user...',
                success: 'User blocked.',
                error: 'Failed to block user',
            });

            await response;
            return targetUserId;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message);
        }
    }
);

/**
 * Follows a user (handles both public and private accounts).
 */
export const followUserAction = createAsyncThunk(
    "connection/followUser",
    async ({ targetUserId, token }, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.post(`/user/follow/${targetUserId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return { targetUserId, status: response.data.status };
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to follow");
            return rejectWithValue(error.response?.data?.message);
        }
    }
);

/**
 * Unfollows a user.
 */
export const unfollowUserAction = createAsyncThunk(
    "connection/unfollowUser",
    async ({ targetUserId, token }, { rejectWithValue }) => {
        try {
            await axiosInstance.post(`/user/unfollow/${targetUserId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return targetUserId;
        } catch (error) {
            toast.error("Failed to unfollow");
            return rejectWithValue(error.response?.data?.message);
        }
    }
);

// --- Slice Definition ---

const connectionSlice = createSlice({
    name: "connection",
    initialState,
    reducers: {
        /**
         * Resets the entire connection state (useful on logout).
         */
        clearConnections: (state) => {
            Object.assign(state, initialState);
        }
    },
    extraReducers: (builder) => {
        builder
            // --- Fetch Connections ---
            .addCase(fetchMyConnections.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchMyConnections.fulfilled, (state, action) => {
                state.isLoading = false;
                state.connections = action.payload.connections || [];
                state.pendingRequests = action.payload.pendingRequests || [];
                state.sentRequests = action.payload.sentRequests || [];
                state.followers = action.payload.followers || [];
                state.following = action.payload.following || [];
                state.blockedUsers = action.payload.blockedUsers || [];
            })
            .addCase(fetchMyConnections.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })

            // --- Send Request ---
            .addCase(sendConnectionRequest.fulfilled, (state, action) => {
                state.sentRequests.push({ _id: action.payload.targetUserId });
            })

            // --- Accept Request (Optimistic State Update) ---
            .addCase(acceptConnectionRequest.fulfilled, (state, action) => {
                const targetId = action.payload;
                const requestIndex = state.pendingRequests.findIndex(u => u._id === targetId);

                if (requestIndex !== -1) {
                    const user = state.pendingRequests[requestIndex];
                    state.pendingRequests.splice(requestIndex, 1);
                    state.connections.push(user);
                }
            })

            // --- Block User (Comprehensive Cleanup) ---
            .addCase(blockUser.fulfilled, (state, action) => {
                const targetId = action.payload;

                // Remove from all relationship arrays
                const filterFn = (u) => u._id !== targetId;
                state.connections = state.connections.filter(filterFn);
                state.pendingRequests = state.pendingRequests.filter(filterFn);
                state.sentRequests = state.sentRequests.filter(filterFn);
                state.followers = state.followers.filter(filterFn);
                state.following = state.following.filter(filterFn);

                // Add to block list
                state.blockedUsers.push({ _id: targetId });
            })

            // --- Follow User ---
            .addCase(followUserAction.fulfilled, (state, action) => {
                const { targetUserId, status } = action.payload;
                if (status === "following") {
                    state.following.push({ _id: targetUserId });
                }
            })

            // --- Unfollow User ---
            .addCase(unfollowUserAction.fulfilled, (state, action) => {
                const targetId = action.payload;
                state.following = state.following.filter(u => u._id !== targetId);
            });
    },
});

export const { clearConnections } = connectionSlice.actions;
export default connectionSlice.reducer;