/**
 * Footer Component
 * ------------------------------------------------------------------
 * Displays site navigation, legal documents (Privacy, Terms), and developer info.
 * Features:
 * - Responsive design (Mobile Accordion / Desktop Cards).
 * - Modal system for viewing documents without leaving the page.
 * - Optimized rendering by extracting static data and sub-components.
 */

import { useState, memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next"; // 🟢

// Icons
import {
    X, FileText, Info, Shield, Cookie, Megaphone,
    FileUser, Github, Linkedin, Heart, ChevronRight, HelpCircle
} from "lucide-react";

// --- Sub-Components (Memoized) ---

// 1. Document Modal Content
const DocModal = memo(({ docKey, onClose, t }) => { // 🟢 Receive t
    // 🟢 Icons mapping
    const icons = {
        privacy: Shield,
        terms: FileText,
        advertising: Megaphone,
        cookies: Cookie
    };
    const Icon = icons[docKey];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-surface/95 border border-adaptive w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] relative"
            >
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-adaptive bg-main/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(var(--color-primary),0.2)]">
                            <Icon size={20} className="text-primary" />
                        </div>
                        <h3 className="text-content font-bold text-xl tracking-tight">{t(`footer.docs.${docKey}.title`)}</h3> {/* 🟢 */}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-main rounded-full text-muted hover:text-content transition active:scale-90">
                        <X size={22} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 text-content/80 text-sm leading-relaxed overflow-y-auto custom-scrollbar">
                    <p className="mb-6 font-light">{t(`footer.docs.${docKey}.content`)}</p> {/* 🟢 */}

                    <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-start gap-3">
                        <Info size={16} className="text-primary mt-0.5 shrink-0" />
                        <div>
                            <h4 className="text-primary font-bold text-xs uppercase mb-1">{t("footer.noteTitle")}</h4> {/* 🟢 */}
                            <p className="text-xs text-muted">{t("footer.noteContent")}</p> {/* 🟢 */}
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-5 border-t border-adaptive bg-main/30 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-primary/20 active:scale-95">
                        {t("footer.acknowledge")} {/* 🟢 */}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
});

// --- Main Component ---

const Footer = () => {
    const [openDoc, setOpenDoc] = useState(null);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const { t } = useTranslation(); // 🟢

    const docKeys = ["privacy", "terms", "advertising", "cookies"];

    return (
        <>
            {/* --- Mobile View (Accordion) --- */}
            <div className="lg:hidden px-2 pb-2">
                <button
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-300 group
                    ${showMobileMenu ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface border-adaptive text-muted hover:border-primary/50"}`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-sg ${showMobileMenu ? "bg-primary text-white" : "bg-main text-muted group-hover:text-primary"}`}>
                            <HelpCircle size={18} />
                        </div>
                        <div className="text-start">
                            <p className="text-xs font-bold">{t("footer.aboutLegal")}</p> {/* 🟢 */}
                            <p className="text-[10px] opacity-70">{t("footer.legalSubtitle")}</p> {/* 🟢 */}
                        </div>
                    </div>
                    <ChevronRight size={16} className={`transition-transform duration-300 ${showMobileMenu ? "rotate-90 text-primary" : "text-muted rtl:rotate-180"}`} /> {/* 🟢 RTL rotate */}
                </button>

                <AnimatePresence>
                    {showMobileMenu && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden"
                        >
                            <div className="pt-2 ps-2 flex flex-col gap-1 border-s-2 border-dashed border-adaptive ms-4 my-2">
                                {docKeys.map((key) => (
                                    <button
                                        key={key}
                                        onClick={() => setOpenDoc(key)}
                                        className="text-start text-xs text-muted hover:text-primary py-1.5 px-3 rounded-e-lg hover:bg-primary/5 transition-colors capitalize flex items-center gap-2"
                                    >
                                        <div className="w-1 h-1 bg-muted rounded-full" />
                                        {t(`footer.docs.${key}.title`)} {/* 🟢 */}
                                    </button>
                                ))}

                                {/* Developer Links (Mobile) */}
                                <div className="mt-2 pt-2 border-t border-adaptive/30 px-3">
                                    <div className="flex items-center gap-2 text-xs text-muted">
                                        <span>{t("footer.by")}</span>
                                        <a href="https://www.linkedin.com/in/ali-haggag7" target="_blank" rel="noreferrer" className="font-bold text-content hover:text-primary transition-colors">Ali Haggag</a>
                                    </div>
                                    <div className="flex gap-3 mt-3 text-muted/60">
                                        <a href="/Ali Haggag_CV.pdf" target="_blank" aria-label="CV" className="hover:text-primary"><FileUser size={14} /></a>
                                        <a href="https://www.linkedin.com/in/ali-haggag7" target="_blank" aria-label="LinkedIn" className="hover:text-primary"><Linkedin size={14} /></a>
                                        <a href="https://github.com/Ali-Haggag7" target="_blank" aria-label="GitHub" className="hover:text-primary"><Github size={14} /></a>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* --- Desktop View (Cards) --- */}
            <div className="hidden lg:flex bg-surface/60 backdrop-blur-xl p-5 rounded-2xl border border-adaptive mb-4 shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden flex-col gap-4 text-center">
                {/* Decorative Blur */}
                <div className="absolute top-0 start-1/2 -translate-x-1/2 w-1/3 h-1 bg-linear-to-r from-transparent via-primary/30 to-transparent opacity-50 blur-sm" />

                {/* Links Grid */}
                <div className="grid grid-cols-4 gap-y-2 gap-x-1 text-[10px] text-muted font-bold uppercase tracking-wide">
                    {docKeys.map((key) => (
                        <button
                            key={key}
                            onClick={() => setOpenDoc(key)}
                            className="hover:text-primary cursor-pointer transition-all active:scale-95 py-1"
                        >
                            {t(`footer.docs.${key}.shortTitle`)} {/* 🟢 Short titles for grid */}
                        </button>
                    ))}
                </div>

                <div className="w-full h-px bg-adaptive/50" />

                {/* Developer Badge */}
                <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] text-muted/60 font-mono tracking-wide">{t("footer.designedBy")}</span> {/* 🟢 */}
                    <a href="https://www.linkedin.com/in/ali-haggag7" target="_blank" rel="noreferrer" className="bg-main/80 px-3 py-1.5 rounded-full border border-adaptive shadow-sm flex items-center gap-2 hover:border-primary/50 transition-all cursor-pointer group/dev">
                        <span className="text-xs font-bold text-primary group-hover/dev:text-primary/80">Ali Haggag</span>
                        <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-primary">
                            <Heart size={10} fill="currentColor" />
                        </motion.span>
                    </a>
                </div>

                {/* Copyright & Socials */}
                <div className="flex items-center justify-between px-2 pt-1">
                    <span className="text-[9px] text-muted/50 font-mono">© 2026 Flurry</span>
                    <div className="flex gap-2 text-muted/70">
                        <a
                            href="/cv.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="CV"
                            className="hover:text-primary transition-colors"
                        >
                            <FileUser size={13} />
                        </a>
                        <a href="https://www.linkedin.com/in/ali-haggag7" target="_blank" aria-label="LinkedIn" className="hover:text-primary transition-colors"><Linkedin size={13} /></a>
                        <a href="https://github.com/Ali-Haggag7" target="_blank" aria-label="GitHub" className="hover:text-primary transition-colors"><Github size={13} /></a>
                    </div>
                </div>
            </div>

            {/* --- Modal Portal --- */}
            {openDoc && createPortal(
                <AnimatePresence>
                    <DocModal docKey={openDoc} onClose={() => setOpenDoc(null)} t={t} /> {/* 🟢 Pass t */}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

export default Footer;