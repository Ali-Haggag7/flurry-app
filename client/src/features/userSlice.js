/**
 * @file userSlice.js
 * @description Redux slice for managing the authenticated user's profile, settings, 
 * privacy, and session state. 
 * @module State/User
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";

// --- Local Imports ---
import axiosInstance from "../lib/axios";

// --- Initial State ---
const initialState = {
    currentUser: null,
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
};

// =========================================================
// 2. Thunks (Async Logic)
// =========================================================

/**
 * Synchronizes local user data with the server profile.
 */
export const syncUser = createAsyncThunk(
    "user/syncUser",
    async ({ userData, token }, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.post("/user/sync", userData, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data.user;
        } catch (error) {
            console.error("User Sync Error:", error);
            return rejectWithValue(error.response?.data?.message || "Sync failed");
        }
    }
);

/**
 * Fetches the current authenticated user's full profile data.
 */
export const fetchUser = createAsyncThunk(
    "user/fetchUser",
    async (token, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.get("/user/me", {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Fetch failed");
        }
    }
);

/**
 * Updates the user's profile information (handles multipart/form-data for avatars).
 */
export const updateUser = createAsyncThunk(
    "user/updateUser",
    async ({ formData, token }, { rejectWithValue }) => {
        const promise = axiosInstance.put("/user/update-profile", formData, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "multipart/form-data"
            },
        });

        toast.promise(promise, {
            loading: 'Updating profile...',
            success: 'Profile updated successfully!',
            error: (err) => err.response?.data?.message || 'Update failed',
        });

        try {
            const response = await promise;
            return response.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message);
        }
    }
);

/**
 * Updates user privacy settings (e.g., online status visibility).
 */
export const updatePrivacy = createAsyncThunk(
    "user/updatePrivacy",
    async ({ settings, token }, { rejectWithValue }) => {
        const promise = axiosInstance.put("/user/update-privacy", settings, {
            headers: { Authorization: `Bearer ${token}` },
        });

        toast.promise(promise, {
            loading: 'Saving privacy settings...',
            success: 'Privacy updated!',
            error: 'Failed to update privacy',
        });

        try {
            const response = await promise;
            return response.data.user;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Update failed");
        }
    }
);

/**
 * Updates user notification preferences.
 */
export const updateNotificationSettings = createAsyncThunk(
    "user/updateNotificationSettings",
    async ({ settings, token }, { rejectWithValue }) => {
        const promise = axiosInstance.put("/user/update-settings", settings, {
            headers: { Authorization: `Bearer ${token}` },
        });

        toast.promise(promise, {
            loading: 'Updating preferences...',
            success: 'Notification settings saved!',
            error: 'Failed to save settings',
        });

        try {
            const response = await promise;
            return response.data.settings;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Update failed");
        }
    }
);

// =========================================================
// 3. User Slice
// =========================================================

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        /**
         * Local optimistic toggle for muting/unmuting users.
         */
        toggleMuteLocal: (state, action) => {
            const targetId = action.payload;
            if (state.currentUser) {
                if (!state.currentUser.mutedUsers) {
                    state.currentUser.mutedUsers = [];
                }
                const index = state.currentUser.mutedUsers.indexOf(targetId);
                if (index !== -1) {
                    state.currentUser.mutedUsers.splice(index, 1);
                } else {
                    state.currentUser.mutedUsers.push(targetId);
                }
            }
        },
        /**
         * Resets user state to default.
         */
        logout: (state) => {
            state.currentUser = null;
            state.status = "idle";
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // --- Sync & Fetch (Common Lifecycle) ---
            .addCase(syncUser.pending, (state) => { state.status = "loading"; })
            .addCase(syncUser.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.currentUser = action.payload;
            })
            .addCase(syncUser.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            })

            .addCase(fetchUser.pending, (state) => { state.status = "loading"; })
            .addCase(fetchUser.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.currentUser = action.payload;
            })
            .addCase(fetchUser.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            })

            // --- Update Operations ---
            .addCase(updateUser.pending, (state) => { state.status = "loading"; })
            .addCase(updateUser.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.currentUser = action.payload;
            })

            .addCase(updatePrivacy.fulfilled, (state, action) => {
                if (state.currentUser) {
                    state.currentUser = { ...state.currentUser, ...action.payload };
                }
            })

            .addCase(updateNotificationSettings.fulfilled, (state, action) => {
                if (state.currentUser) {
                    const currentSettings = state.currentUser.notificationSettings || {};
                    state.currentUser.notificationSettings = {
                        ...currentSettings,
                        ...action.payload
                    };
                }
            });
    },
});

export const { logout, toggleMuteLocal } = userSlice.actions;
export default userSlice.reducer;