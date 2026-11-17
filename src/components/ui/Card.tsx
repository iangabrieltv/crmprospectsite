import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const PADDING_MAP = {
  none: '',
  sm: 'p-3.5',
  md: 'p-5',
  lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] rounded-xl shadow-[var(--kz-shadow-xs)] ${
        interactive
          ? 'transition-all duration-150 hover:border-[var(--kz-border-default)] hover:shadow-[var(--kz-shadow-sm)]'
          : ''
      } ${PADDING_MAP[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-[var(--kz-border-subtle)] ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3 className={`kz-section-title ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <p className={`text-xs text-[var(--kz-text-muted)] ${className}`} {...props}>
    {children}
  </p>
);
