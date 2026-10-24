import React from 'react';
import { motion } from 'motion/react';

export const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#FAF9F6]">
      {/* Sunlit alabaster & warm paper studio base */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FFFFFF] via-[#FAF9F6] to-[#F4F3EF]" />

      {/* Soft Daylight Wash (Top Right) */}
      <motion.div
        animate={{
          x: [0, 24, -18, 0],
          y: [0, -24, 18, 0],
          opacity: [0.45, 0.65, 0.5, 0.45],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-32 -right-32 w-[520px] h-[520px] sm:w-[720px] sm:h-[720px] rounded-full bg-radial from-[#EEF2FF] via-[#EEF2FF]/40 to-transparent blur-[110px]"
      />

      {/* Warm Linen Ambient Wash (Bottom Left) */}
      <motion.div
        animate={{
          x: [0, -24, 30, 0],
          y: [0, 24, -20, 0],
          opacity: [0.35, 0.55, 0.4, 0.35],
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute -bottom-40 -left-40 w-[560px] h-[560px] sm:w-[760px] sm:h-[760px] rounded-full bg-radial from-[#F3F2EE] via-[#E0E7FF]/30 to-transparent blur-[120px]"
      />

      {/* Subtle Architectural Dot Texture */}
      <div
        className="absolute inset-0 opacity-[0.35] bg-repeat"
        style={{
          backgroundImage: `radial-gradient(rgba(24, 24, 27, 0.05) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
};
