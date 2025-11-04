import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, Palette, Bell, ShieldAlert } from "lucide-react";

const tabs = [
    { id: "general", label: "General", icon: <User className="w-4 h-4" /> },
    { id: "privacy", label: "Privacy", icon: <Lock className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "danger", label: "Danger Zone", icon: <ShieldAlert className="w-4 h-4" /> },
];

const Settings = () => {

    const [activeTab, setActiveTab] = useState("general");

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-extrabold text-center bg-gradient-to-r from-purple-400 to-pink-400
                    bg-clip-text text-transparent">
                    ⚡ Settings
                </h1>
                <p className="text-gray-400 text-center mt-2">Customize your experience, privacy, and preferences</p>

                {/* Tabs */}
                <div className="w-full flex justify-center gap-4 mt-8 flex-wrap">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md cursor-pointer
                                    ${activeTab === tab.id ? "bg-purple-600 text-white border-purple-400 shadow-lg scale-105"
                                    : "bg-white/10 text-gray-300 hover:bg-white/20 border-white/20"}`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tabs Content */}
                <div className="mt-10">
                    <AnimatePresence mode="wait">  // wait for the animation to finish
                        {activeTab === "general" && (
                            <motion.div
                                key="general"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="p-6 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-xl shadow-lg">
                                <h2 className="text-xl font-bold mb-4">General Settings</h2>
                                <div className="space-y-4">
                                    <input type="text" placeholder="Full Name" className="w-full p-3 rounded-lg
                                        bg-white/5 border border-white/20"/>

                                    <input type="text" placeholder="Username" className="w-full p-3 rounded-lg
                                        bg-white/5 border border-white/20"/>

                                    <textarea rows="3" placeholder="Short Bio" className="w-full p-3
                                        rounded-lg bg-white/5 border border-white/20">
                                    </textarea>
                                </div>
                            </motion.div>
                        )}
                        {activeTab === "privacy" && (
                            <motion.div
                                key="privacy"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="p-6 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-xl shadow-lg">
                                <h2 className="text-xl font-bold mb-4">Privacy Settings</h2>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4" /> Make my profile private
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4" /> Hide Last Seen
                                </label>
                            </motion.div>
                        )}
                        {activeTab === "appearance" && (
                            <motion.div
                                key="appearance"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="p-6 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-xl shadow-lg">
                                <div className="flex items-center justify-evenly gap-4">
                                    <button className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer">
                                        Dark
                                    </button>
                                    <button className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer">
                                        Light
                                    </button>
                                    <button className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer">
                                        Fantasy
                                    </button>
                                </div>
                            </motion.div>
                        )}
                        {activeTab === "notifications" && (
                            <motion.div
                                key="notifications"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="p-6 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-xl shadow-lg">
                                <h2 className="text-xl font-bold mb-4">Notifications Settings</h2>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4" /> Email Notifications
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4" /> Push Notifications
                                </label>
                            </motion.div>
                        )}
                        {activeTab === "danger" && (
                            <motion.div
                                key="danger"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="p-6 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-xl shadow-lg">
                                <h2 className="text-xl font-bold mb-4 text-red-500">Danger Zone</h2>
                                <p className="text-gray-300 mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                                <button className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 shadow-lg transition cursor-pointer">
                                    Delete Account
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </div>
    )
}

export default Settings