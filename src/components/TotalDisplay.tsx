import React from 'react';
import { cn, NUMBER_STYLE } from '../lib/utils';

interface TotalDisplayProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  iconClassName?: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  direction?: 'row' | 'column';
  as?: 'h3' | 'h2' | 'p' | 'div';
}

export const TotalDisplay: React.FC<TotalDisplayProps> = ({ 
  label, 
  value, 
  icon,
  iconClassName,
  className,
  labelClassName,
  valueClassName,
  direction = 'column',
  as: Tag = 'h3'
}) => {
  return (
    <div className={cn(
      "flex items-center gap-4", 
      direction === 'column' ? 'flex-col items-start' : 'justify-between w-full',
      className
    )}>
      <div className="flex items-center gap-4">
        {icon && (
          <div className={cn("p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl", iconClassName)}>
            {icon}
          </div>
        )}
        <p className={cn(
          "text-xs font-bold text-zinc-500 uppercase tracking-widest",
          labelClassName
        )}>
          {label}
        </p>
      </div>
      <Tag className={cn(
        "text-2xl text-zinc-900 dark:text-white",
        NUMBER_STYLE,
        valueClassName
      )}>
        {value}
      </Tag>
    </div>
  );
};
