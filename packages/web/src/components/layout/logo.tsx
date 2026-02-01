import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: { image: 24, text: 'text-lg' },
    md: { image: 32, text: 'text-xl' },
    lg: { image: 40, text: 'text-2xl' },
  };

  const { image: imageSize, text: textSize } = sizeClasses[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src="/logo.png"
        alt="SaveAction Logo"
        width={imageSize}
        height={imageSize}
        className="shrink-0"
        priority
      />
      {showText && (
        <span className={cn('font-bold tracking-tight', textSize)}>
          <span className="text-primary">Save</span>
          <span className="text-foreground">Action</span>
        </span>
      )}
    </div>
  );
}
