import React from 'react';

interface ImagePlaceholderProps {
  title?: string;
  className?: string;
  aspectRatio?: string;
}

export const ImagePlaceholder: React.FC<ImagePlaceholderProps> = ({
  title = 'PatanaKart',
  className = '',
  aspectRatio = 'aspect-[3/4]',
}) => {
  return (
    <div
      className={`bg-[#F3F2EE] text-[#18181B] flex flex-col items-center justify-center p-6 text-center select-none ${aspectRatio} ${className}`}
    >
      <div className="border border-[#E5E4DF] rounded-md p-4 w-full max-w-[180px] flex flex-col items-center justify-center bg-white">
        <span className="font-space font-semibold tracking-wider text-[11px] uppercase text-[#64748B] mb-1">
          PatanaKart
        </span>
        <span className="font-space text-sm font-semibold truncate max-w-full text-[#18181B]">
          {title}
        </span>
        <span className="text-[10px] text-[#94A3B8] mt-1.5">
          Studio Preview
        </span>
      </div>
    </div>
  );
};
