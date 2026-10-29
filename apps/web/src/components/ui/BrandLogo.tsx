import React from 'react';

export interface BrandLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'transparent' | 'original';
  alt?: string;
  width?: number | string;
  height?: number | string;
}

/**
 * Standard RTR Mobiles Brand Logo component.
 * Uses the official Winged Emblem asset with responsive contain and zero layout shift.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'transparent',
  alt = 'RTR Mobiles logo',
  width,
  height
}) => {
  const src = variant === 'original'
    ? '/RTR Mobiles Winged Emblem.png'
    : '/rtr-logo.png';

  const sizeClasses: Record<string, string> = {
    xs: 'h-6 w-auto',
    sm: 'h-8 w-auto',
    md: 'h-10 w-auto',
    lg: 'h-14 sm:h-16 w-auto',
    xl: 'h-20 sm:h-24 w-auto'
  };

  const defaultDimensions: Record<string, { w: number; h: number }> = {
    xs: { w: 34, h: 24 },
    sm: { w: 45, h: 32 },
    md: { w: 56, h: 40 },
    lg: { w: 90, h: 64 },
    xl: { w: 120, h: 86 }
  };

  const fallback = { w: 56, h: 40 };
  const dims = defaultDimensions[size] ?? fallback;

  return (
    <img
      src={src}
      alt={alt}
      width={width ?? dims.w}
      height={height ?? dims.h}
      className={`object-contain select-none transition-transform duration-200 ${sizeClasses[size] || ''} ${className}`}
      loading="eager"
      decoding="async"
    />
  );
};

export default BrandLogo;
