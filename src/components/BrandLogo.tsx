import React from 'react';
import patanakartBadgeAsset from '../assets/images/patanakart_badge_logo_1793209140407.jpg';

export const PATANAKART_LOGO_URL = '/assets/patanakart-logo.jpg';

interface BrandLogoProps {
  variant?: 'lockup' | 'badge';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'light' | 'dark';
  subtitle?: string;
  showSubtitle?: boolean;
  className?: string;
}

const BADGE_SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-11 h-11 sm:w-12 sm:h-12',
  lg: 'w-16 h-16 sm:w-20 sm:h-20',
  xl: 'w-24 h-24',
};

const TITLE_SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'text-sm',
  sm: 'text-base sm:text-lg',
  md: 'text-xl sm:text-[24px]',
  lg: 'text-2xl sm:text-3xl',
  xl: 'text-3xl',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'lockup',
  size = 'md',
  theme = 'light',
  subtitle = 'FASHION FOR EVERY YOU',
  showSubtitle = true,
  className = '',
}) => {
  const badgeElement = (
    <span
      className={`${BADGE_SIZE_CLASSES[size]} rounded-full overflow-hidden shrink-0 inline-flex items-center justify-center bg-[#FAF2E4] ring-1 ring-[#9ED912]/60 shadow-2xs`}
    >
      <img
        src={patanakartBadgeAsset}
        alt="PatanaKart"
        className="w-full h-full object-cover scale-[1.32] select-none"
      />
    </span>
  );

  if (variant === 'badge') {
    return (
      <span className={`inline-flex items-center justify-center ${className}`}>
        {badgeElement}
      </span>
    );
  }

  const isDark = theme === 'dark';

  return (
    <span className={`inline-flex items-center gap-2.5 sm:gap-3 shrink-0 ${className}`}>
      {badgeElement}
      <span className="flex flex-col items-start whitespace-nowrap leading-none">
        <span
          className={`font-space font-extrabold ${TITLE_SIZE_CLASSES[size]} tracking-tight leading-none ${
            isDark ? 'text-white' : 'text-[#111111]'
          }`}
        >
          Patana<span className={isDark ? 'text-[#B8F130]' : 'text-[#65A30D]'}>Kart</span>
        </span>
        {showSubtitle && subtitle && (
          <span
            className={`flex items-center gap-1.5 text-[8.5px] font-space font-bold uppercase tracking-[0.12em] mt-1 ${
              isDark ? 'text-white/70' : 'text-[#57534E]'
            }`}
          >
            <span
              className={`w-2 h-[1px] ${isDark ? 'bg-white/30' : 'bg-[#A8A29E]'}`}
              aria-hidden="true"
            />
            <span>{subtitle}</span>
            <span
              className={`w-2 h-[1px] ${isDark ? 'bg-white/30' : 'bg-[#A8A29E]'}`}
              aria-hidden="true"
            />
          </span>
        )}
      </span>
    </span>
  );
};
