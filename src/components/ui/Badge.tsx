import React from 'react';

export type BadgeVariant =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral:
    'bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] border-[var(--kz-border-subtle)]',
  accent:
    'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] border-[var(--kz-accent-border)]',
  success:
    'bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border-[var(--kz-success-border)]',
  warning:
    'bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border-[var(--kz-warning-border)]',
  danger:
    'bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border-[var(--kz-danger-border)]',
  info:
    'bg-[var(--kz-info-bg)] text-[var(--kz-info-text)] border-[var(--kz-info-border)]',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--kz-text-muted)]',
  accent: 'bg-[var(--kz-accent)]',
  success: 'bg-[var(--kz-success-solid)]',
  warning: 'bg-[var(--kz-warning-solid)]',
  danger: 'bg-[var(--kz-danger-solid)]',
  info: 'bg-[var(--kz-info-solid)]',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-0.5 text-[11px] gap-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <span
      className={`inline-flex items-center font-semibold border rounded-md leading-tight whitespace-nowrap ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASSES[variant]}`} />
      )}
      {children}
    </span>
  );
};
