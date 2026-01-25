/**
 * @file main.jsx
 * @description Application Entry Point & Provider Composition Root.
 * This file is responsible for bootstrapping the React application and wrapping
 * the component tree with necessary global providers (Redux, Auth, Router, Theme, Sockets).
 *
 * @architecture
 * 1. Redux Provider (Global State)
 * 2. Clerk Provider (Authentication)
 * 3. Browser Router (Routing)
 * 4. Context Providers (Socket, Theme)
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { Provider } from 'react-redux';

// --- Local & Context Imports ---
import { store } from './app/store';
import { SocketContextProvider } from './context/SocketContext.jsx';
import { ThemeProvider } from "./context/ThemeContext";
import App from './App.jsx';

// --- Global Styles ---
import './index.css';

// --- Configuration ---
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

// --- Application Bootstrapping ---
const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    {/* Provider Tree:
      - Provider (Redux): Encases the app to allow state access even during auth flow.
      - ClerkProvider: Handles authentication context.
      - BrowserRouter: Enables routing features.
      - SocketContextProvider: Real-time features (requires Auth/Router usually).
      - ThemeProvider: UI Theming.
    */}
    <Provider store={store}>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <BrowserRouter>
          <SocketContextProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </SocketContextProvider>
        </BrowserRouter>
      </ClerkProvider>
    </Provider>
  </StrictMode>
);