import React from 'react';
import { cn } from '../lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = ({ className, ...props }: TextareaProps) => {
  return (
    <textarea
      className={cn(
        "w-full px-0 py-2 bg-transparent border-b border-zinc-300 dark:border-zinc-700 text-sm text-zinc-950 dark:text-white outline-none focus:border-brand transition-all resize-none",
        className
      )}
      {...props}
    />
  );
};
