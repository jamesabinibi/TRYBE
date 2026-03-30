import React from 'react';
import { cn } from '../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> {
  as?: 'input' | 'select';
}

export const Input = ({ className, as: Component = 'input', ...props }: InputProps) => {
  return (
    <Component
      className={cn(
        "w-full px-0 py-2 bg-transparent border-b border-zinc-300 dark:border-zinc-700 text-sm text-zinc-950 dark:text-white outline-none focus:border-brand transition-all",
        className
      )}
      {...(props as any)}
    />
  );
};
