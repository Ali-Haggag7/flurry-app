/**
 * @file main.jsx
 * @description Application Entry Point & Provider Composition Root.
 * Handles Global Polyfills, PWA Registration, and Context Injection.
 */

// =========================================================
// 🟢 1. Polyfills (WebRTC & Simple-Peer Support)
// =========================================================
import { Buffer } from 'buffer';
import process from 'process';

// Attach polyfills to the global window object to support older libraries
window.global = window;
window.process = process;
window.Buffer = Buffer;

// Manual fallback for process.nextTick (Required for some WebRTC libs)
if (!window.process.nextTick) {
  window.process.nextTick = (cb, ...args) => {
    setTimeout(() => {
      cb(...args);
    }, 0);
  };
}

// =========================================================
// 🟢 2. Imports
// =========================================================

// --- React & Core ---
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// --- State Management & Auth ---
import { Provider } from 'react-redux';
import { ClerkProvider } from '@clerk/clerk-react';
import { arSA, enUS } from "@clerk/localizations";

// --- I18n ---
import { useTranslation } from "react-i18next";
import './i18n';

// --- PWA ---
import { registerSW } from 'virtual:pwa-register';

// --- Local Store & Contexts ---
import { store } from './app/store';
import { SocketContextProvider } from './context/SocketContext.jsx';
import { CallProvider } from './context/CallContext.jsx';
import { ThemeProvider } from "./context/ThemeContext";

// --- Components ---
import App from './App.jsx';
import CallModal from './components/modals/CallModal';

// --- Global Styles ---
import './index.css';

// =========================================================
// 🟢 3. Configuration & Initialization
// =========================================================

// --- PWA Service Worker Registration ---
const updateSW = registerSW({
  onNeedRefresh() {
    // eslint-disable-next-line no-restricted-globals
    if (confirm("New content available. Reload?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("App is ready to work offline!");
  },
});

// --- Environment Validation ---
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

// --- Dynamic Clerk Wrapper (Handles Localization) ---
const ClerkWithTranslation = ({ children }) => {
  const { i18n } = useTranslation();

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      localization={i18n.language === 'ar' ? arSA : enUS}
    >
      {children}
    </ClerkProvider>
  );
};

// =========================================================
// 🟢 4. Render Tree
// =========================================================

const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <Provider store={store}>
      <ClerkWithTranslation>
        <BrowserRouter>
          <SocketContextProvider>
            <CallProvider>
              <ThemeProvider>

                {/* Main Application */}
                <App />

                {/* Global Modals (Placed here to access all contexts) */}
                <CallModal />

              </ThemeProvider>
            </CallProvider>
          </SocketContextProvider>
        </BrowserRouter>
      </ClerkWithTranslation>
    </Provider>
  </StrictMode>
);