/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            animation: {
                'spin-slow': 'spin 3s linear infinite',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            colors: {
                main: "var(--color-bg)",
                surface: "var(--color-surface)",
                content: "var(--color-text-main)",
                muted: "var(--color-text-sec)",
                primary: "var(--color-primary)",
            },
            borderColor: {
                DEFAULT: "var(--color-border)",
                adaptive: "var(--color-border)",
            }
        },
    },
    plugins: [],
}