/**
 * Logo Component
 * ------------------------------------------------------------------
 * Animated site logo with rotation effect on click.
 * Features a glowing backdrop and customizable size.
 */

import { useState, memo } from "react";
import logoImg from "../../assets/logoMain.webp";

const Logo = ({ onClick, className, showText = true }) => {
    const [rotation, setRotation] = useState(0);

    const handleClick = () => {
        setRotation(prev => prev + 360);
        if (onClick) onClick();
    };

    return (
        <div
            onClick={handleClick}
            className="flex items-center gap-2 cursor-pointer group select-none w-fit"
        >
            {/* Icon Container */}
            <div className={`relative flex items-center justify-center ${className || "w-11 h-11 md:w-12 md:h-12"}`}>

                {/* Glow Effect */}
                <div
                    className="absolute inset-0 rounded-full blur-md opacity-40 group-hover:opacity-70 transition-opacity duration-500"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                />

                {/* Masked Logo Image */}
                <div
                    className="relative w-full h-full ease-in-out"
                    style={{
                        backgroundColor: 'var(--color-primary)',
                        transform: `rotate(${rotation}deg)`,
                        transition: 'transform 1s ease-in-out',
                        maskImage: `url(${logoImg})`,
                        WebkitMaskImage: `url(${logoImg})`,
                        maskSize: 'contain',
                        WebkitMaskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskPosition: 'center',
                    }}
                />
            </div>

            {/* Text Label */}
            {showText && (
                <div className="hidden md:flex flex-col justify-center mt-1">
                    <span
                        className="text-2xl font-black tracking-tight bg-clip-text text-transparent transition-all duration-300 leading-none"
                        style={{
                            // 🔵 Gradient direction is usually kept LTR for brand names even in RTL layouts
                            // unless you want the gradient to flip.
                            backgroundImage: 'linear-gradient(to right, var(--color-primary), var(--color-content))'
                        }}
                    >
                        FLURRY
                    </span>
                </div>
            )}
        </div>
    );
};

export default memo(Logo);