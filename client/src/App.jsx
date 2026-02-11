import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from "react-i18next";

// --- Components & Layouts ---
import Loading from './components/common/Loading';
import AuthWrapper from './layouts/AuthWrapper';
import Layout from './layouts/Layout';
import useOfflineSync from "./hooks/useOfflineSync";
import api from "./lib/axios";
import { requestFcmToken } from "./lib/firebase";
import ScrollToTop from "./utils/ScrollToTop";

// --- Utility: Smart Lazy Loading ---
/**
 * Wraps React.lazy to automatically reload the page once if a chunk fails to load.
 * This prevents the "White Screen of Death" when deploying new versions (chunk mismatch).
 */
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        // Force refresh the page to fetch the newly generated chunks from the server
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
      }
      throw error;
    }
  });

// --- Lazy Loaded Pages (Code Splitting) ---
// Optimized for performance: Routes are loaded safely with retry logic
const Login = lazyWithRetry(() => import('./pages/Login'));
const Feed = lazyWithRetry(() => import('./pages/Feed'));
const Search = lazyWithRetry(() => import('./pages/Search'));
const CreatePost = lazyWithRetry(() => import('./pages/CreatePost'));
const PostDetails = lazyWithRetry(() => import('./pages/PostDetails'));
const NotificationsPage = lazyWithRetry(() => import('./pages/NotificationsPage'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const Messages = lazyWithRetry(() => import('./pages/Messages'));
const Chat = lazyWithRetry(() => import('./pages/Chat'));
const Connections = lazyWithRetry(() => import('./pages/Connections'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const NetworkPage = lazyWithRetry(() => import('./pages/NetworkPage'));
const MyGroups = lazyWithRetry(() => import('./pages/MyGroups'));
const AvailableGroups = lazyWithRetry(() => import('./pages/AvailableGroups'));
const GroupChat = lazyWithRetry(() => import('./pages/GroupChat'));
const GroupRequests = lazyWithRetry(() => import('./pages/GroupRequests'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));

/**
 * @component ProtectedRoute
 * @description Guards routes against unauthenticated access using Clerk.
 * Redirects to /login if the user is not signed in.
 */
const ProtectedRoute = () => {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
};

/**
 * @component App
 * @description Main application entry point managing routing, global providers, and theme-aware feedback.
 */
const App = () => {
  const { i18n } = useTranslation();
  const { userId, getToken } = useAuth();

  // 1. Run Sync Engine Globally
  useOfflineSync();

  // 2. Initialize Push Notifications
  useEffect(() => {
    const initializeNotifications = async () => {
      if (!userId) return; // Don't run if not logged in

      try {
        // A. Request Permission & Get Token
        const fcmToken = await requestFcmToken();

        if (fcmToken) {
          // B. Send Token to Backend
          const authToken = await getToken();
          await api.post("/user/fcm-token", { token: fcmToken }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
        }
      } catch (error) {
        console.error("❌ Failed to sync notification token", error);
      }
    };

    initializeNotifications();
  }, [userId, getToken]);

  // 3. Handle Language Direction
  useEffect(() => {
    // Force direction based on language
    document.documentElement.dir = i18n.dir();
    // Force language
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <>
      <ScrollToTop />

      {/* Global Toast Notifications - Themed & Localized */}
      <Toaster
        position="top-center"
        reverseOrder={false}
        containerStyle={{
          direction: i18n.dir(),
        }}
        toastOptions={{
          className: 'bg-surface text-content border border-adaptive shadow-lg',
          style: {
            padding: '16px',
            borderRadius: '12px',
            direction: i18n.dir(),
            fontFamily: 'inherit',
          },
          success: {
            iconTheme: {
              primary: '#10B981', // Emerald-500
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444', // Red-500
              secondary: 'white',
            },
          },
        }}
      />

      {/* Suspense handles the loading state while lazy chunks are being fetched */}
      <Suspense fallback={<Loading />}>
        <Routes>

          {/* --- Public Routes --- */}
          <Route path="/login" element={<Login />} />

          {/* --- Protected Routes (Require Authentication) --- */}
          <Route element={<ProtectedRoute />}>

            {/* Database Synchronization Wrapper */}
            <Route element={<AuthWrapper />}>

              {/* Main Layout (Sidebar, Navbar, etc.) */}
              <Route path="/" element={<Layout />}>

                {/* 1. Core Features */}
                <Route index element={<Feed />} />
                <Route path="/search" element={<Search />} />
                <Route path="/create-post" element={<CreatePost />} />
                <Route path="/post/:id" element={<PostDetails />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<Settings />} />

                {/* 2. Chat & Messaging */}
                <Route path="/messages" element={<Messages />} />
                <Route path="messages/:id" element={<Chat />} />

                {/* 3. User & Network */}
                <Route path="/connections" element={<Connections />} />
                <Route path="/profile/:profileId?" element={<Profile />} />
                <Route path="/profile/:userId/followers" element={<NetworkPage />} />
                <Route path="/profile/:userId/following" element={<NetworkPage />} />

                {/* 4. Groups Module */}
                <Route path="/groups" element={<MyGroups />} />
                <Route path="/groups/available" element={<AvailableGroups />} />
                <Route path="/groups/:groupId/chat" element={<GroupChat />} />
                <Route path="/groups/:groupId/requests" element={<GroupRequests />} />

              </Route> {/* End of Layout */}

            </Route> {/* End of AuthWrapper */}

          </Route> {/* End of ProtectedRoute */}

          {/* --- 404 Catch-All Route --- */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Suspense>
    </>
  );
};

export default App;