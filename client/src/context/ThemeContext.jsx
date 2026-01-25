import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useMemo
} from "react";

/**
 * @file ThemeContext.js
 * @description Production-grade Theme & Accent Color Provider.
 * Manages system-wide UI states, persists preferences via LocalStorage,
 * and synchronizes state with DOM attributes for Tailwind CSS/CSS Variable integration.
 */

const ThemeContext = createContext(undefined);

// --- Provider Component ---

export const ThemeProvider = ({ children }) => {
    /**
     * Lazy initialization for performance. 
     * Accessing localStorage is a synchronous I/O operation; doing it in a 
     * function ensures it only runs once during the initial mount.
     */
    const [theme, setTheme] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("theme") || "dark";
        }
        return "dark";
    });

    const [accent, setAccent] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("accent-color") || "purple";
        }
        return "purple";
    });

    // --- Effects ---

    /**
     * Synchronization Effect:
     * Reflects state changes to LocalStorage and the Document Root.
     * This allows Tailwind custom classes (bg-main, border-adaptive, etc.) 
     * to react to the 'data-theme' and 'data-accent' attributes.
     */
    useEffect(() => {
        const root = document.documentElement;

        // Persist preferences
        localStorage.setItem("theme", theme);
        localStorage.setItem("accent-color", accent);

        // Apply attributes to HTML for CSS Variable targeting
        root.setAttribute("data-theme", theme);
        root.setAttribute("data-accent", accent);

        // Optional: Update color-scheme meta for browser chrome styling
        root.style.colorScheme = theme;
    }, [theme, accent]);

    // --- Optimization ---

    /**
     * Memoizing the context value prevents unnecessary re-renders for all 
     * consuming components whenever the parent state updates, unless the 
     * values actually change.
     */
    const contextValue = useMemo(() => ({
        theme,
        setTheme,
        accent,
        setAccent
    }), [theme, accent]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

// --- Custom Hook ---

/**
 * Accesses the Theme context with a safety check to ensure it's used 
 * within the correct Provider boundaries.
 */
export const useTheme = () => {
    const context = useContext(ThemeContext);

    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }

    return context;
};