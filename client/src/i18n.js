/**
 * @file i18n.js
 * @description Internationalization (i18n) configuration using i18next.
 * Handles language detection, resource loading, and RTL/LTR direction updates.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// --- Locale Resources ---
import en from "./locales/en/translation.json";
import ar from "./locales/ar/translation.json";

// =========================================================
// 🟢 Helper Functions
// =========================================================

/**
 * Updates the document's `dir` and `lang` attributes based on the selected language.
 * Handles the switch between RTL (Arabic) and LTR (English/Others).
 * * @param {string} language - The language code (e.g., 'ar', 'en').
 */
const updateDocumentDirection = (language) => {
    const dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
};

// =========================================================
// 🟢 i18n Initialization
// =========================================================

i18n
    .use(LanguageDetector) // Detects user language
    .use(initReactI18next) // Passes i18n down to react-i18next
    .init({
        resources: {
            en: { translation: en },
            ar: { translation: ar },
        },
        fallbackLng: "en",
        interpolation: {
            escapeValue: false, // React already safes from xss
        },
        detection: {
            // Order and cache preferences
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        }
    });

// =========================================================
// 🟢 Event Listeners & Initial Setup
// =========================================================

// 1. Set initial direction on app load (handles refresh)
updateDocumentDirection(i18n.language);

// 2. Listen for language changes to update direction dynamically
i18n.on('languageChanged', (lng) => {
    updateDocumentDirection(lng);
});

export default i18n;