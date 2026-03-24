import React from 'react';
import { cn, NUMBER_STYLE, formatCurrency } from '../lib/utils';

interface CurrencyDisplayProps {
  amount: number | string | undefined | null;
  currencyCode?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ amount, currencyCode, className, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-2xl',
  };
  return (
    <span className={cn(NUMBER_STYLE, sizeClasses[size], className)}>
      {formatCurrency(amount, currencyCode)}
    </span>
  );
};
