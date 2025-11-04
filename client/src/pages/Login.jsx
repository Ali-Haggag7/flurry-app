import { assets } from '../assets/assets.js';
import { Star } from "lucide-react";  // مكتبة أيقونات
import { motion } from "framer-motion";  // لتحريك العناصر
import { SignIn } from '@clerk/clerk-react';  // مكون تسجيل الدخول من Clerk

const Login = () => {
    return (
        <div className="relative min-h-screen flex flex-col md:flex-row bg-gradient-to-br
            from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f] overflow-hidden">

            {/* box 1 - الدائرتين اللي في اقصي الشمال فوق واللي في اقصي اليمين تحت */}
            <div className="absolute inset-0">
                <div className="absolute w-[600px] h-[600px] bg-purple-600/20 rounded-full top-[-200px]
                    left-[-100px] blur-3xl animate-pulse-slow"></div>
                <div className="absolute w-[500px] h-[500px] bg-pink-600/20 rounded-full bottom-[-100px]
                    right-[-100px] blur-3xl animate-pulse-slow"></div>
            </div>

            {/*------------------------------------------------------------------------------------------------------------- */}

            {/* box 2 - الجزء النصي */}
            <div className="flex-1 flex flex-col items-start justify-between lg:pl-40 p-6 md:p-10 z-10">
                {/* لوجو */}
                <motion.img
                    src={assets.logo}
                    alt="Logo"
                    className="h-12 object-contain mb-6"
                    initial={{ opacity: 0, y: -50 }}  // الحالة الأولى قبل بداية الأنيميشن
                    animate={{ opacity: 1, y: 0 }}  // الحالة اللي عايز توصلها بعد ما يبدأ الأنيميشن
                    transition={{ duration: 1 }}
                />

                {/* التقييم ونجوم */}
                <div>
                    <motion.div
                        className='flex gap-3 items-center mb-4'
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1, duration: 1 }}
                    >
                        <img src={assets.group_users} alt="our users" className="h-8 md:h-10" />
                        <div className="flex flex-col">
                            <div className="flex gap-1">
                                {Array(5).fill(0).map((_, index) => (  // تكرار النجوم
                                    <Star
                                        key={index}
                                        className="text-transparent fill-amber-400 drop-shadow-lg animate-pulse"
                                    />
                                ))}
                            </div>
                            <p className="text-gray-300 text-sm mt-1">
                                500+ adventures already inside
                            </p>
                        </div>
                    </motion.div>

                    {/* العنوان الرئيسي */}
                    <motion.h1
                        className="text-gray-400 md:text-7xl bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500
                    bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(255,0,255,0.7)] leading-light"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 1 }}
                    >
                        Enter a world where connections sparkle and conversations shine
                    </motion.h1>

                    {/* الفقرة */}
                    <motion.h1
                        className="text-gray-400 mt-4 md:mt-6 max-w-lg text-lg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 1 }}
                    >
                        Step through the portal of imagination, meet kindred spirits, and let your messages glow with life.
                        Every story, every whisper, every laugh becomes a spark in the digital sky.
                    </motion.h1>
                </div>
            </div>

            {/*------------------------------------------------------------------------------------------------------------- */}

            {/* box 3 - الفورم */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-10 z-10">
                <motion.div
                    className="w-full max-w-md p-8 rounded-3xl bg-gradient-to-br from-purple-700/20 via-indigo-800/20 to-pink-700/20
                    backdrop-blur-md shadow-[0_0_30px_rgba(131,58,180,0.5)]"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1 }}
                >
                    <SignIn
                        appearance={{  // تخصيص شكل صفحة تسجيل الدخول
                            baseTheme: "dark",  // وضع داكن
                            variables: {  // تخصيص الألوان
                                colorPrimary: "#a78bfa",  // لون الأزرار والروابط
                                colorText: "#e5e7eb", // لون النصوص
                                colorBackground: "transparent",  // خلفية الفورم
                                colorInputBackground: "rgba(15, 23, 42, 0.6)", // خلفية الحقول
                                colorCardBackground: "rgba(24,32,52,0.6)", // لون خلفية الكارد نفسه
                            },
                            elements: {  // تخصيص العناصر
                                card: "rounded-3xl shadow-[0_0_25px_rgba(168,85,247,0.5)] border border-purple-500/20 backdrop-blur-xl",
                                headerTitle: "text-transparent bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-2xl font-bold",
                                headerSubtitle: "text-gray-400",
                                socialButtonsBlockButton: "bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl hover:scale-105 transition-all",
                                formFieldInput: "!bg-[#1f264f]/60 !border !border-purple-500/30 !rounded-xl !text-white !focus:ring-2 !focus:ring-purple-500",
                                formButtonPrimary: "bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white font-semibold py-2 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.6)] hover:scale-105 transition-all",
                                footerActionLink: "text-purple-400 hover:text-pink-400",
                                footer: "hidden", // يخفي "Secured by Clerk"
                            },
                        }}
                    />
                </motion.div>
            </div>

            {/*------------------------------------------------------------------------------------------------------------- */}

            {/* تأثير النجوم */}
            {Array(15).fill(0).map((_, index) => (
                <div
                    key={index}
                    className="absolute w-2 h-2 bg-white rounded-full opacity-50 animate-pulse-slow"
                    style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 2}s`,
                    }}
                />
            ))}
        </div>
    );
};

export default Login;
