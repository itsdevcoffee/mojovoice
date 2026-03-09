import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

/**
 * Neubrutalist button component with brutal shadow animation.
 *
 * Variants:
 * - primary: Solid blue bg, thick black border, brutal shadow
 * - secondary: Transparent bg, blue border, glows on hover
 * - ghost: Transparent, minimal styling, hover bg-slate-800
 *
 * Features:
 * - Brutal shadow animation on hover/press (4px → 6px → 2px)
 * - Loading state with pulse animation
 * - Disabled state with 50% opacity
 * - All transitions use 150ms duration
 * - Uppercase text with tracking-wide
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props }, ref) => {
    const baseStyles = `
      inline-flex items-center justify-center
      font-semibold uppercase tracking-wide
      transition-all duration-150
      disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
      focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2
      focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
    `.trim().replace(/\s+/g, ' ');

    const sizeStyles = {
      sm: 'px-4 py-2 text-xs',
      md: 'px-6 py-3 text-sm',
      lg: 'px-8 py-4 text-base',
    };

    const variantStyles = {
      primary: `
        bg-blue-600 text-white
        border-2 border-black
        shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
        hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]
        hover:translate-x-[-2px] hover:translate-y-[-2px]
        active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
        active:translate-x-[2px] active:translate-y-[2px]
        disabled:translate-x-0 disabled:translate-y-0
        will-change-transform
      `.trim().replace(/\s+/g, ' '),
      secondary: `
        bg-transparent text-blue-500
        border-2 border-blue-500
        hover:bg-blue-500 hover:text-white
        hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]
        will-change-transform
      `.trim().replace(/\s+/g, ' '),
      ghost: `
        bg-transparent text-[var(--text-secondary)]
        border-2 border-transparent
        hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]
        will-change-transform
      `.trim().replace(/\s+/g, ' '),
    };

    const combinedClassName = [
      baseStyles,
      sizeStyles[size],
      variantStyles[variant],
      className,
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="animate-pulse">Loading</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
