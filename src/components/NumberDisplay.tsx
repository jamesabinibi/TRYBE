import React from 'react';
import { cn, NUMBER_STYLE } from '../lib/utils';

interface NumberDisplayProps {
  value: number | string | undefined | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const NumberDisplay: React.FC<NumberDisplayProps> = ({ value, className, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-2xl',
  };
  return (
    <span className={cn(NUMBER_STYLE, sizeClasses[size], className)}>
      {value}
    </span>
  );
};
