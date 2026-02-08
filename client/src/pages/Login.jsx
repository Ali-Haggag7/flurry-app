import React, { useMemo } from "react";
import { SignIn } from "@clerk/clerk-react";
import { motion } from "framer-motion";
import { Sparkles, MessageCircle, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next"; // 🟢 Import translation hook

// --- Local Imports ---
import Logo from "../components/common/Logo";

// --- Animation Variants ---
const FADE_UP_VARIANTS = {
    hidden: { opacity: 0, y: 20 },
    visible: (delay = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.8, delay },
    }),
};

const FADE_RIGHT_VARIANTS = {
    hidden: { opacity: 0, x: -50 }, // ⚠️ Note: In RTL this might need adjustment if you want it coming from the right
    visible: (delay = 0) => ({
        opacity: 1,
        x: 0,
        transition: { duration: 0.8, delay },
    }),
};

/**
 * Login Component
 *
 * A split-screen authentication page integrated with Clerk.
 * Features a branded left section with animated value propositions and
 * a right section containing the Clerk SignIn form styled to match the application theme.
 */
const Login = () => {
    const { t } = useTranslation(); // 🟢 Hook initialization

    // Memoize Clerk appearance to prevent unnecessary re-calculations on render
    const clerkAppearance = useMemo(
        () => ({
            baseTheme: "dark",
            variables: {
                colorPrimary: "#6366f1", // Brand Primary
                colorText: "#f8fafc", // Text Content
                colorBackground: "transparent", // Handle bg via Tailwind classes in elements
                colorInputBackground: "transparent",
                colorInputText: "#f8fafc",
                colorTextSecondary: "#94a3b8", // Text Muted
                borderRadius: "1rem",
            },
            elements: {
                rootBox: "w-full",
                card: "border border-adaptive shadow-lg shadow-primary/10 rounded-3xl p-4 sm:p-8 w-full bg-surface/50 backdrop-blur-2xl",
                headerTitle: "text-2xl font-bold text-content text-center mb-1",
                headerSubtitle: "text-muted text-center text-sm mb-6",
                socialButtonsBlockButton:
                    "bg-main hover:bg-surface border border-adaptive transition-all h-12 text-content",
                socialButtonsBlockButtonText: "!text-content font-semibold",
                socialButtonsBlockButtonArrow: "!text-content",
                dividerLine: "bg-adaptive",
                dividerText: "text-muted bg-transparent px-2",
                formFieldLabel: "text-content font-medium ms-1 mb-1.5", // 🔵 ms-1 (Margin Start) for RTL
                formFieldInput:
                    "bg-main border-adaptive focus:border-primary focus:ring-1 focus:ring-primary transition-all text-content",
                formButtonPrimary:
                    "bg-primary hover:opacity-90 shadow-lg shadow-primary/25 transition-all text-white font-bold py-3",
                footerActionLink: "text-primary hover:text-primary/80 font-bold ms-1", // 🔵 ms-1
                footer: "hidden",
                identityPreviewText: "text-muted",
                identityPreviewEditButton: "text-primary hover:text-primary/80",
            },
            layout: {
                socialButtonsPlacement: "top",
                showOptionalFields: false,
            },
        }),
        []
    );

    return (
        <div className="relative min-h-screen w-full flex bg-main overflow-hidden text-content font-sans selection:bg-primary/30">
            {/* Background Effects */}
            <BackgroundEffects />

            {/* ================= LEFT SECTION (Desktop) ================= */}
            <div className="hidden lg:flex lg:w-[55%] flex-col justify-center items-start p-16 xl:p-24 z-10 relative">
                {/* Branding Header */}
                <motion.div
                    variants={FADE_UP_VARIANTS}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                    className="mb-12 flex items-center gap-4"
                >
                    <Logo className="w-20 h-20" showText={false} />
                    <span className="text-5xl font-black tracking-tighter text-content drop-shadow-lg">
                        FLURRY
                    </span>
                </motion.div>

                {/* Hero Title */}
                <motion.h1
                    variants={FADE_RIGHT_VARIANTS}
                    initial="hidden"
                    animate="visible"
                    custom={0.2}
                    className="text-6xl xl:text-7xl font-black tracking-tighter leading-tight mb-8 text-content drop-shadow-xl"
                >
                    {t("login.hero.titleStart")} <br />
                    <span className="text-content">{t("login.hero.titleHighlight")}</span>
                    <span className="text-primary"> .</span>
                </motion.h1>

                {/* Description */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="text-xl text-muted max-w-lg leading-relaxed mb-12 font-medium"
                >
                    {t("login.hero.description")}
                </motion.p>

                {/* Feature Badge */}
                <FeatureBadge delay={0.6} t={t} /> {/* 🟢 Pass t function */}
            </div>

            {/* ================= RIGHT SECTION (Form) ================= */}
            <div className="w-full lg:w-[45%] flex flex-col items-center justify-center p-6 z-10 relative">
                {/* Mobile Branding */}
                <MobileBranding t={t} /> {/* 🟢 Pass t function */}

                {/* Clerk Sign In */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="w-full max-w-md relative"
                >
                    <SignIn appearance={clerkAppearance} />

                    <div className="lg:hidden mt-8 text-center">
                        <span className="text-[10px] text-muted font-mono">
                            © 2026 Flurry Inc.
                        </span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

// --- Sub-Components (Memoized for Performance) ---

/**
 * BackgroundEffects
 * Static background gradient blobs, memoized to prevent re-renders.
 */
const BackgroundEffects = React.memo(() => (
    <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] start-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] opacity-30"></div> {/* 🔵 left -> start */}
        <div className="absolute bottom-[-10%] end-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px] opacity-30"></div> {/* 🔵 right -> end */}
    </div>
));

/**
 * MobileBranding
 * Visible only on smaller screens.
 */
const MobileBranding = React.memo(({ t }) => ( // 🟢 Receive t prop
    <motion.div
        variants={FADE_UP_VARIANTS}
        initial="hidden"
        animate="visible"
        className="lg:hidden mb-8 flex flex-col items-center gap-2"
    >
        <div className="flex items-center gap-3 me-6"> {/* 🔵 mr-6 -> me-6 */}
            <Logo className="w-14 h-14" showText={false} />
            <span className="text-3xl font-black tracking-tight text-content">
                FLURRY
            </span>
        </div>
        <p className="text-muted text-sm mt-2 font-medium">
            {t("login.welcomeBack")} 👋
        </p>
    </motion.div>
));

/**
 * FeatureBadge
 * Displays the project showcase pill with icons.
 */
const FeatureBadge = React.memo(({ delay, t }) => ( // 🟢 Receive t prop
    <motion.div
        variants={FADE_UP_VARIANTS}
        initial="hidden"
        animate="visible"
        custom={delay}
        className="flex items-center gap-4 py-3 px-5 rounded-2xl bg-surface/50 border border-adaptive w-fit backdrop-blur-md hover:bg-surface/80 transition-colors"
    >
        <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                <MessageCircle size={20} />
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                <Sparkles size={20} />
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck size={20} />
            </div>
        </div>
        <div className="h-8 w-[1px] bg-adaptive mx-2"></div>
        <div className="flex flex-col">
            <span className="text-sm font-bold text-content">{t("login.badge.title")}</span>
            <span className="text-xs text-muted">{t("login.badge.subtitle")}</span>
        </div>
    </motion.div>
));

export default Login;