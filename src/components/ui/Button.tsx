import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] border border-transparent hover:bg-[var(--kz-accent-hover)] active:bg-[var(--kz-accent-active)] shadow-[var(--kz-shadow-xs)]',
  secondary:
    'bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)] border border-[var(--kz-border-subtle)] hover:bg-[var(--kz-bg-muted)] hover:border-[var(--kz-border-default)]',
  outline:
    'bg-[var(--kz-bg-surface)] text-[var(--kz-text-secondary)] border border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-subtle)] hover:border-[var(--kz-border-strong)] hover:text-[var(--kz-text-primary)] shadow-[var(--kz-shadow-xs)]',
  ghost:
    'bg-transparent text-[var(--kz-text-secondary)] border border-transparent hover:bg-[var(--kz-bg-subtle)] hover:text-[var(--kz-text-primary)]',
  danger:
    'bg-[var(--kz-danger-solid)] text-white border border-transparent hover:bg-rose-500 active:bg-rose-700 shadow-[var(--kz-shadow-xs)]',
  success:
    'bg-[var(--kz-success-solid)] text-white border border-transparent hover:bg-emerald-500 active:bg-emerald-700 shadow-[var(--kz-shadow-xs)]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-[11px] gap-1 rounded-md',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-xs gap-1.5 rounded-lg',
  lg: 'h-10 px-4 text-sm gap-2 rounded-xl',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'outline',
  size = 'md',
  loading = false,
  disabled,
  leftIcon,
  rightIcon,
  children,
  className = '',
  type = 'button',
  ...props
}) => {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kz-accent)] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0 inline-flex items-center">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && (
        <span className="shrink-0 inline-flex items-center">{rightIcon}</span>
      )}
    </button>
  );
};
