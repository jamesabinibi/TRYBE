import React from 'react';
import { cn } from '../lib/utils';
import { Select } from './Select';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> {
  as?: 'input' | 'select';
  options?: (string | { value: string; label: string })[];
}

export const Input = ({ className, as: Component = 'input', children, options, ...props }: InputProps) => {
  if (Component === 'select') {
    // If options are passed as children (standard select usage), we try to extract them
    // but it's better to pass an options array. For backward compatibility, we'll handle both.
    const selectOptions = options || React.Children.map(children, (child: any) => {
      if (child?.type === 'option') {
        return { value: String(child.props.value), label: child.props.children };
      }
      return null;
    })?.filter(Boolean) || [];

    return (
      <Select
        value={String(props.value || '')}
        onChange={(val) => {
          if (props.onChange) {
            const event = {
              target: { value: val, name: props.name },
              currentTarget: { value: val, name: props.name }
            } as any;
            props.onChange(event);
          }
        }}
        options={selectOptions as any}
        placeholder={props.placeholder || (children as any)?.[0]?.props?.children || 'Select option'}
        className={className}
        required={props.required}
      />
    );
  }

  return (
    <Component
      className={cn(
        "w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
        className
      )}
      {...(props as any)}
    />
  );
};
