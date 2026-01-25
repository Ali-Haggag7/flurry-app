import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Toaster } from 'react-hot-toast';

// --- Components & Layouts ---
import Loading from './components/common/Loading';
import AuthWrapper from './layouts/AuthWrapper';
import Layout from './layouts/Layout';

// --- Lazy Loaded Pages (Code Splitting) ---
// Optimized for performance: Routes are loaded only when requested to reduce initial bundle size.
const Login = lazy(() => import('./pages/Login'));
const Feed = lazy(() => import('./pages/Feed'));
const Search = lazy(() => import('./pages/Search'));
const CreatePost = lazy(() => import('./pages/CreatePost'));
const PostDetails = lazy(() => import('./pages/PostDetails'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const Settings = lazy(() => import('./pages/Settings'));
const Messages = lazy(() => import('./pages/Messages'));
const Chat = lazy(() => import('./pages/Chat'));
const Connections = lazy(() => import('./pages/Connections'));
const Profile = lazy(() => import('./pages/Profile'));
const NetworkPage = lazy(() => import('./pages/NetworkPage'));
const MyGroups = lazy(() => import('./pages/MyGroups'));
const AvailableGroups = lazy(() => import('./pages/AvailableGroups'));
const GroupChat = lazy(() => import('./pages/GroupChat'));
const GroupRequests = lazy(() => import('./pages/GroupRequests'));
const NotFound = lazy(() => import('./pages/NotFound'));

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
  return (
    <>
      {/* Global Toast Notifications - Themed */}
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          className: 'bg-surface text-content border border-adaptive shadow-lg',
          style: {
            // Inherit styles from Tailwind classes where possible, specific overrides for library defaults
            padding: '16px',
            borderRadius: '12px',
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