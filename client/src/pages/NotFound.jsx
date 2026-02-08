import { memo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, ArrowLeft, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next"; // 🟢

/**
 * NotFound Component
 * Displays a 404 error page with animated elements and navigation options.
 */
const NotFound = () => {
    // --- Hooks ---
    const navigate = useNavigate();
    const { t } = useTranslation(); // 🟢

    // --- Handlers ---
    const handleGoBack = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-main text-content relative overflow-hidden font-sans">

            {/* --- Ambient Background --- */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] start-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] opacity-30"></div>
                <div className="absolute bottom-[-20%] end-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] opacity-30"></div>
                {/* Noise overlay */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
            </div>

            {/* --- Main Content --- */}
            <div className="z-10 flex flex-col items-center text-center p-6">

                {/* 1. Animated Icon Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative mb-8"
                >
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
                    <div className="relative w-32 h-32 bg-surface/30 border border-adaptive backdrop-blur-xl rounded-3xl flex items-center justify-center shadow-2xl">
                        <SearchX size={64} className="text-primary opacity-90" />
                    </div>

                    {/* 404 Badge */}
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="absolute -bottom-4 -end-4 bg-surface border border-adaptive px-4 py-1 rounded-full shadow-lg" // 🔵 -end-4
                    >
                        <span className="font-mono text-xl font-bold text-primary tracking-widest">404</span>
                    </motion.div>
                </motion.div>

                {/* 2. Text Content */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="text-4xl md:text-5xl font-black mb-4 tracking-tight text-content"
                >
                    {t("notFound.title")} {/* 🟢 */}
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="text-muted text-lg max-w-md mb-10 leading-relaxed"
                >
                    {t("notFound.desc")} {/* 🟢 */}
                </motion.p>

                {/* 3. Action Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
                >
                    {/* Back Button */}
                    <button
                        onClick={handleGoBack}
                        aria-label="Go back"
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface hover:bg-surface/80 border border-adaptive transition-all font-bold text-muted hover:text-content active:scale-95 shadow-sm group"
                    >
                        <ArrowLeft size={20} className="rtl:rotate-180 transition-transform group-hover:-translate-x-1 rtl:group-hover:translate-x-1" /> {/* 🔵 RTL Flip & Animation fix */}
                        {t("notFound.goBack")} {/* 🟢 */}
                    </button>

                    {/* Home Button */}
                    <Link
                        to="/"
                        className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-primary hover:opacity-90 shadow-lg shadow-primary/25 transition-all font-bold text-white active:scale-95"
                    >
                        <Home size={20} />
                        {t("notFound.home")} {/* 🟢 */}
                    </Link>
                </motion.div>

            </div>

            {/* --- Footer Note --- */}
            <div className="absolute bottom-6 text-muted text-xs font-mono opacity-50">
                Error Code: 404_NOT_FOUND
            </div>
        </div>
    );
};

export default memo(NotFound);